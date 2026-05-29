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

import services.search_service as _search_mod
from models import User
from routers.auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


# ─── Request / response shapes ──────────────────────────────────────────────


class BuildPathRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=200)
    use_cache: bool = True


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


@router.post("/build-path", response_model=BuildPathResponse)
async def build_path(
    payload: BuildPathRequest,
    _user: User = Depends(get_current_user),
):
    """Build (or fetch cached) learning path for a topic query."""
    service = _search_mod.search_service
    if service is None:
        raise HTTPException(status_code=503, detail="Search service not initialized")

    try:
        result = await service.search_and_build_path(
            query=payload.query.strip(),
            use_cache=payload.use_cache,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"build_path failed for '{payload.query}'")
        raise HTTPException(status_code=500, detail=f"Search failed: {e}")

    path = result.get("path", {}) or {}
    videos = path.get("videos", []) or []
    avg_score = float(path.get("average_score") or 0)

    return BuildPathResponse(
        topic_id=path.get("topic_id", ""),
        topic_name=payload.query.strip(),
        learning_path=[_video_to_response(v) for v in videos],
        stats=PathStats(
            videos_found=int(path.get("videos_considered") or len(videos)),
            videos_used=len(videos),
            average_quality_score=round(avg_score, 1),
            confidence=_confidence_label(avg_score),
            concepts_covered=len(result.get("concepts") or []),
        ),
        time_to_build_seconds=float(result.get("generation_time_seconds") or 0),
        source=result.get("source", "generated"),
    )
