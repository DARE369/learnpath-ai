import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user
from services.progress_service import progress_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/stats", response_model=dict)
def get_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return progress_service.get_user_stats(db, user_id=current_user.id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception(f"get_stats failed: {e}")
        # Return zeros so the dashboard renders; surfaces "no activity yet"
        # gracefully even if the underlying tables aren't ready yet.
        return {
            "videos_watched": 0,
            "concepts_mastered": 0,
            "hours_learned": 0,
            "courses_started": 0,
            "total_watch_time_seconds": 0,
        }


@router.get("/streak", response_model=dict)
def get_streak(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        streak = progress_service.get_learning_streak(db, user_id=current_user.id)
        return {"streak_days": streak}
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception(f"get_streak failed: {e}")
        return {"streak_days": 0}


@router.get("/weekly-activity", response_model=dict)
def get_weekly_activity(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    activity = progress_service.get_weekly_activity(db, user_id=current_user.id)
    return {"activity": activity}


@router.get("/heatmap", response_model=dict)
def get_heatmap(
    days: int = Query(default=112, ge=7, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = progress_service.get_heatmap_data(db, user_id=current_user.id, days=days)
    return {"data": data}


@router.get("/concepts", response_model=dict)
def get_concepts(
    topic_id: Optional[UUID] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    concepts = progress_service.get_concept_progress(
        db, user_id=current_user.id, topic_id=topic_id
    )
    return {"concepts": concepts, "total": len(concepts)}
