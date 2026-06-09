import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import QuestionAnswer, User
from routers.auth import get_current_user
from services.question_service import question_service

router = APIRouter()
logger = logging.getLogger(__name__)


# ─── Request schemas ──────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    video_summary: str = Field(..., min_length=1)
    concept_name: str = Field(..., min_length=1)
    difficulty: str = Field(default="medium")


class EvaluateRequest(BaseModel):
    question: str = Field(..., min_length=1)
    correct_answer: str = Field(..., min_length=1)
    student_answer: str = Field(..., min_length=1)
    difficulty: str = Field(default="medium")
    # Optional — when present, the answer is recorded against the concept's
    # mastery score so /api/progress/concepts reflects real progress.
    concept_name: str = Field(default="")
    topic_id: str = Field(default="")


class ScheduleRequest(BaseModel):
    concept_name: str = Field(..., min_length=1)
    is_correct: bool
    times_reviewed: int = Field(default=0, ge=0)


class ExplanationRequest(BaseModel):
    answer: str = Field(..., min_length=1)
    concept_name: str = Field(..., min_length=1)


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/generate")
async def generate_question(
    payload: GenerateRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        return await question_service.generate_question(
            video_summary=payload.video_summary,
            concept_name=payload.concept_name,
            difficulty=payload.difficulty,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Question generation failed: {e}")
        raise HTTPException(status_code=500, detail="Question generation failed")


@router.post("/evaluate")
async def evaluate_answer(
    payload: EvaluateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Enforce per-day question-evaluation rate limit.
    try:
        from services.rate_limiting_service import rate_limiting_service
        plan_type = getattr(current_user, "tier", "free") or "free"
        rl = rate_limiting_service.check_and_increment(
            str(current_user.id), "questions:evaluate", plan_type
        )
        if not rl["allowed"]:
            raise HTTPException(
                status_code=429,
                detail="Daily question limit reached. Upgrade your plan for more questions.",
                headers={
                    "Retry-After": str(rl["retry_after"]),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": rl.get("reset_time", ""),
                },
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"question rate limit check failed (degrading to allowed): {e}")

    try:
        result = await question_service.evaluate_answer(
            question=payload.question,
            correct_answer=payload.correct_answer,
            student_answer=payload.student_answer,
            difficulty=payload.difficulty,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Answer evaluation failed: {e}")
        raise HTTPException(status_code=500, detail="Answer evaluation failed")

    # Record against concept mastery when concept_name + topic_id are supplied.
    if payload.concept_name and payload.topic_id:
        try:
            import uuid as _uuid
            from services.session_service import session_service
            topic_uuid = _uuid.UUID(payload.topic_id)
            session_service.update_concept_progress(
                db=db,
                user_id=current_user.id,
                topic_id=topic_uuid,
                concept_name=payload.concept_name.strip(),
                correct=bool(result.get("is_correct", False)),
            )
        except Exception as e:
            logger.warning(f"Concept progress update failed (non-fatal): {e}")

    return result


@router.post("/schedule")
async def schedule_review(
    payload: ScheduleRequest,
    current_user: User = Depends(get_current_user),
):
    return question_service.schedule_next_review(
        concept_name=payload.concept_name,
        is_correct=payload.is_correct,
        times_reviewed=payload.times_reviewed,
    )


@router.get("/due/{user_id}")
async def get_due_reviews(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    due = (
        db.query(QuestionAnswer)
        .filter(
            QuestionAnswer.user_id == current_user.id,
            QuestionAnswer.next_review_at <= now,
        )
        .all()
    )
    return [
        {
            "concept_name": q.concept_name,
            "question": q.question,
            "times_reviewed": q.times_reviewed,
            "next_review_at": q.next_review_at.isoformat() if q.next_review_at else None,
        }
        for q in due
    ]


@router.post("/explanation")
async def get_explanation(
    payload: ExplanationRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        explanation = await question_service.get_conceptual_explanation(
            answer=payload.answer,
            concept=payload.concept_name,
        )
        return {"explanation": explanation}
    except Exception as e:
        logger.error(f"Explanation generation failed: {e}")
        raise HTTPException(status_code=500, detail="Explanation generation failed")
