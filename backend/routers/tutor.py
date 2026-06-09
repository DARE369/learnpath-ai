"""
AI Tutor API — Lexi.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user
from services.tutor_service import tutor_service

router = APIRouter()
logger = logging.getLogger(__name__)


class StartSessionRequest(BaseModel):
    subject: Optional[str] = None
    topic_id: Optional[str] = None
    video_title: Optional[str] = None
    learning_path_id: Optional[str] = None


class ChatRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1, max_length=1000)
    subject: Optional[str] = None
    topic_title: Optional[str] = None
    video_title: Optional[str] = None


@router.post("/session")
def start_session(
    payload: StartSessionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get or create a tutor session for the current study context.
    Returns session_id to use in subsequent /chat calls.
    """
    session_id = tutor_service.get_or_create_session(
        db,
        user_id=user.id,
        subject=payload.subject,
        topic_id=payload.topic_id,
        video_title=payload.video_title,
        learning_path_id=payload.learning_path_id,
    )
    return {"session_id": session_id}


@router.post("/chat")
async def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Send a message to Lexi and get a Socratic response."""
    # Per-user rate limit: 30 tutor messages per hour (free tier)
    try:
        from services.rate_limiting_service import rate_limiting_service
        plan_type = getattr(user, "tier", "free") or "free"
        rl = rate_limiting_service.check_and_increment(
            str(user.id), "tutor:chat", plan_type
        )
        if not rl["allowed"]:
            raise HTTPException(
                status_code=429,
                detail="You've reached your hourly tutor limit. Upgrade for unlimited access.",
                headers={"Retry-After": str(rl["retry_after"])},
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Tutor rate limit check failed (allowing): {e}")

    try:
        result = await tutor_service.chat(
            db=db,
            user_id=user.id,
            session_id=payload.session_id,
            user_message=payload.message,
            subject=payload.subject,
            topic_title=payload.topic_title,
            video_title=payload.video_title,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Tutor chat failed: {e}")
        raise HTTPException(status_code=500, detail="Tutor unavailable — please try again")


@router.get("/session/{session_id}/history")
def get_history(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Fetch message history for a session."""
    messages = tutor_service.get_history(db, session_id)
    return {"messages": messages, "count": len(messages)}
