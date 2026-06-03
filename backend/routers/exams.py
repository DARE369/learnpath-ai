"""Exam-specific track endpoints (NEW-PACKET-I)."""

from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user
from services.exam_track_service import exam_track_service as svc

router = APIRouter(prefix="/api/exams", tags=["exam-tracks"])


class EnrollBody(BaseModel):
    track_id: str
    target_score: str = ""
    exam_date: Optional[str] = None  # ISO date


class MockBody(BaseModel):
    track_id: str
    overall_percent: int
    section_scores: Dict[str, int] = {}


@router.get("/tracks")
def list_tracks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"tracks": svc.list_tracks(db)}


@router.get("/enrollments")
def my_enrollments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"enrollments": svc.my_enrollments(db, current_user.id)}


@router.post("/enroll")
def enroll(
    body: EnrollBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return svc.enroll(db, current_user.id, body.track_id, body.target_score, body.exam_date)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/mock")
def log_mock(
    body: MockBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return svc.log_mock(db, current_user.id, body.track_id, body.overall_percent, body.section_scores)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/tracks/{track_id}/mocks")
def list_mocks(
    track_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"attempts": svc.list_mocks(db, current_user.id, track_id)}
