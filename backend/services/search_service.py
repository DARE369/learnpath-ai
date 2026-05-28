"""
Search orchestration service.
Runs the full Stage 1 pipeline end-to-end:
  YouTube search → EQS scoring → Summary → Concept graph → Path assembly → Cache
"""

import logging
from datetime import datetime
from typing import Dict, Optional

logger = logging.getLogger(__name__)


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
            cached_topic_id = self.cache.get_query_mapping(query)
            if cached_topic_id:
                cached_path = self.cache.get_topic_path(cached_topic_id)
                if cached_path:
                    logger.info(f"Serving from cache: {cached_topic_id}")
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
        # Step 4: Transcript fetch + EQS scoring (top 10 with transcripts)
        # ----------------------------------------------------------------
        scored_videos = []
        for video in videos[:10]:
            yt_id = video["youtube_id"]
            title = video["title"]

            transcript = await self.youtube.get_transcript(yt_id)
            if not transcript:
                logger.info(f"No transcript — skipping {yt_id}")
                continue

            video["transcript"] = transcript

            try:
                score_result = await self.eqs.score_video(
                    youtube_id=yt_id,
                    title=title,
                    transcript=transcript,
                    description=video.get("description"),
                )
                video["eqs_score"] = score_result.get("score", 0)
                video["eqs_tier"] = score_result.get("tier", 4)
            except ValueError:
                logger.warning(f"CLAUDE_API_KEY missing — EQS skipped for {yt_id}")
                video["eqs_score"] = 0

            # Use youtube_id as video_id for path service compatibility
            video["video_id"] = yt_id
            scored_videos.append(video)

        if not scored_videos:
            raise ValueError(f"No transcripts available for any videos on: '{query}'")

        # ----------------------------------------------------------------
        # Step 5: Summary generation (use first scored video)
        # ----------------------------------------------------------------
        summary_data: Optional[Dict] = None
        for video in scored_videos:
            try:
                summary_data = await self.summary.generate_summary(
                    youtube_id=video["youtube_id"],
                    transcript=video["transcript"],
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

        # ----------------------------------------------------------------
        # Step 8: Cache both layers
        # ----------------------------------------------------------------
        self.cache.cache_topic_path(path)
        self.cache.cache_query_mapping(query, path["topic_id"])

        elapsed = round((datetime.utcnow() - start).total_seconds(), 2)
        logger.info(
            f"Pipeline complete in {elapsed}s — "
            f"{path['video_count']} videos, avg EQS {path['average_score']}"
        )

        return {
            "source": "generated",
            "path": path,
            "concepts": concept_order,
            "generation_time_seconds": elapsed,
        }


# Initialized in main.py after all service singletons are imported.
search_service: Optional[SearchService] = None
