"""School-like dashboard endpoint (NEW-PACKET-F)."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user
from services.dashboard_service import dashboard_service

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/")
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Aggregated school-like dashboard: streak, today's goal, weekly activity,
    performance, milestones, and auto-unlocked achievements."""
    return dashboard_service.get_dashboard(db, current_user.id)
