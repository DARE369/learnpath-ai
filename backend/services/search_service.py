"""
Search orchestration service.
Runs the full Stage 1 pipeline end-to-end:
  YouTube search → EQS scoring → Summary → Concept graph → Path assembly → Cache

Stage 3.2 integration:
  - Pre-filter blacklisted youtube_ids before EQS scoring (saves Claude tokens),
    unless the caller is a shadow-test user (deterministic 1-in-10 slice).
  - After scoring, soft-blacklist any youtube_id with EQS < 65 so future
    searches skip it.
"""

import logging
from datetime import datetime
from typing import Dict, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

LOW_SCORE_THRESHOLD = 65


def _log_search_event(
    db: Optional[Session],
    *,
    query: str,
    user_id: Optional[str],
    source: str,
    average_score: int,
) -> None:
    """
    Best-effort SearchEvent write (Packet 3.5). Never raises — the search
    pipeline must never fail because of an analytics write. Skips silently
    when db is None (e.g. anonymous / pre-Packet-3.2 callers).
    """
    if db is None:
        return
    try:
        from models import SearchEvent
        import uuid as _uuid
        user_uuid = None
        if user_id:
            try:
                user_uuid = _uuid.UUID(str(user_id))
            except (ValueError, TypeError):
                user_uuid = None
        db.add(SearchEvent(
            query_normalized=query.lower().strip(),
            user_id=user_uuid,
            source=source,
            average_score=average_score,
        ))
        db.commit()
    except Exception as e:
        logger.warning(f"SearchEvent write failed (non-fatal): {e}")


class SearchService:
    """
    Thin orchestrator: delegates every step to its injected services.
    Constructed once in main.py with the global service singletons.
    """

    def __init__(
        self,
        youtube_service,
        eqs_service,
        summary_service,
        concept_graph_service,
        path_service,
        cache_service,
    ):
        self.youtube = youtube_service
        self.eqs = eqs_service
        self.summary = summary_service
        self.concepts = concept_graph_service
        self.path = path_service
        self.cache = cache_service

    async def search_and_build_path(
        self,
        query: str,
        use_cache: bool = True,
        user_id: Optional[str] = None,
        db: Optional[Session] = None,
    ) -> Dict:
        """
        Complete learning-path pipeline for a topic query.

        Steps:
        1. Layer 2 cache check (query → topic_id)
        2. Layer 1 cache check (topic_id → path)
        3. YouTube search (up to 20 videos)
        4. Transcript fetch + EQS scoring (top 10 videos with transcripts)
        5. Summary generation (Claude Sonnet)
        6. Concept extraction + graph build + topological sort (Claude Opus)
        7. Path assembly (rank, order, validate)
        8. Cache result (both layers)

        Returns a dict with keys: source, path, concepts, generation_time_seconds
        """
        logger.info(f"Search pipeline started: '{query}'")

        # ----------------------------------------------------------------
        # Step 1 + 2: Cache check
        # ----------------------------------------------------------------
        if use_cache:
            cached_topic_id = self.cache.get_query_mapping(query, db=db)
            if cached_topic_id:
                cached_path = self.cache.get_topic_path(cached_topic_id, db=db)
                if cached_path:
                    logger.info(f"Serving from cache: {cached_topic_id}")
                    _log_search_event(
                        db,
                        query=query,
                        user_id=user_id,
                        source="cache",
                        average_score=int(cached_path.get("average_score") or 0),
                    )
                    return {
                        "source": "cache",
                        "path": cached_path,
                        "concepts": [],
                        "generation_time_seconds": 0,
                    }

        logger.info("Cache miss — executing full pipeline")
        start = datetime.utcnow()

        # ----------------------------------------------------------------
        # Step 3: YouTube search
        # ----------------------------------------------------------------
        videos = await self.youtube.search_videos(query, max_results=20)
        if not videos:
            raise ValueError(f"No YouTube videos found for: '{query}'")
        logger.info(f"YouTube returned {len(videos)} candidates")

        # ----------------------------------------------------------------
        # Step 3.5: Blacklist pre-filter (Packet 3.2)
        # Skip already-blacklisted youtube_ids before EQS scoring to save
        # Claude tokens. Shadow-test users (1-in-10) bypass the filter so
        # we can collect feedback on soft-blacklisted videos.
        # ----------------------------------------------------------------
        is_shadow_tester = False
        if db is not None:
            from services.blacklist_service import blacklist_service
            is_shadow_tester = blacklist_service.should_shadow_test(user_id)
            if not is_shadow_tester:
                yt_ids = [v["youtube_id"] for v in videos]
                allowed = set(blacklist_service.filter_blacklisted(db, yt_ids))
                pre_filtered_count = len(videos)
                videos = [v for v in videos if v["youtube_id"] in allowed]
                skipped = pre_filtered_count - len(videos)
                if skipped:
                    logger.info(f"Blacklist pre-filter dropped {skipped} videos")
                if not videos:
                    raise ValueError(
                        f"All YouTube results for '{query}' are blacklisted"
                    )

        # ----------------------------------------------------------------
        # Step 3.7: Load user profile (level, learning styles)
        # Used by EQS to personalise Level Match scoring.
        # ----------------------------------------------------------------
        user_level = ""
        learning_styles: list = []
        if user_id and db is not None:
            try:
                from models import UserProfile
                import uuid as _uuid
                user_uuid = _uuid.UUID(str(user_id))
                profile = (
                    db.query(UserProfile)
                    .filter(UserProfile.user_id == user_uuid)
                    .first()
                )
                if profile:
                    user_level = profile.current_level or ""
                    learning_styles = list(profile.learning_styles or [])
                    logger.info(
                        f"User profile loaded: level={user_level!r} "
                        f"styles={learning_styles}"
                    )
            except Exception as e:
                logger.warning(f"UserProfile load failed (non-fatal): {e}")

        # ----------------------------------------------------------------
        # Step 4: Transcript fetch (best-effort) + video details + EQS scoring
        # ----------------------------------------------------------------
        # Transcripts are NOT required — youtube-transcript-api can be blocked
        # from cloud IPs. EQS supports scoring on title + description alone;
        # transcripts and view/like counts give richer signals when available.
        candidates = videos[:10]
        yt_ids = [v["youtube_id"] for v in candidates]

        # Batch-fetch view count, like count, duration in one YouTube API call
        video_details: dict = {}
        try:
            video_details = await self.youtube.get_videos_details_batch(yt_ids)
        except Exception as e:
            logger.warning(f"Batch video details failed (non-fatal): {e}")

        scored_videos = []
        transcripts_fetched = 0
        for video in candidates:
            yt_id = video["youtube_id"]
            title = video["title"]
            details = video_details.get(yt_id, {})

            # Merge duration into video dict for downstream consumers
            if details.get("duration_seconds"):
                video["duration_seconds"] = details["duration_seconds"]

            transcript = None
            try:
                transcript = await self.youtube.get_transcript(yt_id)
            except Exception as e:
                logger.info(f"Transcript fetch failed for {yt_id}: {e}")

            if transcript:
                transcripts_fetched += 1
                video["transcript"] = transcript

            try:
                score_result = await self.eqs.score_video(
                    youtube_id=yt_id,
                    title=title,
                    transcript=transcript,
                    description=video.get("description"),
                    query=query,
                    channel_name=video.get("channel_name", ""),
                    duration_seconds=details.get("duration_seconds", 0),
                    view_count=details.get("view_count", 0),
                    like_count=details.get("like_count", 0),
                    user_level=user_level,
                    learning_styles=learning_styles,
                )
                video["eqs_score"] = score_result.get("score", 0)
                video["eqs_tier"] = score_result.get("tier", 4)
                video["eqs_dimensions"] = score_result.get("dimensions", {})
            except ValueError:
                logger.warning(f"CLAUDE_API_KEY missing — EQS skipped for {yt_id}")
                video["eqs_score"] = 0
            except Exception as e:
                logger.warning(f"EQS scoring failed for {yt_id}: {e}")
                video["eqs_score"] = 0

            video["video_id"] = yt_id
            scored_videos.append(video)

        logger.info(
            f"Scored {len(scored_videos)} videos "
            f"({transcripts_fetched} with transcripts, "
            f"{len(video_details)} with metadata)"
        )

        if not scored_videos:
            raise ValueError(f"Could not score any videos for: '{query}'")

        # ----------------------------------------------------------------
        # Step 4.5: Auto-blacklist low scores (Packet 3.2)
        # Any youtube_id whose EQS came back below the threshold gets a
        # soft-blacklist row. Pure DB writes, no extra Claude cost.
        # ----------------------------------------------------------------
        if db is not None:
            from services.blacklist_service import blacklist_service
            blacklisted_now = 0
            for v in scored_videos:
                score = int(v.get("eqs_score") or 0)
                if score and score < LOW_SCORE_THRESHOLD:
                    try:
                        blacklist_service.blacklist_video(
                            db,
                            youtube_id=v["youtube_id"],
                            reason=f"Auto-blacklist: EQS {score} < {LOW_SCORE_THRESHOLD}",
                            blacklist_type="soft",
                            last_score=score,
                        )
                        blacklisted_now += 1
                    except Exception as e:
                        logger.warning(
                            f"Auto-blacklist write failed for {v['youtube_id']}: {e}"
                        )
            if blacklisted_now:
                logger.info(f"Auto-blacklisted {blacklisted_now} videos this search")
            # If we're a shadow-tester, keep blacklisted videos in scored_videos
            # so they can surface in the path and collect feedback. Otherwise,
            # drop newly-flagged ones from the assembly pool.
            if not is_shadow_tester:
                scored_videos = [
                    v for v in scored_videos
                    if int(v.get("eqs_score") or 0) >= LOW_SCORE_THRESHOLD
                ]
            if not scored_videos:
                raise ValueError(
                    f"All scored videos for '{query}' fell below quality threshold"
                )

        # ----------------------------------------------------------------
        # Step 5: Summary generation
        # Prefer a video that has a transcript. If none do, fall back to the
        # top-scoring video's description so the rest of the pipeline still
        # has *some* text to extract concepts from.
        # ----------------------------------------------------------------
        summary_data: Optional[Dict] = None
        candidates_with_transcript = [v for v in scored_videos if v.get("transcript")]
        candidates = candidates_with_transcript or scored_videos

        for video in candidates:
            text_for_summary = video.get("transcript") or video.get("description") or ""
            if len(text_for_summary.strip()) < 50:
                continue
            try:
                summary_data = await self.summary.generate_summary(
                    youtube_id=video["youtube_id"],
                    transcript=text_for_summary,
                    title=video["title"],
                )
                video["summary"] = summary_data.get("summary", "")
                video["concepts"] = summary_data.get("key_concepts", [])
                break
            except ValueError:
                logger.warning("CLAUDE_API_KEY missing — summary skipped")
                break
            except Exception as e:
                logger.warning(f"Summary failed for {video['youtube_id']}: {e}")
                continue

        # ----------------------------------------------------------------
        # Step 6: Concept graph
        # ----------------------------------------------------------------
        concept_order = []
        if summary_data:
            summary_text = summary_data.get("summary", "")
            try:
                concepts_result = await self.concepts.extract_concepts(
                    summary=summary_text,
                    video_title=query,
                )
                graph = self.concepts.build_concept_graph(concepts_result)

                has_cycles, cycles = self.concepts.detect_cycles(graph)
                if has_cycles:
                    graph = self.concepts.break_cycles(graph, cycles)

                concept_order, _ = self.concepts.topological_sort(graph)
            except ValueError:
                logger.warning("CLAUDE_API_KEY missing — concept graph skipped")
            except Exception as e:
                logger.warning(f"Concept graph failed: {e}")

        concept_graph_input = (
            {"ordered_concepts": concept_order} if concept_order else None
        )

        # ----------------------------------------------------------------
        # Step 7: Path assembly
        # ----------------------------------------------------------------
        path = self.path.assemble_path(
            topic_id=query,
            videos=scored_videos,
            concept_graph=concept_graph_input,
        )

        # path_service returns video_sequence (IDs only). Rehydrate full video
        # objects in path["videos"] so downstream callers (router, frontend)
        # don't need to re-fetch by ID.
        video_by_id = {v.get("video_id"): v for v in scored_videos}
        path["videos"] = [
            video_by_id[vid] for vid in path.get("video_sequence", [])
            if vid in video_by_id
        ]
        path["videos_considered"] = len(videos)

        # ----------------------------------------------------------------
        # Step 8: Cache both layers
        # ----------------------------------------------------------------
        self.cache.cache_topic_path(path, db=db, user_id=user_id)
        self.cache.cache_query_mapping(query, path["topic_id"])

        elapsed = round((datetime.utcnow() - start).total_seconds(), 2)
        logger.info(
            f"Pipeline complete in {elapsed}s — "
            f"{path['video_count']} videos, avg EQS {path['average_score']}"
        )

        _log_search_event(
            db,
            query=query,
            user_id=user_id,
            source="generated",
            average_score=int(path.get("average_score") or 0),
        )

        return {
            "source": "generated",
            "path": path,
            "concepts": concept_order,
            "generation_time_seconds": elapsed,
            "transcripts_fetched": transcripts_fetched,
        }


# Initialized in main.py after all service singletons are imported.
search_service: Optional[SearchService] = None
