"""
Referral program (Packet 4.6).

Rewards:
  - Referrer  : NGN 500 credit per successful signup (cap NGN 5 000/month)
  - Referred  : NGN 500 credit applied to their first paid month

Credits are tracked in users.account_credit_ngn (added via schema patch).
Deducting them at checkout requires Flutterwave discount integration — that
is noted as "apply at next renewal" for MVP.

Monthly earnings cap:  resets automatically when `earnings_month` (YYYY-MM)
differs from the current month, so no cron job is needed.
"""

import logging
import secrets
import string
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

REFERRAL_CONFIG = {
    "referrer_reward_ngn": 500,
    "referred_reward_ngn": 500,
    "max_monthly_referrer_ngn": 5000,
    "credit_expiry_days": 180,
}

_ALPHA_NUM = string.ascii_uppercase + string.digits


class ReferralError(Exception):
    """Base for referral validation errors."""


class SelfReferralError(ReferralError):
    pass


class ReferralAlreadyUsedError(ReferralError):
    pass


class InvalidReferralCodeError(ReferralError):
    pass


class MonthlyLimitExceededError(ReferralError):
    pass


class ReferralService:

    # ── Code generation ───────────────────────────────────────────────────────

    def _make_code(self, full_name: str = "") -> str:
        prefix = "".join(c for c in (full_name or "").upper() if c.isalpha())[:4].ljust(4, "L")
        suffix = "".join(secrets.choice(_ALPHA_NUM) for _ in range(6))
        return f"{prefix}{suffix}"

    def generate_or_get_code(self, db: Session, user_id, full_name: str = "") -> Dict:
        """Return the user's referral code row, creating it on first call."""
        from models import ReferralCode

        row = db.query(ReferralCode).filter(ReferralCode.user_id == user_id).first()
        if row is None:
            # Try up to 5 times to get a unique code (collision probability is tiny)
            for _ in range(5):
                code = self._make_code(full_name)
                if not db.query(ReferralCode).filter(ReferralCode.code == code).first():
                    break
            row = ReferralCode(
                id=uuid.uuid4(),
                user_id=user_id,
                code=code,
                earnings_month=datetime.utcnow().strftime("%Y-%m"),
            )
            db.add(row)
            db.commit()
            db.refresh(row)
        return self._code_to_dict(row)

    # ── Validation ────────────────────────────────────────────────────────────

    def validate_code(self, db: Session, code: str, new_user_id) -> Dict:
        """
        Validate that `code` is usable by `new_user_id`.
        Returns {valid, referrer_id, reason}.
        Raises specific ReferralError subclasses on failure.
        """
        from models import ReferralCode, Referral

        row = db.query(ReferralCode).filter(
            ReferralCode.code == code,
            ReferralCode.is_active.is_(True),
        ).first()
        if row is None:
            raise InvalidReferralCodeError(f"Referral code '{code}' not found or inactive.")

        if str(row.user_id) == str(new_user_id):
            raise SelfReferralError("You cannot use your own referral code.")

        existing = db.query(Referral).filter(
            Referral.referred_user_id == new_user_id,
        ).first()
        if existing:
            raise ReferralAlreadyUsedError("You have already used a referral code.")

        return {
            "valid": True,
            "referrer_id": str(row.user_id),
            "code": code,
        }

    # ── Tracking ──────────────────────────────────────────────────────────────

    def record_signup(self, db: Session, code: str, referred_user_id) -> None:
        """
        Record that a new user signed up via a referral code. Call this at
        signup time; the reward is granted separately via apply_reward() once
        the referred user completes their first paid subscription.
        """
        from models import ReferralCode, Referral

        rc = db.query(ReferralCode).filter(ReferralCode.code == code).first()
        if rc is None:
            return
        referral = Referral(
            id=uuid.uuid4(),
            referrer_id=rc.user_id,
            referred_user_id=referred_user_id,
            referral_code=code,
            status="signed_up",
            signed_up_at=datetime.utcnow(),
        )
        db.add(referral)
        rc.total_referrals = (rc.total_referrals or 0) + 1
        db.commit()
        logger.info(f"Referral signup recorded: code={code} referred={referred_user_id}")

    def apply_reward(self, db: Session, referral_code: str, referred_user_id) -> Dict:
        """
        Grant credits to referrer and referred user once the referred user
        makes their first paid subscription.
        """
        from models import ReferralCode, Referral, User

        rc = db.query(ReferralCode).filter(ReferralCode.code == referral_code).first()
        referral = db.query(Referral).filter(
            Referral.referred_user_id == referred_user_id,
            Referral.referral_code == referral_code,
        ).first()

        if rc is None or referral is None:
            return {"reward_given": False, "reason": "Referral record not found"}
        if referral.status == "rewarded":
            return {"reward_given": False, "reason": "Reward already granted"}

        # Check monthly cap (auto-reset if month changed)
        now = datetime.utcnow()
        current_month = now.strftime("%Y-%m")
        if rc.earnings_month != current_month:
            rc.earnings_this_month = 0.0
            rc.earnings_month = current_month

        cap = REFERRAL_CONFIG["max_monthly_referrer_ngn"]
        if (rc.earnings_this_month or 0) >= cap:
            raise MonthlyLimitExceededError(
                f"Monthly referral earnings cap of NGN {cap} reached."
            )

        referrer_reward = REFERRAL_CONFIG["referrer_reward_ngn"]
        referred_reward = REFERRAL_CONFIG["referred_reward_ngn"]

        # Apply referrer credit
        referrer = db.query(User).filter(User.id == rc.user_id).first()
        if referrer:
            referrer.account_credit_ngn = float(getattr(referrer, "account_credit_ngn", 0) or 0) + referrer_reward

        # Apply referred-user credit
        referred = db.query(User).filter(User.id == referred_user_id).first()
        if referred:
            referred.account_credit_ngn = float(getattr(referred, "account_credit_ngn", 0) or 0) + referred_reward

        # Update referral row
        referral.status = "rewarded"
        referral.reward_given_at = now
        referral.reward_amount = referrer_reward

        # Update referral code stats
        rc.successful_referrals = (rc.successful_referrals or 0) + 1
        rc.total_earnings = (rc.total_earnings or 0) + referrer_reward
        rc.earnings_this_month = (rc.earnings_this_month or 0) + referrer_reward

        db.commit()
        logger.info(
            f"Referral reward applied: code={referral_code} referrer={rc.user_id} "
            f"referred={referred_user_id} amount={referrer_reward}"
        )
        return {
            "reward_given": True,
            "referrer_credit": referrer_reward,
            "referred_credit": referred_reward,
            "referrer_total_earnings": rc.total_earnings,
            "timestamp": now.isoformat(),
        }

    # ── Stats ─────────────────────────────────────────────────────────────────

    def get_stats(self, db: Session, user_id) -> Dict:
        from models import ReferralCode, Referral

        rc = db.query(ReferralCode).filter(ReferralCode.user_id == user_id).first()
        if rc is None:
            return {
                "referral_code": None,
                "referral_url": None,
                "total_referrals": 0,
                "successful_referrals": 0,
                "total_earnings": 0,
                "earnings_this_month": 0,
                "earnings_remaining_this_month": REFERRAL_CONFIG["max_monthly_referrer_ngn"],
                "referrals": [],
            }

        # Auto-reset monthly cap
        current_month = datetime.utcnow().strftime("%Y-%m")
        if rc.earnings_month != current_month:
            rc.earnings_this_month = 0.0
            rc.earnings_month = current_month
            db.commit()

        referrals = (
            db.query(Referral)
            .filter(Referral.referrer_id == user_id)
            .order_by(Referral.created_at.desc())
            .limit(20)
            .all()
        )

        cap = REFERRAL_CONFIG["max_monthly_referrer_ngn"]
        earned = rc.earnings_this_month or 0.0
        return {
            "referral_code": rc.code,
            "referral_url": f"https://learnpath.ai/join?ref={rc.code}",
            "share_text": (
                f"Join me on LearnPath AI — the best AI-powered learning platform! "
                f"Use my code {rc.code} and we both get NGN 500 off. "
                f"Sign up: https://learnpath.ai/join?ref={rc.code}"
            ),
            "total_referrals": rc.total_referrals or 0,
            "successful_referrals": rc.successful_referrals or 0,
            "total_earnings": rc.total_earnings or 0,
            "earnings_this_month": earned,
            "earnings_remaining_this_month": max(0.0, cap - earned),
            "monthly_cap": cap,
            "referrals": [
                {
                    "id": str(r.id),
                    "status": r.status,
                    "signed_up_at": r.signed_up_at.isoformat() if r.signed_up_at else None,
                    "reward_given": r.status == "rewarded",
                    "reward_amount": r.reward_amount or 0,
                }
                for r in referrals
            ],
        }

    # ── Internal ──────────────────────────────────────────────────────────────

    @staticmethod
    def _code_to_dict(row) -> Dict:
        return {
            "referral_code": row.code,
            "referral_url": f"https://learnpath.ai/join?ref={row.code}",
            "share_text": (
                f"Join LearnPath AI with my code {row.code} and we both get NGN 500 off. "
                f"Sign up: https://learnpath.ai/join?ref={row.code}"
            ),
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }


referral_service = ReferralService()
