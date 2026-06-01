"""
Internal upgrade-CTA rotation for free tier users (Packet 4.3).

"Ads" here are self-promotion banners — LearnPath AI upgrade calls-to-action,
not a third-party ad network. A deterministic hash of (user_id, placement,
hour) picks the active CTA so the same user sees a consistent ad within a
session while getting a fresh one each hour, with no DB write required.

No impression/click DB tables: at MVP scale the meaningful signal is a user
landing on /billing, which the existing navigation already captures. Analytics
tables can be added later if click-through rates need to be measured.
"""

import hashlib
import logging
from datetime import datetime
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Hardcoded CTA catalogue
# ──────────────────────────────────────────────────────────────────────────────

_ADS: List[Dict] = [
    {
        "id": "cta-pro-videos",
        "placement_types": ["banner", "sidebar"],
        "title": "Watch 10x more videos",
        "description": "Upgrade to Pro and get 100 videos per month — plus offline access and no ads.",
        "cta_text": "Upgrade to Pro",
        "cta_url": "/billing?plan=pro",
        "priority": 3,
    },
    {
        "id": "cta-pro-questions",
        "placement_types": ["banner", "sidebar"],
        "title": "Answer more questions",
        "description": "Get 20 active-recall questions per day on the Pro plan. Accelerate your learning.",
        "cta_text": "See Pro plan",
        "cta_url": "/billing?plan=pro",
        "priority": 2,
    },
    {
        "id": "cta-pro-adfree",
        "placement_types": ["banner"],
        "title": "Go ad-free",
        "description": "Pro and Premium users enjoy a completely distraction-free learning experience.",
        "cta_text": "Upgrade Now",
        "cta_url": "/billing",
        "priority": 2,
    },
    {
        "id": "cta-premium-unlimited",
        "placement_types": ["sidebar", "modal"],
        "title": "Unlimited learning",
        "description": "Premium gives you unlimited videos, unlimited questions, and priority support.",
        "cta_text": "See Premium",
        "cta_url": "/billing?plan=premium",
        "priority": 1,
    },
    {
        "id": "cta-annual-savings",
        "placement_types": ["banner", "modal"],
        "title": "Save 2 months with annual billing",
        "description": "Pay for 10 months, use LearnPath AI for 12. Annual plan saves you 17%.",
        "cta_text": "Switch to Annual",
        "cta_url": "/billing?cycle=yearly",
        "priority": 2,
    },
    {
        "id": "cta-pro-offline",
        "placement_types": ["sidebar", "modal"],
        "title": "Learn without internet",
        "description": "Download courses for offline viewing — available on Pro and Premium.",
        "cta_text": "Upgrade to Pro",
        "cta_url": "/billing?plan=pro",
        "priority": 1,
    },
]


class AdService:
    def get_ad_for_placement(
        self,
        placement: str,
        user_id: Optional[str] = None,
    ) -> Optional[Dict]:
        """
        Return a single CTA for the given placement.

        Selection is deterministic per (user_id, placement, hour) so the
        component renders the same CTA within a session without any state.
        """
        eligible = [a for a in _ADS if placement in a["placement_types"]]
        if not eligible:
            return None

        # Weighted selection: repeat each ad by its priority weight
        weighted: List[Dict] = []
        for ad in eligible:
            weighted.extend([ad] * ad.get("priority", 1))

        seed = f"{user_id or 'anon'}:{placement}:{datetime.utcnow().strftime('%Y%m%d%H')}"
        idx = int(hashlib.md5(seed.encode()).hexdigest(), 16) % len(weighted)
        chosen = weighted[idx]

        return {
            "ad_id": chosen["id"],
            "title": chosen["title"],
            "description": chosen["description"],
            "cta_text": chosen["cta_text"],
            "cta_url": chosen["cta_url"],
            "placement": placement,
        }

    def get_all_for_placement(self, placement: str) -> List[Dict]:
        """All CTAs eligible for a placement, sorted by priority desc."""
        return sorted(
            [a for a in _ADS if placement in a["placement_types"]],
            key=lambda a: a.get("priority", 1),
            reverse=True,
        )


ad_service = AdService()
