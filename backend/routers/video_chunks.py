"""
Video Chunking routes (NEW-PACKET-B).

All endpoints addressed by youtube_id (the natural key used throughout the
system) so the frontend never needs a separate video UUID lookup.

  POST /api/chunks/{youtube_id}/generate   — trigger chunking (idempotent)
  GET  /api/chunks/{youtube_id}            — return existing chunks + quizzes
  GET  /api/chunks/detail/{chunk_id}       — single chunk with user progress
  POST /api/chunks/detail/{chunk_id}/progress — save watching + quiz result
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from routers.auth import get_current_user
from models import User, Video, VideoChunk
from services.video_chunking_service import video_chunking_service

router = APIRouter(prefix="/api/chunks", tags=["video-chunks"])
logger = logging.getLogger(__name__)


def _get_or_create_video(db: Session, youtube_id: str) -> Video:
    """Return the Video row for this youtube_id, creating a stub if absent."""
    video = db.query(Video).filter(Video.youtube_id == youtube_id).first()
    if not video:
        video = Video(youtube_id=youtube_id, title=f"Video {youtube_id}")
        db.add(video)
        db.commit()
        db.refresh(video)
    return video


@router.post("/{youtube_id}/generate", status_code=status.HTTP_202_ACCEPTED)
def generate_chunks(
    youtube_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Trigger AI chunking for a YouTube video.  Returns immediately;
    chunks appear at GET /api/chunks/{youtube_id} once processing completes.
    Idempotent — re-requesting a video that is already chunked returns
    status 'ready' with existing chunks.
    """
    video = _get_or_create_video(db, youtube_id)

    # Check if already chunked
    existing = db.query(VideoChunk).filter(VideoChunk.video_id == video.id).count()
    if existing:
        return {"status": "already_chunked", "youtube_id": youtube_id}

    # Run in background so the HTTP response returns quickly
    background_tasks.add_task(
        video_chunking_service.chunk_video,
        db=db,
        youtube_id=youtube_id,
        video_db_id=str(video.id),
    )
    return {"status": "chunking_started", "youtube_id": youtube_id}


@router.get("/{youtube_id}")
def get_chunks(
    youtube_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all chunks (with quizzes) for a video.

    If no chunks exist yet, triggers synchronous chunking so the caller
    doesn't need a separate generate step (convenient for the first load).
    """
    video = _get_or_create_video(db, youtube_id)
    chunks = (
        db.query(VideoChunk)
          .filter(VideoChunk.video_id == video.id)
          .order_by(VideoChunk.chunk_number)
          .all()
    )

    if chunks:
        return {
            "youtube_id": youtube_id,
            "status": "ready",
            "chunk_count": len(chunks),
            "chunks": [video_chunking_service._chunk_dict(c, db) for c in chunks],
        }

    # Not yet chunked — run synchronously (blocking, ~10-30s) and return result
    result = video_chunking_service.chunk_video(db, youtube_id, str(video.id))
    return {
        "youtube_id": youtube_id,
        **result,
    }


@router.get("/detail/{chunk_id}")
def get_chunk_detail(
    chunk_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Single chunk with its quiz and the user's progress."""
    data = video_chunking_service.get_chunk_with_progress(db, chunk_id, str(current_user.id))
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chunk not found")
    return data


@router.post("/detail/{chunk_id}/progress")
def save_chunk_progress(
    chunk_id: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save how much the user watched and their optional quiz score."""
    watched_seconds = int(payload.get("watched_seconds", 0))
    quiz_score: Optional[int] = payload.get("quiz_score")
    return video_chunking_service.save_progress(
        db, chunk_id, str(current_user.id), watched_seconds, quiz_score
    )
