"""
Two-layer caching system.

Layer 1 — Topic cache: stores assembled learning paths, keyed by topic_id.
           TTL: 30 days. Backed by in-memory dict for Stage 1; DB persistence
           (learning_paths table) will replace this in the persistence stage.

Layer 2 — Query cache: maps raw user queries to topic_ids.
           TTL: 7 days. In-memory only (intentional — queries are transient).
"""

import hashlib
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

TOPIC_TTL_DAYS = 30
QUERY_TTL_DAYS = 7
# Re-validate a stored path at most this often, and drop it (regenerate) if a
# prune leaves fewer than this many videos.
VALIDATION_TTL_DAYS = 30
MIN_PATH_VIDEOS = 3


class CacheService:
    def __init__(self):
        # Layer 1: topic_id → {data, expires_at}
        self._topic_cache: Dict = {}
        # Layer 2: normalised_query → {topic_id, expires_at}
        self._query_cache: Dict = {}
        self.hits = 0
        self.misses = 0

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def get_cache_key(self, raw: str) -> str:
        """Deterministic MD5 key — same input always produces same key."""
        return hashlib.md5(raw.encode()).hexdigest()

    @staticmethod
    def _normalise(query: str) -> str:
        return query.lower().strip()

    # ------------------------------------------------------------------
    # Layer 1 — Topic path cache
    # ------------------------------------------------------------------

    def get_topic_path(self, topic_id: str, db=None) -> Optional[Dict]:
        """
        Return the cached path for topic_id (memory L1 → DB L2), or None.
        When `db` is provided, a DB hit warms memory and bumps times_served so the
        path survives restarts and is shared across users.
        """
        entry = self._topic_cache.get(topic_id)
        if entry is not None and datetime.utcnow() <= entry["expires_at"]:
            logger.info(f"Topic cache HIT (memory): {topic_id}")
            self.hits += 1
            return entry["data"]
        if entry is not None:
            # Expired in memory — drop and fall through to the DB.
            del self._topic_cache[topic_id]

        if db is not None:
            try:
                from models import CachedPath
                row = (
                    db.query(CachedPath)
                    .filter(CachedPath.topic_id == topic_id, CachedPath.valid.is_(True))
                    .first()
                )
                if row is not None:
                    path_data = row.path_json
                    # Cheap freshness re-check on stale rows (no Claude): prune
                    # videos that have since been blacklisted. If too few remain,
                    # invalidate so the next request regenerates.
                    last_val = row.last_validated_at
                    is_stale = last_val is None or (
                        datetime.utcnow() - last_val > timedelta(days=VALIDATION_TTL_DAYS)
                    )
                    if is_stale:
                        revalidated = self._revalidate_path(path_data, db)
                        if revalidated is None:
                            row.valid = False
                            db.commit()
                            logger.info(f"Cached path invalidated (too thin after prune): {topic_id}")
                            self.misses += 1
                            return None
                        path_data = revalidated
                        row.path_json = revalidated
                        row.video_count = int(revalidated.get("video_count") or 0)
                        row.last_validated_at = datetime.utcnow()
                    row.times_served = (row.times_served or 0) + 1
                    db.commit()
                    self._topic_cache[topic_id] = {
                        "data": path_data,
                        "expires_at": datetime.utcnow() + timedelta(days=TOPIC_TTL_DAYS),
                        "cached_at": datetime.utcnow().isoformat(),
                    }
                    logger.info(f"Topic cache HIT (db): {topic_id}")
                    self.hits += 1
                    return path_data
            except Exception as e:
                logger.warning(f"Topic cache DB read failed for {topic_id}: {e}")
                try:
                    db.rollback()
                except Exception:
                    pass

        logger.info(f"Topic cache MISS: {topic_id}")
        self.misses += 1
        return None

    def cache_topic_path(self, path: Dict, db=None, user_id=None) -> bool:
        """
        Store an assembled path in memory (L1) and, when `db` is given, upsert it
        into `cached_paths` (L2) so it's durable and reusable by every user.
        """
        topic_id = path.get("topic_id")
        if not topic_id:
            logger.warning("cache_topic_path called with no topic_id — skipped")
            return False

        self._topic_cache[topic_id] = {
            "data": path,
            "expires_at": datetime.utcnow() + timedelta(days=TOPIC_TTL_DAYS),
            "cached_at": datetime.utcnow().isoformat(),
        }

        if db is not None:
            try:
                from models import CachedPath
                vc = int(path.get("video_count") or 0)
                avg = int(path.get("average_score") or 0)
                row = db.query(CachedPath).filter(CachedPath.topic_id == topic_id).first()
                if row is not None:
                    row.path_json = path
                    row.video_count = vc
                    row.average_score = avg
                    row.valid = True
                    row.last_validated_at = datetime.utcnow()
                else:
                    db.add(CachedPath(
                        topic_id=topic_id,
                        query_normalized=self._normalise(str(topic_id)),
                        path_json=path,
                        video_count=vc,
                        average_score=avg,
                        created_by_user_id=user_id,
                    ))
                db.commit()
            except Exception as e:
                logger.warning(f"Topic cache DB write failed for {topic_id}: {e}")
                try:
                    db.rollback()
                except Exception:
                    pass

        logger.info(f"Topic path cached: {topic_id} (TTL {TOPIC_TTL_DAYS}d)")
        return True

    def _revalidate_path(self, path: Dict, db) -> Optional[Dict]:
        """
        Cheap, no-Claude freshness check: drop videos that have been blacklisted
        since the path was built. Returns a pruned copy, or None if fewer than
        MIN_PATH_VIDEOS survive (caller should regenerate). Re-uses the EQS scores
        already stored in the path — only structure changes.
        """
        videos = path.get("videos") or []
        if not videos:
            return path  # nothing to prune (older/empty cache shape)
        try:
            from services.blacklist_service import blacklist_service
            yt_ids = [v.get("youtube_id") for v in videos if v.get("youtube_id")]
            allowed = set(blacklist_service.filter_blacklisted(db, yt_ids))
        except Exception as e:
            logger.warning(f"Revalidation prune skipped (blacklist check failed): {e}")
            return path  # fail-open: serve as-is rather than block

        kept = [v for v in videos if v.get("youtube_id") in allowed]
        if len(kept) == len(videos):
            return path  # nothing pruned
        if len(kept) < MIN_PATH_VIDEOS:
            return None  # too thin → regenerate

        new_path = dict(path)
        new_path["videos"] = kept
        new_path["video_sequence"] = [v.get("video_id") for v in kept if v.get("video_id")]
        new_path["video_count"] = len(kept)
        logger.info(f"Revalidated path: pruned {len(videos) - len(kept)} blacklisted video(s)")
        return new_path

    def invalidate_topic_cache(self, topic_id: str, db=None) -> bool:
        """
        Remove a topic from the cache (call when EQS scores are updated).
        `db` accepted for future use (will also mark DB rows inactive).
        """
        if topic_id in self._topic_cache:
            del self._topic_cache[topic_id]
            logger.info(f"Topic cache invalidated (memory): {topic_id}")
        if db is not None:
            try:
                from models import CachedPath
                row = db.query(CachedPath).filter(CachedPath.topic_id == topic_id).first()
                if row is not None:
                    row.valid = False
                    db.commit()
                    logger.info(f"Topic cache invalidated (db): {topic_id}")
            except Exception as e:
                logger.warning(f"Topic cache DB invalidate failed for {topic_id}: {e}")
                try:
                    db.rollback()
                except Exception:
                    pass
        return True

    # ------------------------------------------------------------------
    # Layer 2 — Query mapping cache
    # ------------------------------------------------------------------

    def get_query_mapping(self, query: str, db=None) -> Optional[str]:
        """
        Return topic_id previously mapped to this query, or None.
        Normalises the query before lookup so 'Photosynthesis' == 'photosynthesis'.
        """
        key = self._normalise(query)
        entry = self._query_cache.get(key)

        if entry is not None and datetime.utcnow() <= entry["expires_at"]:
            logger.info(f"Query cache HIT (memory): '{query}' -> {entry['topic_id']}")
            self.hits += 1
            return entry["topic_id"]
        if entry is not None:
            del self._query_cache[key]

        if db is not None:
            try:
                from models import CachedPath
                row = (
                    db.query(CachedPath)
                    .filter(CachedPath.query_normalized == key, CachedPath.valid.is_(True))
                    .first()
                )
                if row is not None:
                    self._query_cache[key] = {
                        "topic_id": row.topic_id,
                        "expires_at": datetime.utcnow() + timedelta(days=QUERY_TTL_DAYS),
                    }
                    logger.info(f"Query cache HIT (db): '{query}' -> {row.topic_id}")
                    self.hits += 1
                    return row.topic_id
            except Exception as e:
                logger.warning(f"Query cache DB read failed for '{query}': {e}")
                try:
                    db.rollback()
                except Exception:
                    pass

        logger.info(f"Query cache MISS: '{query}'")
        self.misses += 1
        return None

    def cache_query_mapping(self, query: str, topic_id: str) -> bool:
        """Map a raw query string to a topic_id with a 7-day TTL."""
        key = self._normalise(query)
        self._query_cache[key] = {
            "topic_id": topic_id,
            "expires_at": datetime.utcnow() + timedelta(days=QUERY_TTL_DAYS),
        }
        logger.info(f"Query mapping cached: '{query}' → {topic_id} (TTL {QUERY_TTL_DAYS}d)")
        return True

    # ------------------------------------------------------------------
    # Statistics & management
    # ------------------------------------------------------------------

    def get_cache_stats(self) -> Dict:
        total = self.hits + self.misses
        hit_rate = round(self.hits / total * 100, 2) if total > 0 else 0.0

        # Count non-expired entries
        now = datetime.utcnow()
        live_topics = sum(
            1 for e in self._topic_cache.values() if e["expires_at"] > now
        )
        live_queries = sum(
            1 for e in self._query_cache.values() if e["expires_at"] > now
        )

        return {
            "hits": self.hits,
            "misses": self.misses,
            "total_requests": total,
            "hit_rate_percent": hit_rate,
            "topic_cache_size": live_topics,
            "query_cache_size": live_queries,
            "memory_cache_size": live_topics + live_queries,
        }

    def clear_cache(self) -> None:
        """Wipe both layers and reset counters."""
        self._topic_cache.clear()
        self._query_cache.clear()
        self.hits = 0
        self.misses = 0
        logger.info("All cache layers cleared")

    def get_cached_topics(self) -> List[str]:
        """Return list of non-expired topic_ids in Layer 1."""
        now = datetime.utcnow()
        return [tid for tid, e in self._topic_cache.items() if e["expires_at"] > now]


# Global singleton
cache_service = CacheService()
