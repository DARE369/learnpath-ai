"""
Feature unlock endpoints (Packet 4.4).

Mounted at /api/features. All routes require auth except
GET /api/features/plan/{plan_type} (public — used by the pricing page).

Complements /api/free-tier/features (single-feature check) with richer
per-plan summaries, full feature info, and promo payloads.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user
from services.feature_unlock_service import feature_unlock_service

router = APIRouter()
logger = logging.getLogger(__name__)


class LogUsageRequest(BaseModel):
    action: str = "viewed"  # "viewed" | "used" | "purchased"


# ── Feature checks ────────────────────────────────────────────────────────────


@router.get("/check/{feature_name}")
def check_feature(
    feature_name: str,
    current_user: User = Depends(get_current_user),
):
    """
    Check whether the signed-in user can access a named feature.
    Returns {available, min_plan_required, upgrade_cost_monthly, ...}.
    """
    plan_type = getattr(current_user, "tier", "free") or "free"
    return feature_unlock_service.check_feature(plan_type, feature_name)


@router.get("/available")
def get_available_features(
    current_user: User = Depends(get_current_user),
):
    """
    Return the signed-in user's full feature summary:
    {available_features, locked_features, limits}.
    """
    plan_type = getattr(current_user, "tier", "free") or "free"
    return feature_unlock_service.get_features_for_plan(plan_type)


# ── Plan comparisons (public) ─────────────────────────────────────────────────


@router.get("/plan/{plan_type}")
def get_plan_features(plan_type: str):
    """
    Public: feature matrix for a specific plan.
    Used by the pricing/comparison page — no auth required.
    """
    if plan_type not in ("free", "pro", "premium"):
        raise HTTPException(status_code=400, detail=f"Unknown plan: {plan_type}")
    return feature_unlock_service.get_features_for_plan(plan_type)


# ── Feature info & promos ─────────────────────────────────────────────────────


@router.get("/info/{feature_name}")
def get_feature_info(
    feature_name: str,
    current_user: User = Depends(get_current_user),
):
    """
    Detailed info about a feature: description, benefits, required plan.
    Returns the promo payload used by FeatureLock component.
    """
    promo = feature_unlock_service.show_feature_promo(feature_name)
    if promo is None:
        raise HTTPException(status_code=404, detail=f"Unknown feature: {feature_name}")
    return promo


@router.get("/all")
def get_all_features(
    current_user: User = Depends(get_current_user),
):
    """Full feature info catalogue — used by the FeatureMatrix component."""
    return {"features": feature_unlock_service.get_all_feature_info()}


# ── Usage logging ─────────────────────────────────────────────────────────────


@router.post("/{feature_name}/log")
def log_feature_usage(
    feature_name: str,
    payload: LogUsageRequest,
    current_user: User = Depends(get_current_user),
):
    """Log a feature view/use event (best-effort; never fails the caller)."""
    try:
        feature_unlock_service.log_feature_usage(
            str(current_user.id), feature_name, payload.action
        )
    except Exception as e:
        logger.warning(f"log_feature_usage failed silently: {e}")
    return {"logged": True}
