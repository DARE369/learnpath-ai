"""Referral program endpoints (Packet 4.6). Mounted at /api/referral."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user
from services.referral_service import (
    referral_service,
    InvalidReferralCodeError,
    SelfReferralError,
    ReferralAlreadyUsedError,
    MonthlyLimitExceededError,
)

router = APIRouter()
logger = logging.getLogger(__name__)


class ApplyCodeRequest(BaseModel):
    referral_code: str


@router.get("/code")
def get_referral_code(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get (or generate) the signed-in user's referral code."""
    full_name = getattr(current_user, "full_name", "") or ""
    return referral_service.generate_or_get_code(db, current_user.id, full_name)


@router.get("/stats")
def get_referral_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Referral earnings, successful referrals, and list of referrals."""
    return referral_service.get_stats(db, current_user.id)


@router.get("/validate/{code}")
def validate_code(
    code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check whether a referral code is valid for the current user."""
    try:
        return referral_service.validate_code(db, code.upper(), current_user.id)
    except SelfReferralError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ReferralAlreadyUsedError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except InvalidReferralCodeError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/apply")
def apply_referral_code(
    payload: ApplyCodeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Record that the current user signed up via a referral code.
    The reward is applied separately once a paid subscription is confirmed.
    """
    try:
        referral_service.validate_code(db, payload.referral_code.upper(), current_user.id)
        referral_service.record_signup(db, payload.referral_code.upper(), current_user.id)
        return {"applied": True, "code": payload.referral_code.upper()}
    except (InvalidReferralCodeError, SelfReferralError, ReferralAlreadyUsedError) as e:
        raise HTTPException(status_code=400, detail=str(e))
