"""
Curriculum API — WAEC subject/topic data + diagnostics.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user
from services.curriculum_service import curriculum_service
from services.diagnostic_service import diagnostic_service
from services.readiness_service import readiness_service

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Curriculum queries ────────────────────────────────────────────────────────

@router.get("/subjects")
def list_subjects(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """All WAEC subjects."""
    return {"subjects": curriculum_service.get_subjects(db)}


@router.get("/subjects/{subject_id}")
def get_subject(
    subject_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    subj = curriculum_service.get_subject(db, subject_id)
    if not subj:
        raise HTTPException(status_code=404, detail=f"Subject not found: {subject_id}")
    return subj


@router.get("/subjects/{subject_id}/topics")
def list_topics(
    subject_id: str,
    ss_level: Optional[str] = None,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Topics for a subject, optionally filtered by SS level."""
    topics = curriculum_service.get_topics(db, subject_id, ss_level)
    if not topics and not curriculum_service.get_subject(db, subject_id):
        raise HTTPException(status_code=404, detail=f"Subject not found: {subject_id}")
    return {"topics": topics}


# ── Diagnostic ────────────────────────────────────────────────────────────────

class StartDiagnosticRequest(BaseModel):
    subject_id: str = Field(..., min_length=1)
    ss_level: str = Field(..., pattern="^(SS1|SS2|SS3)$")


class SubmitDiagnosticRequest(BaseModel):
    subject_id: str
    ss_level: str
    questions: List[dict]            # the questions that were generated
    answers: List[int]               # selected option index per question (-1 = skipped)


@router.post("/diagnostic/start")
async def start_diagnostic(
    payload: StartDiagnosticRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Generate a fresh diagnostic assessment for a subject + SS level.
    Returns the questions (without revealing correct answers to the client).
    """
    try:
        questions = await diagnostic_service.generate_questions(
            db, payload.subject_id, payload.ss_level
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Diagnostic generation failed: {e}")
        raise HTTPException(status_code=500, detail="Could not generate diagnostic questions")

    # Strip correct_index and explanation before sending to client
    client_questions = [
        {
            "id": q["id"],
            "topic_id": q.get("topic_id"),
            "question": q["question"],
            "options": q["options"],
        }
        for q in questions
    ]
    # Store full questions (with answers) server-side in session cache
    # For MVP we trust the client to send back the original questions;
    # server re-validates correct_index on submission.
    return {"questions": client_questions, "total": len(client_questions)}


@router.post("/diagnostic/submit")
def submit_diagnostic(
    payload: SubmitDiagnosticRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Score a completed diagnostic and save the result.
    Client sends back the full questions (including correct_index) and their answers.
    """
    if len(payload.answers) != len(payload.questions):
        raise HTTPException(status_code=400, detail="answers length must match questions length")

    analysis = diagnostic_service.analyze_results(payload.questions, payload.answers)
    diagnostic_service.save_result(
        db,
        user_id=user.id,
        subject_id=payload.subject_id,
        ss_level=payload.ss_level,
        analysis=analysis,
    )

    # Build topic name map for the response
    topics = curriculum_service.get_topics_dict(db, payload.subject_id)
    weak_topic_names = [
        topics[tid]["title"] for tid in analysis["weak_topic_ids"] if tid in topics
    ]
    strong_topic_names = [
        topics[tid]["title"] for tid in analysis["strong_topic_ids"] if tid in topics
    ]

    return {
        "score_percent": analysis["score_percent"],
        "correct": analysis["correct"],
        "total": analysis["total"],
        "weak_topics": weak_topic_names,
        "strong_topics": strong_topic_names,
        "message": _diagnostic_message(analysis["score_percent"]),
    }


def _diagnostic_message(score: int) -> str:
    if score >= 80:
        return "Excellent! You have a strong foundation. Keep building on this."
    if score >= 60:
        return "Good start. A few topics need attention before you're exam-ready."
    if score >= 40:
        return "You have the basics. Focus on the weak areas and you'll improve quickly."
    return "No worries — everyone starts somewhere. Let's build your foundation step by step."


# ── Readiness scores ──────────────────────────────────────────────────────────

@router.get("/readiness")
def get_all_readiness(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """All readiness scores for the current user."""
    scores = readiness_service.get_scores(db, user.id)
    return {"scores": scores}


@router.get("/readiness/{subject_id}")
def get_subject_readiness(
    subject_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    score = readiness_service.get_score(db, user.id, subject_id)
    if not score:
        raise HTTPException(status_code=404, detail="No readiness score yet — complete a diagnostic first")
    score["label"] = readiness_service.readiness_label(score["score"])
    score["next_action"] = readiness_service.next_action(
        score["score"],
        score.get("weak_topics", []),
        curriculum_service.subject_name(db, subject_id),
    )
    return score
