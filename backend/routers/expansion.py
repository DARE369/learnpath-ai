"""
Self-building expansion endpoints (Packet 3.5).

Admin endpoints are login-required but not role-gated (same documented gap
as 3.2/3.3/3.4). Cost-controlled via the existing `expansion` budget.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from services.cost_tracker import cost_tracker
from services.expansion_service import expansion_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/runs")
def list_runs(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Return the most recent N nightly_expansion runs."""
    return {"items": expansion_service.recent_runs(db, limit=limit)}


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    """Cost stats + today's spend for the expansion/branching budgets."""
    all_stats = cost_tracker.stats()
    return {
        "today_costs": {
            "expansion": all_stats.get("expansion"),
            "branching": all_stats.get("branching"),
        },
    }


@router.get("/popular")
def popular_topics(
    threshold: int = Query(10, ge=1),
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    """Topics with > `threshold` searches in the last `days` days."""
    return {
        "items": expansion_service.identify_popular_topics(
            db, threshold=threshold, days=days
        ),
        "threshold": threshold,
        "lookback_days": days,
    }


@router.get("/aliases")
def list_aliases(
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Active TopicAlias rows (informational — SearchService doesn't consult them yet)."""
    return {"items": expansion_service.list_aliases(db, limit=limit)}


@router.get("/keywords")
def list_keywords(
    topic: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """All indexed keywords grouped by topic. Pass `topic` to filter."""
    return {"items": expansion_service.list_keywords(db, topic=topic)}


@router.post("/run-now")
async def run_now(db: Session = Depends(get_db)):
    """
    Admin manual trigger — runs the nightly job synchronously and returns
    the run summary. Useful for staging or backfill. Works regardless of
    EXPANSION_SCHEDULER_ENABLED.
    """
    try:
        return await expansion_service.run_nightly_job(db)
    except Exception as e:
        logger.exception("Manual run-now failed")
        raise HTTPException(status_code=500, detail=f"Run failed: {e}")
