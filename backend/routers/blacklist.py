"""
Blacklist & video quality control endpoints (Packet 3.2).

Admin endpoints are UNGATED for MVP — there's no admin role on User yet.
Documented gap in docs/BLACKLIST_SYSTEM.md.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from services.blacklist_service import blacklist_service
from services.eqs_service import EQSService

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------- Models ----------

class BlacklistCreateRequest(BaseModel):
    youtube_id: str = Field(..., min_length=1)
    reason: str = Field(..., min_length=1)
    blacklist_type: str = Field("soft", pattern="^(soft|hard)$")
    last_score: Optional[int] = None


class BlacklistCreateResponse(BaseModel):
    youtube_id: str
    blacklist_type: str
    blacklist_date: str
    retry_date: Optional[str] = None


class ConvertTypeRequest(BaseModel):
    blacklist_type: str = Field(..., pattern="^(soft|hard)$")
    reason: Optional[str] = None


class FeedbackRequest(BaseModel):
    youtube_id: str = Field(..., min_length=1)
    rating: int = Field(..., ge=1, le=5)
    feedback: Optional[str] = None
    helpful: Optional[bool] = None
    user_id: Optional[str] = None


# ---------- Endpoints ----------

@router.post("", response_model=BlacklistCreateResponse)
def create_blacklist(
    payload: BlacklistCreateRequest,
    db: Session = Depends(get_db),
):
    """Manually blacklist a video (admin)."""
    try:
        result = blacklist_service.blacklist_video(
            db,
            youtube_id=payload.youtube_id,
            reason=payload.reason,
            blacklist_type=payload.blacklist_type,
            last_score=payload.last_score,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return BlacklistCreateResponse(**result)


@router.delete("/{youtube_id}")
def delete_blacklist(youtube_id: str, db: Session = Depends(get_db)):
    """Lift the blacklist for a video (admin)."""
    lifted = blacklist_service.remove_blacklist(db, youtube_id)
    if not lifted:
        raise HTTPException(status_code=404, detail="No active blacklist for that video")
    return {"youtube_id": youtube_id, "is_blacklisted": False}


@router.patch("/{youtube_id}")
def convert_blacklist(
    youtube_id: str,
    payload: ConvertTypeRequest,
    db: Session = Depends(get_db),
):
    """Convert a blacklist between soft and hard (admin)."""
    try:
        return blacklist_service.convert_type(
            db, youtube_id, payload.blacklist_type, payload.reason
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/status/{youtube_id}")
def get_status(youtube_id: str, db: Session = Depends(get_db)):
    """Return current blacklist status for a video."""
    return blacklist_service.get_status(db, youtube_id)


@router.get("")
def list_blacklist(
    blacklist_type: Optional[str] = Query(None, pattern="^(soft|hard)$"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List active blacklisted videos (admin). Filter by type."""
    return {
        "items": blacklist_service.list_blacklist(
            db, blacklist_type=blacklist_type, limit=limit, offset=offset
        ),
        "limit": limit,
        "offset": offset,
    }


@router.post("/auto-blacklist-low-scores")
def auto_blacklist(
    score_threshold: int = Query(65, ge=0, le=200),
    db: Session = Depends(get_db),
):
    """
    Admin: batch-scan video_scores and create soft-blacklist rows for any
    youtube_id with EQS below the threshold and no active blacklist.
    """
    return blacklist_service.auto_blacklist_low_scores(db, score_threshold)


@router.post("/re-evaluate")
async def re_evaluate(
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """
    Admin: re-score expired soft-blacklist rows via EQS. Lift if score ≥ 65,
    otherwise extend retry_date by 90 days. Budget-gated via cost_tracker.
    """
    return await blacklist_service.re_evaluate_blacklist(
        db, eqs_service=EQSService(), limit=limit
    )


@router.post("/feedback")
def submit_feedback(
    payload: FeedbackRequest,
    db: Session = Depends(get_db),
):
    """Submit feedback on a shadow-tested video."""
    try:
        return blacklist_service.submit_feedback(
            db,
            youtube_id=payload.youtube_id,
            rating=payload.rating,
            feedback=payload.feedback,
            helpful=payload.helpful,
            user_id=payload.user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    """Admin: aggregate counts and average feedback rating."""
    return blacklist_service.stats(db)


@router.get("/shadow-test/{user_id}")
def shadow_test_check(user_id: str):
    """Diagnostic: does this user_id fall in the shadow-test slice?"""
    return {
        "user_id": user_id,
        "is_shadow_tester": blacklist_service.should_shadow_test(user_id),
    }
