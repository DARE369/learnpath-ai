"""
Learner Profile & Onboarding routes (NEW-PACKET-A).

All routes require Bearer token auth.  Endpoints:
  GET  /api/learner/profile                  — get or create profile
  POST /api/learner/onboarding/{step}        — save a single onboarding step (1-6)
  POST /api/learner/calculate-pace           — recalculate required hrs/week
  POST /api/learner/placement-test/start     — begin adaptive placement test
  POST /api/learner/placement-test/answer    — submit one answer, get next Q
  POST /api/learner/re-profile               — quarterly re-profile
"""

from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user
from models import User
from services.learner_profile_service import learner_profile_service

router = APIRouter(prefix="/api/learner", tags=["learner-profile"])
logger = logging.getLogger(__name__)


@router.get("/profile")
def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = learner_profile_service.get_or_create_profile(db, current_user.id)
    return learner_profile_service.profile_to_dict(profile)


@router.post("/onboarding/{step}")
def save_onboarding_step(
    step: int,
    data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if step < 1 or step > 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Step must be 1-6")
    return learner_profile_service.save_step(db, current_user.id, step, data)


@router.post("/calculate-pace")
def calculate_pace(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pace = learner_profile_service.get_pace(db, current_user.id)
    if not pace:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete steps 1 and 3 before calculating pace"
        )
    return pace


@router.post("/placement-test/start")
def start_placement_test(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return learner_profile_service.start_placement_test(db, current_user.id)


@router.post("/placement-test/answer")
def answer_placement_question(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    test_id = payload.get("test_id")
    question_id = payload.get("question_id")
    user_answer = payload.get("answer", "")
    if not test_id or not question_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="test_id and question_id required")
    return learner_profile_service.answer_placement_question(
        db, current_user.id, test_id, question_id, user_answer
    )


@router.post("/re-profile")
def re_profile(
    updated_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return learner_profile_service.re_profile(db, current_user.id, updated_data)
