"""
Cache management endpoints.
These are admin/ops endpoints — add authentication before exposing in production.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import require_admin
from services.cache_service import cache_service
from services.cost_tracker import cost_tracker

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/metrics")
async def cost_and_cache_metrics(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin: AI cost fences, cache hit-rate, and path-library reuse — the
    token-savings dashboard. Each DB serve of a stored path avoided a generation."""
    from sqlalchemy import func
    from models import CachedPath

    row = db.query(
        func.count(CachedPath.id),
        func.coalesce(func.sum(CachedPath.times_served), 0),
    ).filter(CachedPath.valid.is_(True)).first()
    stored_paths = int(row[0] or 0) if row else 0
    total_reuse = int(row[1] or 0) if row else 0

    return {
        "ai_budgets": cost_tracker.stats(),
        "cache": cache_service.get_cache_stats(),
        "path_library": {
            "stored_paths": stored_paths,
            "served_from_library": total_reuse,
            "est_generations_saved": total_reuse,
        },
    }


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


@router.post("/revalidate/{topic_id:path}")
async def revalidate_cached_path(
    topic_id: str,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin: re-validate a stored path NOW — prune videos that are blacklisted or
    no longer available on YouTube (Stage 12/D14). Drops the path (regenerate next
    time) if too few survive."""
    from urllib.parse import unquote
    from models import CachedPath
    from services.blacklist_service import blacklist_service
    from services.youtube_service import youtube_service

    MIN_VIDEOS = 3
    decoded = unquote(topic_id).strip()
    row = db.query(CachedPath).filter(CachedPath.topic_id == decoded).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"No cached path for: {decoded}")

    path = row.path_json or {}
    videos = path.get("videos") or []
    yt_ids = [v.get("youtube_id") for v in videos if v.get("youtube_id")]
    not_blacklisted = set(blacklist_service.filter_blacklisted(db, yt_ids))
    available = await youtube_service.available_youtube_ids(yt_ids)
    keep = not_blacklisted & available
    kept = [v for v in videos if v.get("youtube_id") in keep]
    pruned = len(videos) - len(kept)

    if len(kept) < MIN_VIDEOS:
        row.valid = False
        db.commit()
        cache_service.invalidate_topic_cache(decoded, db=db)
        return {"topic_id": decoded, "pruned": pruned, "remaining": len(kept), "invalidated": True}

    path["videos"] = kept
    path["video_sequence"] = [v.get("video_id") for v in kept if v.get("video_id")]
    path["video_count"] = len(kept)
    from datetime import datetime
    row.path_json = path
    row.video_count = len(kept)
    row.last_validated_at = datetime.utcnow()
    db.commit()
    cache_service.forget_memory(decoded)  # drop stale L1 copy; DB row stays valid
    return {"topic_id": decoded, "pruned": pruned, "remaining": len(kept), "invalidated": False}


@router.post("/clear")
async def clear_cache(_admin: User = Depends(require_admin)):
    """
    Wipe both cache layers and reset hit/miss counters.
    Use after a bulk EQS re-score or schema migration.
    """
    cache_service.clear_cache()
    logger.info("Cache cleared via admin endpoint")
    return {"message": "Both cache layers cleared", "status": "ok"}


@router.post("/invalidate/{topic_id}", status_code=status.HTTP_200_OK)
async def invalidate_topic(topic_id: str, _admin: User = Depends(require_admin)):
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
