"""
Usage limit & rate-limit endpoints (Packet 4.2).

Mounted at /api/usage. All routes require auth.

Thin wrapper over UsageTrackingService and RateLimitingService — no business
logic lives here.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user
from services.usage_tracking_service import usage_tracking_service
from services.rate_limiting_service import rate_limiting_service, ENDPOINT_LIMITS

router = APIRouter()
logger = logging.getLogger(__name__)


class CheckRequest(BaseModel):
    action_type: str  # "watch_video" | "learn_hours" | "answer_question"


@router.get("/current")
def get_current_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Current month's usage + plan limits for the signed-in user."""
    try:
        return usage_tracking_service.get_monthly_usage(db, current_user.id)
    except Exception as e:
        logger.exception(f"get_current_usage failed: {e}")
        raise HTTPException(status_code=500, detail="Could not load usage data")


@router.get("/percentage")
def get_usage_percentage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Compact usage percentages for alert threshold checks."""
    try:
        return usage_tracking_service.get_usage_percentage(db, current_user.id)
    except Exception as e:
        logger.exception(f"get_usage_percentage failed: {e}")
        raise HTTPException(status_code=500, detail="Could not load usage data")


@router.get("/limits")
def get_plan_limits(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The signed-in user's plan limits (video, hours, questions, per-endpoint)."""
    from services.subscription_service import subscription_service
    plan_info = subscription_service.get_user_plan(db, current_user.id)
    plan_type = plan_info.get("plan_type", "free")
    return {
        "plan_type": plan_type,
        "monthly_limits": plan_info.get("limits", {}),
        "endpoint_rate_limits": rate_limiting_service.get_limits_for_plan(plan_type),
    }


@router.post("/check")
def check_action(
    payload: CheckRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Check whether the signed-in user can perform `action_type`.
    Returns {allowed, reason, remaining, upgrade_needed}.
    Safe to call before any action to gate UI elements.
    """
    return usage_tracking_service.check_limit(db, current_user.id, payload.action_type)
