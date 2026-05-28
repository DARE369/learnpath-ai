"""
Cache management endpoints.
These are admin/ops endpoints — add authentication before exposing in production.
"""

import logging

from fastapi import APIRouter, HTTPException, status

from services.cache_service import cache_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/stats")
async def get_cache_stats():
    """
    Return live cache performance statistics.

    Response includes hit rate, per-layer sizes, and total request counts.
    A healthy production cache should target >= 95% hit rate.
    """
    return cache_service.get_cache_stats()


@router.get("/topics")
async def list_cached_topics():
    """List all topic_ids currently held in the Layer 1 topic cache."""
    return {
        "cached_topics": cache_service.get_cached_topics(),
        "count": len(cache_service.get_cached_topics()),
    }


@router.post("/clear")
async def clear_cache():
    """
    Wipe both cache layers and reset hit/miss counters.
    Use after a bulk EQS re-score or schema migration.
    """
    cache_service.clear_cache()
    logger.info("Cache cleared via admin endpoint")
    return {"message": "Both cache layers cleared", "status": "ok"}


@router.post("/invalidate/{topic_id}", status_code=status.HTTP_200_OK)
async def invalidate_topic(topic_id: str):
    """
    Invalidate the Layer 1 cache entry for a specific topic.
    Call this when EQS scores are updated for videos in that topic.
    """
    try:
        success = cache_service.invalidate_topic_cache(topic_id)
        return {
            "topic_id": topic_id,
            "invalidated": success,
            "message": f"Cache entry for '{topic_id}' removed" if success else "Key not found",
        }
    except Exception as e:
        logger.error(f"Error invalidating cache for {topic_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cache invalidation failed: {str(e)}",
        )
