"""School-like dashboard endpoint (NEW-PACKET-F)."""

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user
from services.dashboard_service import dashboard_service

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])
logger = logging.getLogger(__name__)


@router.get("/")
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Aggregated school-like dashboard: streak, today's goal, weekly activity,
    performance, milestones, and auto-unlocked achievements."""
    return dashboard_service.get_dashboard(db, current_user.id)


@router.get("/recommendations")
def get_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """In-progress and suggested courses for the RecommendedCourses section."""
    try:
        courses = dashboard_service.get_recommendations(db, current_user.id)
        return {"courses": courses}
    except Exception as e:
        logger.exception(f"get_recommendations failed: {e}")
        return {"courses": []}


@router.get("/activity")
def get_activity(
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Paginated activity feed for RecentActivity and the /activity page."""
    try:
        activities = dashboard_service.get_activity(db, current_user.id, limit=limit, offset=offset)
        return {"activities": activities}
    except Exception as e:
        logger.exception(f"get_activity failed: {e}")
        return {"activities": []}


@router.get("/progress")
def get_topics_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Completed / in-progress / not-started topic counts for TopicsChart."""
    try:
        return dashboard_service.get_topics_progress(db, current_user.id)
    except Exception as e:
        logger.exception(f"get_topics_progress failed: {e}")
        return {"completed": 0, "inProgress": 0, "notStarted": 0}
