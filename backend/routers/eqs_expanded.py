"""
Expanded EQS endpoints (Packet 3.3).

Coexists with the legacy /api/eqs/score endpoint — same /api/eqs prefix
but separate sub-paths. Admin endpoints are login-required but not
role-gated (documented gap, same as Packet 3.2).
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from services.cost_tracker import BudgetExceeded, cost_tracker
from services.eqs_expanded_service import (
    InvalidScoreResponse,
    eqs_expanded_service,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------- Models ----------

class ExpandedScoreRequest(BaseModel):
    youtube_id: str = Field(..., min_length=1)
    video_summary: str = Field(..., min_length=10)
    title: str = ""
    transcript_excerpt: str = ""


class ExpandedScoreResponse(BaseModel):
    id: str
    youtube_id: str
    base_scores: dict
    bonus_scores: dict
    base_score: int
    bonus_total: int
    total_score: int
    confidence_level: str
    cache_ttl_days: int
    reasoning: str
    cost_remaining_ngn: float


# ---------- Endpoints ----------

@router.post("/score", response_model=ExpandedScoreResponse)
async def score_expanded(
    payload: ExpandedScoreRequest,
    db: Session = Depends(get_db),
):
    """
    Score a video on the 11-criterion expanded rubric (0-170).
    Budget-gated: returns 429 if today's eqs_expanded budget is spent.
    """
    try:
        result = await eqs_expanded_service.evaluate_video_expanded(
            youtube_id=payload.youtube_id,
            video_summary=payload.video_summary,
            title=payload.title,
            transcript_excerpt=payload.transcript_excerpt,
        )
    except BudgetExceeded as e:
        raise HTTPException(status_code=429, detail=str(e))
    except InvalidScoreResponse as e:
        raise HTTPException(status_code=502, detail=f"Invalid Claude response: {e}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Expanded EQS failed for {payload.youtube_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Expanded EQS scoring failed")

    row = eqs_expanded_service.persist(db, result)

    payload_out = result.to_dict()
    payload_out["id"] = str(row.id)
    payload_out["cost_remaining_ngn"] = cost_tracker.remaining("eqs_expanded")
    return ExpandedScoreResponse(**payload_out)


@router.get("/list")
def list_scores(
    confidence_level: Optional[str] = Query(
        None, pattern="^(poor|acceptable|good|excellent|outstanding)$"
    ),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List active expanded scores, optionally filtered by confidence level."""
    return {
        "items": eqs_expanded_service.list_scores(
            db, confidence_level=confidence_level, limit=limit, offset=offset
        ),
        "limit": limit,
        "offset": offset,
    }


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    """Aggregate stats: distribution, criteria averages, cache TTL distribution."""
    return eqs_expanded_service.stats(db)
