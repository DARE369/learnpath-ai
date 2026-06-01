"""
Free tier experience endpoints (Packet 4.3).

Mounted at /api/free-tier. All routes require auth. Routes that return ads or
prompts silently return empty/null for paid users so the frontend can call them
unconditionally.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user
from services.ad_service import ad_service
from services.free_tier_service import free_tier_service

router = APIRouter()
logger = logging.getLogger(__name__)


class FeatureCheckRequest(BaseModel):
    feature_name: str


# ── Ads ──────────────────────────────────────────────────────────────────────


@router.get("/ads/{placement}")
def get_ad(
    placement: str,
    current_user: User = Depends(get_current_user),
):
    """
    Get a rotating upgrade CTA for the given placement.
    Returns null for paid users (they see no ads).
    """
    plan_type = getattr(current_user, "tier", "free") or "free"
    if not free_tier_service.shows_ads(plan_type):
        return {"ad": None}
    ad = ad_service.get_ad_for_placement(placement, user_id=str(current_user.id))
    return {"ad": ad}


# ── Upgrade prompts ───────────────────────────────────────────────────────────


@router.get("/upgrade-prompt/{context}")
def get_upgrade_prompt(
    context: str,
    current_user: User = Depends(get_current_user),
):
    """
    Get an upgrade prompt payload for the given context.
    Returns {show_prompt: false} for paid users.
    """
    plan_type = getattr(current_user, "tier", "free") or "free"
    return free_tier_service.get_upgrade_prompt(context, plan_type)


# ── Features ─────────────────────────────────────────────────────────────────


@router.get("/features")
def get_features(
    current_user: User = Depends(get_current_user),
):
    """Full feature availability map for the user's current plan."""
    plan_type = getattr(current_user, "tier", "free") or "free"
    return {
        "plan_type": plan_type,
        "features": free_tier_service.get_all_features(plan_type),
    }


@router.post("/features/check")
def check_feature(
    payload: FeatureCheckRequest,
    current_user: User = Depends(get_current_user),
):
    """Check whether a specific feature is available for the user's plan."""
    plan_type = getattr(current_user, "tier", "free") or "free"
    return free_tier_service.check_feature(plan_type, payload.feature_name)


# ── Success stories ───────────────────────────────────────────────────────────


@router.get("/success-stories")
def get_success_stories(
    count: int = Query(default=3, ge=1, le=10),
    current_user: User = Depends(get_current_user),
):
    """Random success stories for the motivational widget."""
    return {"stories": free_tier_service.get_success_stories(count=count)}
