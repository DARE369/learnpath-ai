"""
Analytics endpoints (Packet 4.5).

Mounted at /api/analytics. All routes require auth.
Platform/revenue/churn/cohort routes are admin-level but use the same
"login required, no role gate" pattern as other admin endpoints in this repo.

All service calls are wrapped in try/except so a DB error never produces a 500
on the analytics dashboard — zeros are returned instead.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user, require_admin
from services.analytics_service import analytics_service

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Personal analytics ────────────────────────────────────────────────────────


@router.get("/user")
def get_user_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Personal analytics for the signed-in user."""
    try:
        return analytics_service.get_user_analytics(db, current_user.id)
    except Exception as e:
        logger.warning(f"get_user_analytics failed: {e}")
        return analytics_service._zero_user_analytics()


# ── Platform / admin analytics ────────────────────────────────────────────────


@router.get("/overview")
def platform_overview(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin/super-admin: one-call platform snapshot — users, revenue, activation,
    health, AI cost fences, and path-library token savings."""
    from sqlalchemy import func
    from models import User as UserModel, CachedPath
    from services.cost_tracker import cost_tracker
    from services.cache_service import cache_service

    def _safe(fn, default):
        try:
            return fn()
        except Exception as e:
            logger.warning(f"overview section failed: {e}")
            try:
                db.rollback()
            except Exception:
                pass
            return default

    users_by_role = _safe(
        lambda: {
            (r or "student"): int(c)
            for r, c in db.query(UserModel.role, func.count(UserModel.id)).group_by(UserModel.role).all()
        },
        {},
    )
    library = _safe(
        lambda: db.query(
            func.count(CachedPath.id),
            func.coalesce(func.sum(CachedPath.times_served), 0),
        ).filter(CachedPath.valid.is_(True)).first(),
        (0, 0),
    )

    return {
        "users_by_role": users_by_role,
        "total_users": sum(users_by_role.values()),
        "platform": _safe(lambda: analytics_service.get_platform_metrics(db), {}),
        "revenue": _safe(lambda: analytics_service.get_revenue_metrics(db), {}),
        "activation": _safe(lambda: analytics_service.get_activation_funnel(db, 30), {}),
        "health": _safe(lambda: analytics_service.get_platform_health(db), {}),
        "ai_budgets": _safe(lambda: cost_tracker.stats(), {}),
        "cache": _safe(lambda: cache_service.get_cache_stats(), {}),
        "path_library": {
            "stored_paths": int(library[0] or 0),
            "served_from_library": int(library[1] or 0),
            "est_generations_saved": int(library[1] or 0),
        },
    }


@router.get("/activation")
def get_activation_funnel(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    days: int = 30,
):
    """Admin: activation/retention funnel (signup → onboarded → path → quiz → return)
    for the cohort that signed up in the last `days`."""
    try:
        return analytics_service.get_activation_funnel(db, days=days)
    except Exception as e:
        logger.warning(f"activation funnel failed: {e}")
        raise HTTPException(status_code=500, detail="Could not compute activation funnel")


@router.get("/platform")
def get_platform_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Platform-wide user and activity metrics."""
    try:
        return analytics_service.get_platform_metrics(db)
    except Exception as e:
        logger.warning(f"get_platform_metrics failed: {e}")
        raise HTTPException(status_code=500, detail="Could not compute platform metrics")


@router.get("/revenue")
def get_revenue_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """MRR, ARPU, users by plan, and 6-month revenue trend."""
    try:
        return analytics_service.get_revenue_metrics(db)
    except Exception as e:
        logger.warning(f"get_revenue_metrics failed: {e}")
        raise HTTPException(status_code=500, detail="Could not compute revenue metrics")


@router.get("/churn")
def get_churn_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Monthly churn rate, cancelled subs, and at-risk users."""
    try:
        return analytics_service.get_churn_metrics(db)
    except Exception as e:
        logger.warning(f"get_churn_metrics failed: {e}")
        raise HTTPException(status_code=500, detail="Could not compute churn metrics")


@router.get("/cohorts")
def get_retention_cohorts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """User cohort retention analysis (last 6 signup months)."""
    try:
        return analytics_service.get_retention_cohorts(db)
    except Exception as e:
        logger.warning(f"get_retention_cohorts failed: {e}")
        return {"cohorts": []}


@router.get("/engagement")
def get_engagement_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Session length, sessions per user, and video completion rate."""
    try:
        return analytics_service.get_engagement_metrics(db)
    except Exception as e:
        logger.warning(f"get_engagement_metrics failed: {e}")
        raise HTTPException(status_code=500, detail="Could not compute engagement metrics")


@router.get("/funnel")
def get_funnel_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Signup → first video → paid conversion funnel."""
    try:
        return analytics_service.get_funnel_metrics(db)
    except Exception as e:
        logger.warning(f"get_funnel_metrics failed: {e}")
        raise HTTPException(status_code=500, detail="Could not compute funnel metrics")


@router.get("/health")
def get_platform_health(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """DB connectivity and cache health."""
    try:
        return analytics_service.get_platform_health(db)
    except Exception as e:
        logger.warning(f"get_platform_health failed: {e}")
        return {"health_score": 0, "db_connected": False}


@router.delete("/cache")
def clear_analytics_cache(
    current_user: User = Depends(get_current_user),
):
    """Admin: flush the analytics in-memory cache."""
    n = analytics_service.invalidate_cache()
    return {"cleared_entries": n}
