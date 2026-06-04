"""Adaptive learning path endpoints (NEW-PACKET-H)."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user, require_admin
from services.adaptive_path_service import adaptive_path_service as svc

router = APIRouter(prefix="/api/adaptive-paths", tags=["adaptive-paths"])


class CreateBody(BaseModel):
    goal_concept_id: str
    target_weeks: int = 12


class CompleteBody(BaseModel):
    score: Optional[int] = None


@router.post("/")
def create_path(
    body: CreateBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return svc.create_path(db, current_user.id, body.goal_concept_id, body.target_weeks)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/")
def list_paths(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"paths": svc.list_paths(db, current_user.id)}


@router.get("/{path_id}")
def get_path(
    path_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return svc.get_path(db, path_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{path_id}/modules/{module_id}/complete")
def complete_module(
    path_id: str,
    module_id: str,
    body: CompleteBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return svc.complete_module(db, path_id, module_id, current_user.id, body.score)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{path_id}/adapt")
def adapt_path(
    path_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return svc.adapt_path(db, path_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/run-adaptation")
def run_adaptation(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin: run the daily auto-adaptation pass now (also runs on a daily cron)."""
    return {"adapted_paths": svc.adapt_due_paths(db)}
