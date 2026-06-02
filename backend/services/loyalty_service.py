"""
Loyalty points and tier system (Packet 4.6).

Points are tracked in two columns:
  total_points     — spendable balance (decrements on redemption)
  lifetime_points  — always-increasing driver for tier calculation

Tiers are based on lifetime_points so users can't lose tier status by
spending their balance.

Reward codes are generated at redemption time and stored in reward_codes.
Applying them to a subscription (discounting the next invoice) is handled
at checkout — deferred for full Flutterwave integration.
"""

from __future__ import annotations

import logging
import secrets
import string
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

_ALPHA_NUM = string.ascii_uppercase + string.digits

# ──────────────────────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────────────────────

TIERS: Dict[str, Dict] = {
    "bronze": {
        "name": "Bronze",
        "min_lifetime_points": 0,
        "multiplier": 1.0,
        "benefits": {
            "early_access": False,
            "support": "standard",
            "annual_free_month": False,
        },
    },
    "silver": {
        "name": "Silver",
        "min_lifetime_points": 500,
        "multiplier": 1.1,
        "benefits": {
            "early_access": True,
            "support": "standard",
            "annual_free_month": False,
        },
    },
    "gold": {
        "name": "Gold",
        "min_lifetime_points": 1000,
        "multiplier": 1.2,
        "benefits": {
            "early_access": True,
            "support": "priority",
            "annual_free_month": False,
        },
    },
    "platinum": {
        "name": "Platinum",
        "min_lifetime_points": 2000,
        "multiplier": 1.5,
        "benefits": {
            "early_access": True,
            "support": "vip",
            "annual_free_month": True,
        },
    },
}

# Ordered tier keys by min_points ascending (used for tier calculation)
_TIER_THRESHOLDS = sorted(TIERS.items(), key=lambda x: x[1]["min_lifetime_points"])

POINT_AWARDS: Dict[str, int] = {
    "video_watch":     10,
    "question_answer":  5,
    "streak_day":      50,
    "upgrade_plan":   100,
    "referral_signup": 250,
}

REDEMPTION_OPTIONS = [
    {"points_cost": 100,  "reward_type": "discount",     "reward_value": 500,  "label": "NGN 500 discount"},
    {"points_cost": 250,  "reward_type": "free_month",   "reward_value": 1,    "label": "1 month free"},
    {"points_cost": 500,  "reward_type": "three_months", "reward_value": 3,    "label": "3 months free"},
]

REWARD_EXPIRY_DAYS = 180


class InsufficientPointsError(Exception):
    pass


class InvalidRewardError(Exception):
    pass


# ──────────────────────────────────────────────────────────────────────────────
# Pure helpers (no DB — unit-testable)
# ──────────────────────────────────────────────────────────────────────────────

def tier_for_lifetime_points(lifetime_points: int) -> str:
    """Return the tier name for the given lifetime points total."""
    tier = "bronze"
    for name, cfg in _TIER_THRESHOLDS:
        if lifetime_points >= cfg["min_lifetime_points"]:
            tier = name
    return tier


def multiplier_for_tier(tier: str) -> float:
    return TIERS.get(tier, TIERS["bronze"])["multiplier"]


def next_tier(current: str) -> Optional[str]:
    keys = [k for k, _ in _TIER_THRESHOLDS]
    idx = keys.index(current) if current in keys else 0
    return keys[idx + 1] if idx + 1 < len(keys) else None


def points_to_next_tier(lifetime_points: int) -> Optional[int]:
    t = next_tier(tier_for_lifetime_points(lifetime_points))
    if t is None:
        return None
    return max(0, TIERS[t]["min_lifetime_points"] - lifetime_points)


def apply_multiplier(base_points: int, multiplier: float) -> int:
    return max(1, round(base_points * multiplier))


# ──────────────────────────────────────────────────────────────────────────────
# LoyaltyService
# ──────────────────────────────────────────────────────────────────────────────

class LoyaltyService:

    # ── Internal DB helpers ───────────────────────────────────────────────────

    def _get_or_create(self, db: Session, user_id) -> "models.LoyaltyPoints":
        from models import LoyaltyPoints
        row = db.query(LoyaltyPoints).filter(LoyaltyPoints.user_id == user_id).first()
        if row is None:
            row = LoyaltyPoints(
                id=uuid.uuid4(),
                user_id=user_id,
                total_points=0,
                lifetime_points=0,
                current_tier="bronze",
                bonus_multiplier=1.0,
            )
            db.add(row)
            db.flush()
        return row

    def _write_history(
        self, db: Session, user_id, action_type: str, delta: int,
        balance_after: int, description: str = ""
    ) -> None:
        from models import LoyaltyHistory
        db.add(LoyaltyHistory(
            id=uuid.uuid4(),
            user_id=user_id,
            action_type=action_type,
            points_delta=delta,
            balance_after=balance_after,
            description=description,
        ))

    # ── Public API ────────────────────────────────────────────────────────────

    def award_points(
        self,
        db: Session,
        user_id,
        action_type: str,
        custom_points: Optional[int] = None,
    ) -> Dict:
        """
        Award points for an action. Applies the user's current tier multiplier.
        Returns the updated balance and any tier change.
        """
        base = custom_points if custom_points is not None else POINT_AWARDS.get(action_type, 0)
        if base <= 0:
            return {"points_awarded": 0, "action_type": action_type}

        row = self._get_or_create(db, user_id)
        effective = apply_multiplier(base, row.bonus_multiplier)

        old_tier = row.current_tier
        row.total_points = (row.total_points or 0) + effective
        row.lifetime_points = (row.lifetime_points or 0) + effective

        new_tier = tier_for_lifetime_points(row.lifetime_points)
        row.current_tier = new_tier
        row.bonus_multiplier = multiplier_for_tier(new_tier)

        self._write_history(
            db, user_id, action_type, effective, row.total_points,
            description=f"Earned {effective} pts ({action_type})"
        )
        db.commit()

        nxt = next_tier(new_tier)
        pts_next = points_to_next_tier(row.lifetime_points)
        logger.info(f"loyalty: user={user_id} +{effective}pts tier={new_tier}")

        return {
            "points_awarded": effective,
            "base_points": base,
            "multiplier_applied": row.bonus_multiplier,
            "total_points": row.total_points,
            "lifetime_points": row.lifetime_points,
            "current_tier": new_tier,
            "tier_changed": new_tier != old_tier,
            "old_tier": old_tier if new_tier != old_tier else None,
            "next_tier": nxt,
            "points_to_next_tier": pts_next,
        }

    def redeem_points(
        self,
        db: Session,
        user_id,
        points_amount: int,
        reward_type: str,
    ) -> Dict:
        """
        Redeem points for a reward. Deducts from total_points (NOT lifetime),
        generates a one-time RewardCode, and returns the code.
        """
        from models import RewardCode

        option = next(
            (o for o in REDEMPTION_OPTIONS
             if o["reward_type"] == reward_type and o["points_cost"] == points_amount),
            None,
        )
        if option is None:
            raise InvalidRewardError(
                f"No reward matching type='{reward_type}' cost={points_amount}. "
                f"Valid options: {[str(o['points_cost']) + 'pts=' + o['label'] for o in REDEMPTION_OPTIONS]}"
            )

        row = self._get_or_create(db, user_id)
        if (row.total_points or 0) < points_amount:
            raise InsufficientPointsError(
                f"Need {points_amount} pts, have {row.total_points}."
            )

        row.total_points -= points_amount
        self._write_history(
            db, user_id, "redeem", -points_amount, row.total_points,
            description=f"Redeemed {points_amount} pts for {option['label']}"
        )

        code = "LP" + "".join(secrets.choice(_ALPHA_NUM) for _ in range(10))
        expires = datetime.utcnow() + timedelta(days=REWARD_EXPIRY_DAYS)
        rc = RewardCode(
            id=uuid.uuid4(),
            user_id=user_id,
            code=code,
            reward_type=reward_type,
            reward_value=option["reward_value"],
            points_cost=points_amount,
            expires_at=expires,
        )
        db.add(rc)
        db.commit()

        logger.info(f"loyalty redeem: user={user_id} code={code} type={reward_type}")
        return {
            "redeemed": True,
            "reward_code": code,
            "reward_type": reward_type,
            "reward_label": option["label"],
            "reward_value": option["reward_value"],
            "remaining_points": row.total_points,
            "expires_at": expires.isoformat(),
        }

    def get_status(self, db: Session, user_id) -> Dict:
        """Full loyalty status for the user."""
        row = self._get_or_create(db, user_id)
        db.commit()  # persist any lazy-created row

        tier_cfg = TIERS.get(row.current_tier, TIERS["bronze"])
        nxt = next_tier(row.current_tier)
        pts_next = points_to_next_tier(row.lifetime_points or 0)

        history = (
            db.query(__import__("models").LoyaltyHistory)
            .filter(__import__("models").LoyaltyHistory.user_id == user_id)
            .order_by(__import__("models").LoyaltyHistory.created_at.desc())
            .limit(20)
            .all()
        )

        return {
            "total_points": row.total_points or 0,
            "lifetime_points": row.lifetime_points or 0,
            "current_tier": row.current_tier,
            "tier_name": tier_cfg["name"],
            "bonus_multiplier": row.bonus_multiplier or 1.0,
            "next_tier": nxt,
            "points_to_next_tier": pts_next,
            "tier_benefits": tier_cfg["benefits"],
            "available_rewards": [
                {
                    "points_cost": o["points_cost"],
                    "reward_type": o["reward_type"],
                    "label": o["label"],
                    "can_redeem": (row.total_points or 0) >= o["points_cost"],
                }
                for o in REDEMPTION_OPTIONS
            ],
            "all_tiers": {
                name: {
                    "min_points": cfg["min_lifetime_points"],
                    "multiplier": cfg["multiplier"],
                    "current": name == row.current_tier,
                    "achieved": (row.lifetime_points or 0) >= cfg["min_lifetime_points"],
                }
                for name, cfg in TIERS.items()
            },
            "history": [
                {
                    "date": h.created_at.isoformat() if h.created_at else None,
                    "action": h.action_type,
                    "points": h.points_delta,
                    "balance": h.balance_after,
                    "description": h.description,
                }
                for h in history
            ],
        }

    def apply_reward_code(self, db: Session, user_id, code: str) -> Dict:
        """
        Mark a reward code as used. The actual discount is applied by
        SubscriptionService at the next payment — full Flutterwave integration.
        """
        from models import RewardCode
        rc = db.query(RewardCode).filter(
            RewardCode.code == code,
            RewardCode.user_id == user_id,
        ).first()
        if rc is None:
            return {"applied": False, "reason": "Code not found or does not belong to you."}
        if rc.is_used:
            return {"applied": False, "reason": "Code already used."}
        if rc.expires_at and rc.expires_at < datetime.utcnow():
            return {"applied": False, "reason": "Code has expired."}
        rc.is_used = True
        rc.used_at = datetime.utcnow()
        db.commit()
        return {
            "applied": True,
            "reward_type": rc.reward_type,
            "reward_value": rc.reward_value,
            "note": "Discount will be applied to your next subscription payment.",
        }


loyalty_service = LoyaltyService()
