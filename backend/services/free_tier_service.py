"""
Free tier experience: feature availability and upgrade prompt logic (Packet 4.3).

Two responsibilities:
  1. Feature-availability gate — which capabilities are locked per plan.
  2. Upgrade prompt generation — contextual payload the frontend renders
     as a modal or inline card.

Both are pure computation (no DB writes, no AI calls). The feature map is the
single source of truth; if a feature appears here as False for "free", the
backend routes that serve it should enforce the same via users.tier. Frontend
uses the same map to grey out / lock UI controls.
"""

import logging
import random
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Feature availability per plan
# ──────────────────────────────────────────────────────────────────────────────

FEATURE_MAP: Dict[str, Dict[str, bool]] = {
    "free": {
        "browse_courses":          True,
        "watch_videos":            True,   # capped at 10/month by UsageTrackingService
        "answer_questions":        True,   # capped at 5/day
        "view_progress":           True,
        "concept_branching":       True,   # 3.1 feature — available to all
        "search_build_path":       True,   # capped at 2/hr by RateLimitingService
        "offline_download":        False,
        "advanced_questions":      False,
        "custom_paths":            False,
        "certificate_generation":  False,
        "ad_free":                 False,
        "priority_support":        False,
    },
    "pro": {
        "browse_courses":          True,
        "watch_videos":            True,
        "answer_questions":        True,
        "view_progress":           True,
        "concept_branching":       True,
        "search_build_path":       True,
        "offline_download":        True,
        "advanced_questions":      True,
        "custom_paths":            False,  # future feature
        "certificate_generation":  False,  # future feature
        "ad_free":                 True,
        "priority_support":        False,
    },
    "premium": {
        "browse_courses":          True,
        "watch_videos":            True,
        "answer_questions":        True,
        "view_progress":           True,
        "concept_branching":       True,
        "search_build_path":       True,
        "offline_download":        True,
        "advanced_questions":      True,
        "custom_paths":            True,
        "certificate_generation":  True,
        "ad_free":                 True,
        "priority_support":        True,
    },
}

# Human-readable feature names for prompts
_FEATURE_LABELS: Dict[str, str] = {
    "offline_download":       "Offline Download",
    "advanced_questions":     "Advanced Questions",
    "custom_paths":           "Custom Learning Paths",
    "certificate_generation": "Certificate Generation",
    "ad_free":                "Ad-Free Experience",
    "priority_support":       "Priority Support",
}

# What each plan unlocks (used in prompt copy)
_PLAN_HIGHLIGHTS: Dict[str, List[str]] = {
    "pro": [
        "100 videos per month",
        "20 questions per day",
        "Offline access",
        "Ad-free experience",
    ],
    "premium": [
        "Unlimited videos",
        "Unlimited questions",
        "Offline access",
        "Ad-free experience",
        "Priority support",
        "Custom learning paths",
    ],
}

# ──────────────────────────────────────────────────────────────────────────────
# Hardcoded success stories (seeded; replace with DB query when stories exist)
# ──────────────────────────────────────────────────────────────────────────────

_SUCCESS_STORIES: List[Dict] = [
    {
        "user_name": "Adaeze O.",
        "achievement": "Passed AWS Solutions Architect exam",
        "story": (
            "I upgraded to Pro after hitting the free video limit on my third day. "
            "Three months later I passed my AWS exam with 89%. The structured paths "
            "made all the difference."
        ),
        "before_plan": "free",
        "after_plan": "pro",
        "metric": "3 months to certification",
    },
    {
        "user_name": "Emeka N.",
        "achievement": "Landed a senior data analyst role",
        "story": (
            "LearnPath AI helped me go from junior analyst to senior in eight months. "
            "The active-recall questions after each video genuinely changed how I retain "
            "information. Worth every kobo of Pro."
        ),
        "before_plan": "free",
        "after_plan": "pro",
        "metric": "40% salary increase",
    },
    {
        "user_name": "Fatima A.",
        "achievement": "Built her first full-stack app",
        "story": (
            "As a complete beginner, the concept branching feature showed me the exact "
            "progression from HTML to React. Upgrading to Premium gave me unlimited access "
            "to follow every branch without hitting limits."
        ),
        "before_plan": "free",
        "after_plan": "premium",
        "metric": "0 to deployed in 6 weeks",
    },
    {
        "user_name": "Chukwudi M.",
        "achievement": "Passed Google Data Analytics Certificate",
        "story": (
            "I tried three other learning platforms before LearnPath AI. The difference is "
            "that it actually selects quality videos — I wasn't wasting time on outdated "
            "content. Pro plan paid for itself on the first month."
        ),
        "before_plan": "free",
        "after_plan": "pro",
        "metric": "Certified in 10 weeks",
    },
    {
        "user_name": "Ifeoma B.",
        "achievement": "Promoted to engineering lead",
        "story": (
            "I learned system design, distributed systems, and leadership in parallel using "
            "three concurrent learning paths. Premium's unlimited access let me context-switch "
            "without worrying about running out of videos."
        ),
        "before_plan": "pro",
        "after_plan": "premium",
        "metric": "Promoted in 5 months",
    },
]


class FreeTierService:

    # ── Feature availability ──────────────────────────────────────────────────

    def check_feature(self, plan_type: str, feature_name: str) -> Dict:
        """
        Check whether a feature is available for a plan.

        Returns {available, reason, upgrade_needed, suggested_plan}.
        """
        plan = (plan_type or "free").lower()
        plan_features = FEATURE_MAP.get(plan, FEATURE_MAP["free"])
        available = plan_features.get(feature_name, False)

        if available:
            return {
                "available": True,
                "reason": "",
                "upgrade_needed": False,
                "suggested_plan": None,
            }

        label = _FEATURE_LABELS.get(feature_name, feature_name.replace("_", " ").title())
        # Suggest the cheapest plan that has the feature
        suggested = None
        for p in ("pro", "premium"):
            if FEATURE_MAP.get(p, {}).get(feature_name, False):
                suggested = p
                break

        return {
            "available": False,
            "reason": f"{label} is not available on the {plan.title()} plan.",
            "upgrade_needed": True,
            "suggested_plan": suggested,
        }

    def get_all_features(self, plan_type: str) -> Dict[str, bool]:
        """Full feature map for the given plan."""
        return dict(FEATURE_MAP.get((plan_type or "free").lower(), FEATURE_MAP["free"]))

    def is_free_user(self, plan_type: str) -> bool:
        return (plan_type or "free").lower() == "free"

    def shows_ads(self, plan_type: str) -> bool:
        """True when the user should see upgrade banners."""
        return self.is_free_user(plan_type)

    # ── Upgrade prompts ───────────────────────────────────────────────────────

    def get_upgrade_prompt(self, context: str, plan_type: str = "free") -> Dict:
        """
        Return an upgrade prompt payload for the given context.

        Contexts:
          "feature_locked"      — user tried a Pro/Premium feature
          "video_limit_reached" — monthly video quota exhausted
          "approaching_limit"   — usage >= 80%
          "question_limit"      — daily question quota exhausted
          "search_limit"        — hourly search quota exhausted
          "general"             — generic prompt
        """
        if not self.is_free_user(plan_type):
            return {"show_prompt": False}

        prompts: Dict[str, Dict] = {
            "feature_locked": {
                "show_prompt": True,
                "prompt_type": "feature_lock",
                "title": "This feature requires Pro",
                "message": "Upgrade to unlock offline access, advanced questions, and more.",
                "highlights": _PLAN_HIGHLIGHTS["pro"],
                "cta_text": "Upgrade to Pro — NGN 2,999/mo",
                "cta_url": "/billing?plan=pro",
                "dismiss_enabled": True,
            },
            "video_limit_reached": {
                "show_prompt": True,
                "prompt_type": "limit_reached",
                "title": "You've watched all your free videos",
                "message": "Upgrade to Pro for 100 videos per month, or wait until next month.",
                "highlights": _PLAN_HIGHLIGHTS["pro"],
                "cta_text": "Upgrade to Pro",
                "cta_url": "/billing?plan=pro",
                "dismiss_enabled": True,
            },
            "approaching_limit": {
                "show_prompt": True,
                "prompt_type": "approaching",
                "title": "Running low on videos",
                "message": "You're close to your monthly video limit. Upgrade to keep learning.",
                "highlights": _PLAN_HIGHLIGHTS["pro"],
                "cta_text": "Upgrade to Pro",
                "cta_url": "/billing?plan=pro",
                "dismiss_enabled": True,
            },
            "question_limit": {
                "show_prompt": True,
                "prompt_type": "limit_reached",
                "title": "Daily question limit reached",
                "message": "Upgrade to Pro for 20 questions per day, or come back tomorrow.",
                "highlights": _PLAN_HIGHLIGHTS["pro"],
                "cta_text": "Upgrade to Pro",
                "cta_url": "/billing?plan=pro",
                "dismiss_enabled": True,
            },
            "search_limit": {
                "show_prompt": True,
                "prompt_type": "limit_reached",
                "title": "Search limit reached",
                "message": "Free accounts can search 2 times per hour. Upgrade for 10 searches per hour.",
                "highlights": _PLAN_HIGHLIGHTS["pro"],
                "cta_text": "Upgrade to Pro",
                "cta_url": "/billing?plan=pro",
                "dismiss_enabled": True,
            },
            "general": {
                "show_prompt": True,
                "prompt_type": "general",
                "title": "Get more from LearnPath AI",
                "message": "Unlock 100 videos/month, offline access, and an ad-free experience.",
                "highlights": _PLAN_HIGHLIGHTS["pro"],
                "cta_text": "See plans",
                "cta_url": "/billing",
                "dismiss_enabled": True,
            },
        }

        return prompts.get(context, prompts["general"])

    # ── Success stories ───────────────────────────────────────────────────────

    def get_success_stories(self, count: int = 3, shuffle: bool = True) -> List[Dict]:
        stories = list(_SUCCESS_STORIES)
        if shuffle:
            random.shuffle(stories)
        return stories[:count]

    def get_random_story(self) -> Optional[Dict]:
        return random.choice(_SUCCESS_STORIES) if _SUCCESS_STORIES else None


free_tier_service = FreeTierService()
