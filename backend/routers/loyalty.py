"""Loyalty points and tier endpoints (Packet 4.6). Mounted at /api/loyalty."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user
from services.loyalty_service import (
    loyalty_service,
    InsufficientPointsError,
    InvalidRewardError,
    TIERS,
    POINT_AWARDS,
    REDEMPTION_OPTIONS,
)

router = APIRouter()
logger = logging.getLogger(__name__)


class RedeemRequest(BaseModel):
    points_amount: int = Field(..., gt=0)
    reward_type: str


class ApplyRewardCodeRequest(BaseModel):
    code: str


@router.get("/status")
def get_loyalty_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Full loyalty status: points, tier, available rewards, history."""
    try:
        return loyalty_service.get_status(db, current_user.id)
    except Exception as e:
        logger.exception(f"get_loyalty_status failed: {e}")
        raise HTTPException(status_code=500, detail="Could not load loyalty status")


@router.get("/tiers")
def get_all_tiers():
    """Public: tier catalogue with thresholds, multipliers, and benefits."""
    return {
        "tiers": {
            name: {
                "name": cfg["name"],
                "min_lifetime_points": cfg["min_lifetime_points"],
                "multiplier": cfg["multiplier"],
                "benefits": cfg["benefits"],
            }
            for name, cfg in TIERS.items()
        },
        "point_awards": POINT_AWARDS,
        "redemption_options": REDEMPTION_OPTIONS,
    }


@router.post("/redeem")
def redeem_points(
    payload: RedeemRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Redeem points for a reward code."""
    try:
        return loyalty_service.redeem_points(
            db, current_user.id, payload.points_amount, payload.reward_type
        )
    except InsufficientPointsError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except InvalidRewardError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reward-code/apply")
def apply_reward_code(
    payload: ApplyRewardCodeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a reward code as used. Discount applied at next renewal."""
    return loyalty_service.apply_reward_code(db, current_user.id, payload.code)
