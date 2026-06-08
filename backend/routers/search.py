"""
Search & path-building endpoints.

Thin HTTP layer over services.search_service.SearchService — adapts the
service's internal return shape into the response shape the frontend consumes,
and adds auth + request validation.
"""

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import services.search_service as _search_mod
from database import get_db
from models import User
from routers.auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


# ─── Request / response shapes ──────────────────────────────────────────────


class BuildPathRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=200)
    use_cache: bool = True
    # Explicit "Rebuild fresh" from the UI — bypasses the cache and regenerates,
    # overwriting the stored path for this topic.
    force_refresh: bool = False


class PathVideo(BaseModel):
    video_id: str
    youtube_id: str
    title: str
    duration_minutes: int = 0
    eqs_score: float = 0
    summary: str = ""
    concepts: List[str] = []
    thumbnail_url: str = ""


class PathStats(BaseModel):
    videos_found: int
    videos_used: int
    average_quality_score: float
    confidence: str
    concepts_covered: int


class BuildPathResponse(BaseModel):
    topic_id: str
    topic_name: str
    learning_path: List[PathVideo]
    stats: PathStats
    time_to_build_seconds: float
    source: str


# ─── Helpers ────────────────────────────────────────────────────────────────


def _confidence_label(avg_score: float) -> str:
    if avg_score >= 120:
        return "Very high"
    if avg_score >= 100:
        return "High"
    if avg_score >= 80:
        return "Medium"
    return "Low"


def _video_to_response(v: dict) -> PathVideo:
    return PathVideo(
        video_id=v.get("video_id") or v.get("youtube_id", ""),
        youtube_id=v.get("youtube_id", ""),
        title=v.get("title", ""),
        duration_minutes=int((v.get("duration_seconds") or 0) // 60),
        eqs_score=float(v.get("eqs_score") or 0),
        summary=v.get("summary", "") or "",
        concepts=v.get("concepts", []) or [],
        thumbnail_url=v.get("thumbnail_url", "") or "",
    )


# ─── Endpoints ──────────────────────────────────────────────────────────────


def _path_to_response(path: dict, topic_name: str, source: str, generation_time: float, concepts_count: int = 0) -> BuildPathResponse:
    videos = path.get("videos", []) or []
    avg_score = float(path.get("average_score") or 0)
    return BuildPathResponse(
        topic_id=path.get("topic_id", ""),
        topic_name=topic_name,
        learning_path=[_video_to_response(v) for v in videos],
        stats=PathStats(
            videos_found=int(path.get("videos_considered") or len(videos)),
            videos_used=len(videos),
            average_quality_score=round(avg_score, 1),
            confidence=_confidence_label(avg_score),
            concepts_covered=concepts_count,
        ),
        time_to_build_seconds=generation_time,
        source=source,
    )


@router.get("/path/{topic_id:path}", response_model=BuildPathResponse)
async def get_cached_path(
    topic_id: str,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a previously-built learning path from cache without rebuilding."""
    from urllib.parse import unquote
    service = _search_mod.search_service
    if service is None:
        raise HTTPException(status_code=503, detail="Search service not initialized")

    decoded = unquote(topic_id).strip()
    cached = service.cache.get_topic_path(decoded, db=db)
    if not cached:
        # Try the query-mapping layer too (in case topic_id is the original query)
        mapped = service.cache.get_query_mapping(decoded, db=db)
        if mapped:
            cached = service.cache.get_topic_path(mapped, db=db)
    if not cached:
        raise HTTPException(status_code=404, detail=f"No cached path for: {decoded}")

    return _path_to_response(cached, topic_name=decoded, source="cache", generation_time=0)


@router.get("/lookup")
async def lookup(
    q: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cheap pre-build check (NO generation): does a reusable path already exist,
    and has THIS user explored the topic before? Powers the "you've built this
    before" prompt on Explore."""
    from services.cache_service import cache_service
    from models import CachedPath, SearchEvent

    query = q.strip()
    key = query.lower()
    topic_id = cache_service.get_query_mapping(query, db=db)
    cp = None
    if topic_id:
        cp = (
            db.query(CachedPath)
            .filter(CachedPath.topic_id == topic_id, CachedPath.valid.is_(True))
            .first()
        )
    last = None
    try:
        last = (
            db.query(SearchEvent)
            .filter(SearchEvent.user_id == user.id, SearchEvent.query_normalized == key)
            .order_by(SearchEvent.created_at.desc())
            .first()
        )
    except Exception:
        db.rollback()

    return {
        "query": query,
        "exists": bool(cp),
        "topic_id": (cp.topic_id if cp else (topic_id or None)),
        "from_cache": bool(cp),
        "video_count": (cp.video_count if cp else 0),
        "explored_before": bool(last),
        "last_explored_at": (last.created_at.isoformat() if last else None),
    }


@router.get("/history")
async def history(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 20,
):
    """The signed-in user's recently explored topics (most recent first), joined
    to the shared path library for metadata. Lets returning users find what they
    already generated instead of rebuilding it."""
    from sqlalchemy import func
    from models import CachedPath, SearchEvent

    try:
        rows = (
            db.query(
                SearchEvent.query_normalized,
                func.max(SearchEvent.created_at).label("last"),
            )
            .filter(SearchEvent.user_id == user.id)
            .group_by(SearchEvent.query_normalized)
            .order_by(func.max(SearchEvent.created_at).desc())
            .limit(max(1, min(limit, 100)))
            .all()
        )
    except Exception:
        db.rollback()
        rows = []

    out = []
    for qn, last in rows:
        cp = db.query(CachedPath).filter(CachedPath.query_normalized == qn).first()
        out.append({
            "query": qn,
            "topic_id": (cp.topic_id if cp else qn),
            "video_count": (cp.video_count if cp else 0),
            "average_score": (cp.average_score if cp else 0),
            "available": bool(cp and cp.valid),
            "last_explored_at": (last.isoformat() if last else None),
        })
    return {"history": out}


@router.post("/build-path", response_model=BuildPathResponse)
async def build_path(
    payload: BuildPathRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Build (or fetch cached) learning path for a topic query."""
    # Enforce per-hour search rate limit.
    try:
        from services.rate_limiting_service import rate_limiting_service
        plan_type = getattr(user, "tier", "free") or "free"
        rl = rate_limiting_service.check_and_increment(
            str(user.id), "search:build-path", plan_type
        )
        if not rl["allowed"]:
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Search limit reached for your {plan_type.title()} plan. "
                    f"Try again in {rl['retry_after']} seconds or upgrade."
                ),
                headers={
                    "Retry-After": str(rl["retry_after"]),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": rl.get("reset_time", ""),
                },
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"search rate limit check failed (degrading to allowed): {e}")

    service = _search_mod.search_service
    if service is None:
        raise HTTPException(status_code=503, detail="Search service not initialized")

    try:
        result = await service.search_and_build_path(
            query=payload.query.strip(),
            use_cache=payload.use_cache and not payload.force_refresh,
            user_id=str(user.id) if getattr(user, "id", None) else None,
            db=db,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"build_path failed for '{payload.query}'")
        raise HTTPException(status_code=500, detail=f"Search failed: {e}")

    path = result.get("path", {}) or {}
    return _path_to_response(
        path,
        topic_name=payload.query.strip(),
        source=result.get("source", "generated"),
        generation_time=float(result.get("generation_time_seconds") or 0),
        concepts_count=len(result.get("concepts") or []),
    )
