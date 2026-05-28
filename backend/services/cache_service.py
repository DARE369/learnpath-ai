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
        Return cached path for topic_id, or None if absent/expired.
        `db` is accepted for future DB-backed compatibility but unused in Stage 1.
        """
        entry = self._topic_cache.get(topic_id)
        if entry is None:
            logger.info(f"Topic cache MISS: {topic_id}")
            self.misses += 1
            return None

        if datetime.utcnow() > entry["expires_at"]:
            logger.info(f"Topic cache EXPIRED: {topic_id}")
            del self._topic_cache[topic_id]
            self.misses += 1
            return None

        logger.info(f"Topic cache HIT: {topic_id}")
        self.hits += 1
        return entry["data"]

    def cache_topic_path(self, path: Dict, db=None) -> bool:
        """
        Store an assembled path in the topic cache.
        `db` accepted for future DB-backed compatibility.
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
        logger.info(f"Topic path cached: {topic_id} (TTL {TOPIC_TTL_DAYS}d)")
        return True

    def invalidate_topic_cache(self, topic_id: str, db=None) -> bool:
        """
        Remove a topic from the cache (call when EQS scores are updated).
        `db` accepted for future use (will also mark DB rows inactive).
        """
        if topic_id in self._topic_cache:
            del self._topic_cache[topic_id]
            logger.info(f"Topic cache invalidated: {topic_id}")
        else:
            logger.info(f"Topic cache invalidate — key not found: {topic_id}")
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

        if entry is None:
            logger.info(f"Query cache MISS: '{query}'")
            self.misses += 1
            return None

        if datetime.utcnow() > entry["expires_at"]:
            logger.info(f"Query cache EXPIRED: '{query}'")
            del self._query_cache[key]
            self.misses += 1
            return None

        logger.info(f"Query cache HIT: '{query}' → {entry['topic_id']}")
        self.hits += 1
        return entry["topic_id"]

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
