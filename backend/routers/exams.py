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


class MockSubmitBody(BaseModel):
    track_id: str
    answers: Dict[str, str] = {}


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


@router.post("/tracks/{track_id}/mock/start")
async def start_mock(
    track_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start a timed, multi-section mock exam (questions without answers)."""
    try:
        return await svc.start_mock(db, current_user.id, track_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/mock/submit")
def submit_mock(
    body: MockSubmitBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Auto-score a submitted mock exam + record the attempt."""
    try:
        return svc.submit_mock(db, current_user.id, body.track_id, body.answers)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/tracks/{track_id}/build-path")
def build_study_path(
    track_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create an adaptive study path toward this exam (I -> H)."""
    try:
        return svc.build_study_path(db, current_user.id, track_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
