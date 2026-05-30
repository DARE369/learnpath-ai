import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user
from schemas import (
    SessionStartRequest,
    WatchProgressUpdate,
    AnswerSubmission,
    SessionResponse,
    PathProgressResponse,
)
from services.session_service import session_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/start", response_model=dict, status_code=201)
def start_session(
    payload: SessionStartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        session = session_service.start_session(
            db,
            user_id=current_user.id,
            topic_id=payload.topic_id,
            video_index=payload.video_index,
            youtube_id=payload.youtube_id,
            path_id=payload.path_id,
            video_id=payload.video_id,
        )
        return {
            "session_id": str(session.id),
            "session_number": session.session_number,
            "started_at": session.started_at.isoformat(),
        }
    except Exception as e:
        logger.exception(f"start_session failed: {e}")
        db.rollback()
        # Don't block video viewing on session-tracking failure. Return a stub
        # session_id so the frontend can render; subsequent progress updates
        # to this id will gracefully no-op.
        from uuid import uuid4
        return {
            "session_id": f"stub-{uuid4()}",
            "session_number": 0,
            "started_at": "",
            "stub": True,
        }


@router.put("/progress/{session_id}", response_model=dict)
def update_progress(
    session_id: UUID,
    payload: WatchProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = session_service.update_watch_progress(
        db,
        session_id=session_id,
        user_id=current_user.id,
        watch_percentage=payload.watch_percentage,
        last_position_seconds=payload.last_position_seconds,
        total_watch_time_seconds=payload.total_watch_time_seconds,
        playback_speed=payload.playback_speed,
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "watch_percentage": session.watch_percentage,
        "video_watched": session.video_watched,
        "last_position_seconds": session.last_position_seconds,
    }


@router.post("/answer/{session_id}", response_model=dict)
def submit_answer(
    session_id: UUID,
    payload: AnswerSubmission,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = session_service.submit_answer(
        db,
        session_id=session_id,
        user_id=current_user.id,
        question=payload.question,
        answer=payload.answer,
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "feedback": session.answer_feedback,
        "score": session.answer_score,
        "questions_answered": session.questions_answered,
    }


@router.post("/complete/{session_id}", response_model=dict)
def complete_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = session_service.complete_session(
        db,
        session_id=session_id,
        user_id=current_user.id,
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "completed": True,
        "completed_at": session.completed_at.isoformat(),
        "video_watched": session.video_watched,
        "watch_percentage": session.watch_percentage,
        "total_watch_time_seconds": session.total_watch_time_seconds,
    }


@router.get("/progress/{topic_id}", response_model=PathProgressResponse)
def get_progress(
    topic_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return session_service.get_session_progress(
        db,
        user_id=current_user.id,
        topic_id=topic_id,
    )


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = session_service.get_session_by_id(db, session_id=session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
