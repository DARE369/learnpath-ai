"""Messaging & Communication router — ADMIN-1.5."""

import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user
from services.messaging_service import messaging_service

router = APIRouter(prefix="/api/messaging", tags=["messaging"])
logger = logging.getLogger(__name__)


# ── Request schemas ────────────────────────────────────────────────────────────

class SendMessageRequest(BaseModel):
    content: str
    links: Optional[List[Dict]] = None


class CreateGroupRequest(BaseModel):
    class_id: str
    group_type: str  # at_risk | advanced | custom
    group_criteria: Dict = {}
    custom_student_ids: Optional[List[str]] = None


class SendAnnouncementRequest(BaseModel):
    class_id: str
    title: str
    content: str
    links: Optional[List[Dict]] = None
    scheduled_for: Optional[str] = None


class NotificationPrefRequest(BaseModel):
    email_enabled: Optional[bool] = None
    email_direct_messages: Optional[bool] = None
    email_group_messages: Optional[bool] = None
    email_announcements: Optional[bool] = None
    email_replies: Optional[bool] = None
    email_frequency: Optional[str] = None
    in_app_enabled: Optional[bool] = None
    in_app_direct_messages: Optional[bool] = None
    in_app_group_messages: Optional[bool] = None
    in_app_announcements: Optional[bool] = None
    in_app_replies: Optional[bool] = None


# ── Inbox ──────────────────────────────────────────────────────────────────────

@router.get("/inbox")
def get_inbox(
    search: Optional[str] = None,
    filter_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Teacher's message inbox — conversations + announcements."""
    return messaging_service.get_inbox(
        db, str(current_user.id), search, filter_type, date_from, date_to, page, page_size
    )


# ── Conversations ──────────────────────────────────────────────────────────────

@router.get("/conversations/{conversation_id}")
def get_thread(
    conversation_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a conversation thread (1-on-1 or group)."""
    return messaging_service.get_thread(
        db, str(current_user.id), conversation_id, page, page_size
    )


@router.post("/conversations/{conversation_id}/messages")
def send_message(
    conversation_id: str,
    payload: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a message in a conversation."""
    return messaging_service.send_message(
        db, str(current_user.id), conversation_id, payload.content, payload.links
    )


@router.post("/conversations/direct/{student_id}")
def start_direct(
    student_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get or create a 1-on-1 conversation with a student (teacher only)."""
    if current_user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Teachers only")
    return messaging_service.create_direct_conversation(
        db, str(current_user.id), student_id
    )


@router.post("/conversations/group")
def create_group(
    payload: CreateGroupRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a group conversation for a subset of class members (teacher only)."""
    if current_user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Teachers only")
    return messaging_service.create_group_conversation(
        db,
        str(current_user.id),
        payload.class_id,
        payload.group_type,
        payload.group_criteria,
        payload.custom_student_ids,
    )


@router.post("/conversations/{conversation_id}/typing")
def update_typing(
    conversation_id: str,
    is_typing: bool = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update typing indicator (poll every few seconds while composing)."""
    return messaging_service.update_typing(
        db, str(current_user.id), conversation_id, is_typing
    )


# ── Announcements ──────────────────────────────────────────────────────────────

@router.get("/announcements")
def get_announcements(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Teacher: their sent announcements. Student: announcements for their classes."""
    is_teacher = current_user.role in ("teacher", "admin")
    return messaging_service.get_announcements(
        db, str(current_user.id), is_teacher, page, page_size
    )


@router.post("/announcements")
def send_announcement(
    payload: SendAnnouncementRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create and broadcast an announcement to a class (teacher only)."""
    if current_user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Teachers only")
    return messaging_service.send_announcement(
        db,
        str(current_user.id),
        payload.class_id,
        payload.title,
        payload.content,
        payload.links,
        payload.scheduled_for,
    )


@router.post("/announcements/{announcement_id}/read")
def mark_read(
    announcement_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Student marks an announcement as read."""
    return messaging_service.mark_announcement_read(
        db, announcement_id, str(current_user.id)
    )


@router.post("/announcements/{announcement_id}/acknowledge")
def acknowledge(
    announcement_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Student acknowledges (confirms receipt of) an announcement."""
    return messaging_service.acknowledge_announcement(
        db, announcement_id, str(current_user.id)
    )


# ── Notification preferences ───────────────────────────────────────────────────

@router.get("/notification-preferences")
def get_prefs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current user's notification preferences."""
    return messaging_service.get_preferences(db, str(current_user.id))


@router.put("/notification-preferences")
def set_prefs(
    payload: NotificationPrefRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update notification preferences."""
    return messaging_service.set_preferences(
        db, str(current_user.id), payload.dict(exclude_none=True)
    )
