"""Advanced caching with Redis (Packet 6.2)"""

import json
import redis
import logging
from datetime import timedelta
from typing import Any, Optional
from functools import wraps
import hashlib

logger = logging.getLogger(__name__)

class CacheManager:
    """Manages Redis caching with TTL strategies and key patterns."""

    def __init__(self, redis_url: str = "redis://localhost:6379"):
        try:
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            self.redis_client.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.warning(f"Redis unavailable: {e}. Caching disabled.")
            self.redis_client = None

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if not self.redis_client:
            return None
        try:
            value = self.redis_client.get(key)
            return json.loads(value) if value else None
        except Exception as e:
            logger.error(f"Cache get error for {key}: {e}")
            return None

    def set(self, key: str, value: Any, ttl_seconds: int = 3600) -> bool:
        """Set value in cache with TTL."""
        if not self.redis_client:
            return False
        try:
            self.redis_client.setex(
                key,
                ttl_seconds,
                json.dumps(value)
            )
            return True
        except Exception as e:
            logger.error(f"Cache set error for {key}: {e}")
            return False

    def delete(self, key: str) -> bool:
        """Delete key from cache."""
        if not self.redis_client:
            return False
        try:
            self.redis_client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Cache delete error for {key}: {e}")
            return False

    def clear_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern."""
        if not self.redis_client:
            return 0
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                return self.redis_client.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Cache clear pattern error: {e}")
            return 0

    @staticmethod
    def generate_key(*args, **kwargs) -> str:
        """Generate cache key from args and kwargs."""
        content = f"{':'.join(str(a) for a in args)}:{':'.join(f'{k}={v}' for k, v in sorted(kwargs.items()))}"
        return hashlib.md5(content.encode()).hexdigest()[:20]


# Singleton instance
cache_manager = CacheManager()


def cache_result(ttl_seconds: int = 3600):
    """Decorator to cache function results."""
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            if not cache_manager.redis_client:
                return await func(*args, **kwargs)

            cache_key = f"{func.__name__}:{CacheManager.generate_key(*args, **kwargs)}"

            # Try cache
            cached = cache_manager.get(cache_key)
            if cached is not None:
                return cached

            # Compute and cache
            result = await func(*args, **kwargs)
            cache_manager.set(cache_key, result, ttl_seconds)
            return result

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            if not cache_manager.redis_client:
                return func(*args, **kwargs)

            cache_key = f"{func.__name__}:{CacheManager.generate_key(*args, **kwargs)}"

            # Try cache
            cached = cache_manager.get(cache_key)
            if cached is not None:
                return cached

            # Compute and cache
            result = func(*args, **kwargs)
            cache_manager.set(cache_key, result, ttl_seconds)
            return result

        # Return async or sync based on function
        if hasattr(func, '__code__') and func.__code__.co_flags & 0x100:
            return async_wrapper
        return sync_wrapper

    return decorator


# Common cache TTLs (minutes converted to seconds)
CACHE_TTLS = {
    "user_profile": int(timedelta(minutes=30).total_seconds()),        # 1800s
    "quiz_questions": int(timedelta(days=7).total_seconds()),          # 604800s
    "leaderboard": int(timedelta(hours=1).total_seconds()),            # 3600s
    "path_recommendations": int(timedelta(hours=24).total_seconds()),  # 86400s
    "analytics": int(timedelta(minutes=5).total_seconds()),            # 300s
    "video_metadata": int(timedelta(days=7).total_seconds()),          # 604800s
}
