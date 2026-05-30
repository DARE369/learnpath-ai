"""
Auto-remediation endpoints (Packet 3.4).

POST /api/remediation/auto-remediate — user triggers remediation when a
                                       built path has low confidence.
GET  /api/remediation/stats           — admin: success rate, by-tier breakdown.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import services.search_service as _search_mod
from database import get_db
from models import User
from routers.auth import get_current_user
from services.remediation_service import remediation_service

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------- Models ----------

class AutoRemediateRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=200)
    original_score: float = Field(..., ge=0, le=200)
    original_path: Optional[Dict[str, Any]] = None  # opaque; returned as-is in fallback


class NotificationOut(BaseModel):
    state: str
    message: str


class AutoRemediateResponse(BaseModel):
    success: bool
    tier_used: str
    original_score: int
    remediated_score: int
    variant_query: Optional[str] = None
    notification: NotificationOut
    duration_seconds: float
    path: Dict[str, Any]


# ---------- Endpoints ----------

@router.post("/auto-remediate", response_model=AutoRemediateResponse)
async def auto_remediate(
    payload: AutoRemediateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Try Tier 1 (Claude) → Tier 2 (Gemini) → Tier 3 (original) to improve a low-confidence path."""
    service = _search_mod.search_service
    if service is None:
        raise HTTPException(status_code=503, detail="Search service not initialized")

    if not remediation_service.detect_low_confidence(payload.original_score):
        raise HTTPException(
            status_code=400,
            detail=f"Score {payload.original_score} is not below the remediation threshold (60)",
        )

    try:
        result = await remediation_service.auto_remediate(
            query=payload.query.strip(),
            original_score=payload.original_score,
            original_path=payload.original_path or {},
            db=db,
            search_service=service,
            user_id=str(user.id) if getattr(user, "id", None) else None,
        )
    except Exception as e:
        logger.exception(f"Remediation failed for '{payload.query}'")
        raise HTTPException(status_code=500, detail=f"Remediation failed: {e}")

    return AutoRemediateResponse(**result)


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    """Aggregate remediation statistics for admin dashboard."""
    return remediation_service.get_remediation_stats(db)
