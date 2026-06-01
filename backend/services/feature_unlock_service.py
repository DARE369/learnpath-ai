"""
Feature unlock system (Packet 4.4).

Extends the feature availability map in free_tier_service with:
  - FEATURE_INFO   — human-readable details and per-feature benefit lists
  - get_features_for_plan   — full plan summary: available, locked, limits
  - show_feature_promo      — detailed promo payload for a locked feature
  - log_feature_usage       — lightweight usage signal (no DB table at MVP)

Delegates all availability logic to FreeTierService.check_feature so the
feature matrix stays in one place and there is no duplication.
"""

import logging
from typing import Dict, List, Optional

from services.free_tier_service import free_tier_service, FEATURE_MAP

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Per-feature metadata — used by FeatureLock UI and promo payloads
# ──────────────────────────────────────────────────────────────────────────────

FEATURE_INFO: Dict[str, Dict] = {
    "browse_courses": {
        "name": "Browse Courses",
        "description": "Explore AI-curated learning paths on any topic.",
        "min_plan": "free",
        "benefits": ["Search any topic", "See AI-built paths", "Preview content"],
    },
    "watch_videos": {
        "name": "Watch Videos",
        "description": "Stream quality-scored educational videos.",
        "min_plan": "free",
        "benefits": ["Up to 10 videos/month on Free", "100 on Pro", "Unlimited on Premium"],
    },
    "view_progress": {
        "name": "Progress Dashboard",
        "description": "Track your learning stats, streaks, and mastery.",
        "min_plan": "free",
        "benefits": ["Videos watched", "Hours learned", "Streak tracking"],
    },
    "answer_questions": {
        "name": "Active Recall",
        "description": "Answer AI-generated questions after each video.",
        "min_plan": "free",
        "benefits": ["5 questions/day on Free", "20 on Pro", "Unlimited on Premium"],
    },
    "concept_branching": {
        "name": "Concept Branching",
        "description": "Split any concept into progressive learning branches.",
        "min_plan": "free",
        "benefits": ["3–5 branches per concept", "Progressive difficulty", "Prerequisite mapping"],
    },
    "offline_download": {
        "name": "Offline Download",
        "description": "Download videos to watch without an internet connection.",
        "min_plan": "pro",
        "benefits": ["Watch anywhere", "Save mobile data", "No buffering"],
    },
    "advanced_questions": {
        "name": "Advanced Questions",
        "description": "Deeper, more challenging questions with detailed explanations.",
        "min_plan": "pro",
        "benefits": ["Higher difficulty", "Detailed feedback", "Better retention"],
    },
    "ad_free": {
        "name": "Ad-Free Experience",
        "description": "Learn without upgrade banners or promotional interruptions.",
        "min_plan": "pro",
        "benefits": ["Zero distractions", "Full focus", "Cleaner interface"],
    },
    "custom_paths": {
        "name": "Custom Learning Paths",
        "description": "Build and share your own curated learning paths.",
        "min_plan": "premium",
        "benefits": ["Mix any topics", "Share with others", "Save your curation"],
    },
    "certificate_generation": {
        "name": "Certificates",
        "description": "Generate a certificate of completion for any course.",
        "min_plan": "premium",
        "benefits": ["Shareable PDF", "LinkedIn ready", "Verified by LearnPath AI"],
    },
    "priority_support": {
        "name": "Priority Support",
        "description": "Skip the queue — get help within 4 hours.",
        "min_plan": "premium",
        "benefits": ["4-hour response SLA", "Dedicated channel", "Human support"],
    },
    "search_build_path": {
        "name": "AI Search",
        "description": "Build full learning paths from a single search query.",
        "min_plan": "free",
        "benefits": ["2 searches/hr on Free", "10/hr on Pro", "Unlimited on Premium"],
    },
}

# Plan → NGN price (mirrors subscription_service.PLANS — source of truth stays there)
_PLAN_PRICES: Dict[str, int] = {"free": 0, "pro": 2999, "premium": 9999}
_PLAN_RANK = {"free": 0, "pro": 1, "premium": 2}


class FeatureUnlockService:

    # ── Core availability ─────────────────────────────────────────────────────

    def check_feature(self, plan_type: str, feature_name: str) -> Dict:
        """
        Check whether `feature_name` is available for `plan_type`.

        Delegates to FreeTierService and enriches the result with the
        upgrade cost and benefit list from FEATURE_INFO.
        """
        result = free_tier_service.check_feature(plan_type, feature_name)
        info = FEATURE_INFO.get(feature_name, {})
        required_plan = result.get("suggested_plan") or info.get("min_plan") or "free"
        upgrade_cost = _PLAN_PRICES.get(required_plan, 0)
        return {
            **result,
            "feature_name": feature_name,
            "user_plan": (plan_type or "free").lower(),
            "min_plan_required": required_plan,
            "upgrade_cost_monthly": upgrade_cost,
            "upgrade_cost_yearly": upgrade_cost * 10,  # 10 months for 12
            "upgrade_benefit": (
                info.get("description", "")
                if not result.get("available")
                else ""
            ),
        }

    def get_features_for_plan(self, plan_type: str) -> Dict:
        """
        Full feature summary for a plan: available features, locked features,
        and quantitative limits from the subscription catalogue.
        """
        from services.subscription_service import SubscriptionService
        plan_features = FEATURE_MAP.get((plan_type or "free").lower(), FEATURE_MAP["free"])
        available = [k for k, v in plan_features.items() if v]
        locked = [k for k, v in plan_features.items() if not v]

        try:
            limits = SubscriptionService().PLANS.get(
                (plan_type or "free").lower(), {}
            )
        except Exception:
            limits = {}

        return {
            "plan_type": (plan_type or "free").lower(),
            "features": dict(plan_features),
            "available_features": available,
            "locked_features": locked,
            "limits": {
                "videos_per_month": limits.get("videos_per_month"),
                "hours_per_month": limits.get("hours_per_month"),
                "questions_per_day": limits.get("questions_per_day"),
                "concepts_per_topic": limits.get("concepts_per_topic"),
            },
        }

    def show_feature_promo(self, feature_name: str) -> Optional[Dict]:
        """
        Detailed promo payload for a locked feature — used by FeatureLock
        component and the upgrade prompt flow.
        """
        info = FEATURE_INFO.get(feature_name)
        if info is None:
            return None
        required_plan = info.get("min_plan", "pro")
        cost = _PLAN_PRICES.get(required_plan, 0)
        return {
            "feature_name": feature_name,
            "title": info["name"],
            "description": info["description"],
            "benefits": info.get("benefits", []),
            "required_plan": required_plan,
            "cost_monthly": cost,
            "cost_yearly": cost * 10,
            "cta": f"Upgrade to {required_plan.title()}",
            "cta_url": f"/billing?plan={required_plan}",
        }

    def get_all_feature_info(self) -> Dict[str, Dict]:
        """Full FEATURE_INFO catalogue — used by the plan comparison page."""
        return dict(FEATURE_INFO)

    def log_feature_usage(self, user_id, feature_name: str, action: str) -> None:
        """
        Best-effort usage signal. No DB table at MVP — analytics tables can
        be added later if per-feature click-through data becomes a requirement.
        """
        logger.info(f"feature_usage: user={user_id} feature={feature_name} action={action}")


feature_unlock_service = FeatureUnlockService()
