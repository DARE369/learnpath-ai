"""
Usage limit checking for subscription plans (Packet 4.2).

Derives all monthly/daily usage from existing event tables (path_sessions,
question_answers) — no separate counter table is needed, so limits auto-reset
at month/day boundaries without a cron job, and the numbers are impossible to
fake from the client.

Design notes:
  - `check_limit`   : sync, returns {allowed, reason, remaining, upgrade_needed}
  - `enforce_limit` : sync, raises LimitExceededError when check_limit says no
  - All usage queries delegate to subscription_service._compute_usage so the
    data stays in one place and auto-derives from the canonical event rows.
  - This service is intentionally thin — plan catalogue lives in
    SubscriptionService.PLANS, not here.
"""

import logging
from datetime import datetime
from typing import Dict, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

_UNLIMITED = 999_999

# Action types recognised by check_limit / enforce_limit.
_ACTION_MAP = {
    "watch_video":    ("limits", "videos_per_month",  "usage", "videos_watched",  "remaining_videos",    "video"),
    "learn_hours":    ("limits", "hours_per_month",   "usage", "hours_learned",   "remaining_hours",     "hour"),
    "answer_question": ("limits", "questions_per_day", "usage", "questions_today", "remaining_questions_today", "question"),
}


class LimitExceededError(Exception):
    """Raised by enforce_limit when the user is over plan quota."""

    def __init__(self, message: str, action_type: str, upgrade_needed: bool = True):
        super().__init__(message)
        self.action_type = action_type
        self.upgrade_needed = upgrade_needed


class UsageTrackingService:

    def check_limit(self, db: Session, user_id, action_type: str) -> Dict:
        """
        Check whether a user can perform `action_type`.

        Returns:
            {
              allowed: bool,
              reason: str,
              remaining: int | float,
              upgrade_needed: bool,
              usage_percentage: float,
            }

        Never raises. Safe to call in a try/except that degrades gracefully.
        """
        if action_type not in _ACTION_MAP:
            return {"allowed": True, "reason": "", "remaining": _UNLIMITED,
                    "upgrade_needed": False, "usage_percentage": 0.0}
        try:
            from services.subscription_service import subscription_service
            plan_info = subscription_service.get_user_plan(db, user_id)
        except Exception as e:
            logger.warning(f"check_limit: get_user_plan failed for {user_id}: {e}")
            # Degrade gracefully — don't block the user on a monitoring failure
            return {"allowed": True, "reason": "", "remaining": _UNLIMITED,
                    "upgrade_needed": False, "usage_percentage": 0.0}

        limits_key, limit_field, usage_key, usage_field, remaining_key, noun = _ACTION_MAP[action_type]
        limit = plan_info.get(limits_key, {}).get(limit_field, _UNLIMITED)
        used  = plan_info.get(usage_key, {}).get(usage_field, 0)
        remaining = plan_info.get(remaining_key, _UNLIMITED)
        pct   = plan_info.get("usage_percentage", {}).get(
            "questions" if action_type == "answer_question" else
            "hours"     if action_type == "learn_hours"    else "videos",
            0.0
        )
        plan_type = plan_info.get("plan_type", "free")

        if limit >= _UNLIMITED:
            return {"allowed": True, "reason": "", "remaining": _UNLIMITED,
                    "upgrade_needed": False, "usage_percentage": 0.0}

        if used >= limit:
            period = "today" if action_type == "answer_question" else "this month"
            return {
                "allowed": False,
                "reason": (
                    f"You've used all {int(limit)} {noun}s allowed {period} on the "
                    f"{plan_type.title()} plan. Upgrade for more."
                ),
                "remaining": 0,
                "upgrade_needed": plan_type != "premium",
                "usage_percentage": 100.0,
            }

        return {
            "allowed": True,
            "reason": "",
            "remaining": remaining,
            "upgrade_needed": False,
            "usage_percentage": pct,
        }

    def enforce_limit(self, db: Session, user_id, action_type: str) -> None:
        """Raise LimitExceededError if the action is not allowed."""
        result = self.check_limit(db, user_id, action_type)
        if not result["allowed"]:
            raise LimitExceededError(
                result["reason"],
                action_type=action_type,
                upgrade_needed=result["upgrade_needed"],
            )

    def get_monthly_usage(self, db: Session, user_id) -> Dict:
        """Full usage response for the /api/usage/current endpoint."""
        from services.subscription_service import subscription_service
        info = subscription_service.get_user_plan(db, user_id)
        now = datetime.utcnow()
        reset_date = datetime(now.year + (now.month == 12), (now.month % 12) + 1, 1)
        return {
            "plan_type": info.get("plan_type", "free"),
            "plan_name": info.get("plan_name", "Free Plan"),
            "videos_watched":      info.get("usage", {}).get("videos_watched", 0),
            "videos_limit":        info.get("limits", {}).get("videos_per_month", _UNLIMITED),
            "videos_percentage":   info.get("usage_percentage", {}).get("videos", 0.0),
            "videos_remaining":    info.get("remaining_videos", _UNLIMITED),
            "hours_learned":       info.get("usage", {}).get("hours_learned", 0),
            "hours_limit":         info.get("limits", {}).get("hours_per_month", _UNLIMITED),
            "hours_percentage":    info.get("usage_percentage", {}).get("hours", 0.0),
            "hours_remaining":     info.get("remaining_hours", _UNLIMITED),
            "questions_today":     info.get("usage", {}).get("questions_today", 0),
            "questions_day_limit": info.get("limits", {}).get("questions_per_day", _UNLIMITED),
            "questions_percentage": info.get("usage_percentage", {}).get("questions", 0.0),
            "questions_remaining": info.get("remaining_questions_today", _UNLIMITED),
            "month": now.strftime("%B %Y"),
            "reset_date": reset_date.strftime("%Y-%m-%d"),
        }

    def get_usage_percentage(self, db: Session, user_id) -> Dict:
        """Compact percentages for quick alert thresholds."""
        info = self.get_monthly_usage(db, user_id)
        videos  = info["videos_percentage"]
        hours   = info["hours_percentage"]
        questions = info["questions_percentage"]
        overall = round((videos + hours + questions) / 3.0, 1)
        return {
            "videos":    videos,
            "hours":     hours,
            "questions": questions,
            "overall":   overall,
        }


usage_tracking_service = UsageTrackingService()
