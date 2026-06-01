"""
Subscription & plan management (Packet 4.1).

Owns the plan catalogue, usage limits, and the lifecycle of a user's
subscription: create, upgrade (immediate, pro-rated), downgrade (queued for
next renewal), cancel, daily renewal, and billing history.

Money movement is delegated to PaymentService (Flutterwave). This service
records the Transaction/Subscription rows and keeps `users.tier` in sync so
the rest of the app can gate features off the User row alone.

Pure helpers (plan lookup, pricing, proration, renewal-date math, usage %)
take no DB/network and are unit-tested directly.
"""

import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Sentinel for "unlimited" — large enough to never bind in practice, small
# enough to stay a clean int in JSON.
UNLIMITED = 999_999

# Yearly billing bills 10 months for 12 (2 months free).
YEARLY_MONTHS_BILLED = 10


class SubscriptionError(Exception):
    """Base class for subscription errors."""


class PlanNotFoundError(SubscriptionError):
    """Requested plan_type is not in the catalogue."""


class SubscriptionNotFoundError(SubscriptionError):
    """User has no active subscription."""


class ActiveSubscriptionError(SubscriptionError):
    """User already has an active paid subscription."""


class InvalidPlanChangeError(SubscriptionError):
    """Upgrade/downgrade target is not a valid move from the current plan."""


class SubscriptionService:
    # Monthly NGN prices and per-plan usage limits.
    PLANS: Dict[str, Dict] = {
        "free": {
            "name": "Free Plan",
            "price": 0,
            "videos_per_month": 10,
            "hours_per_month": 10,
            "concepts_per_topic": 5,
            "questions_per_day": 5,
            "features": [],
            "currency": "NGN",
        },
        "pro": {
            "name": "Pro Plan",
            "price": 2999,
            "videos_per_month": 100,
            "hours_per_month": 100,
            "concepts_per_topic": UNLIMITED,
            "questions_per_day": 20,
            "features": ["offline_access", "ad_free"],
            "currency": "NGN",
        },
        "premium": {
            "name": "Premium Plan",
            "price": 9999,
            "videos_per_month": UNLIMITED,
            "hours_per_month": UNLIMITED,
            "concepts_per_topic": UNLIMITED,
            "questions_per_day": UNLIMITED,
            "features": ["offline_access", "ad_free", "priority_support"],
            "currency": "NGN",
        },
    }

    # Higher rank = higher tier. Drives upgrade vs downgrade classification.
    _PLAN_RANK = {"free": 0, "pro": 1, "premium": 2}

    # ------------------------------------------------------------------
    # Pure helpers (no DB / no network) — unit tested directly
    # ------------------------------------------------------------------

    def get_plan(self, plan_type: str) -> Dict:
        plan = self.PLANS.get(plan_type)
        if plan is None:
            raise PlanNotFoundError(f"Unknown plan '{plan_type}'")
        return plan

    def plan_price(self, plan_type: str, billing_cycle: str = "monthly") -> float:
        """Price in NGN for a full billing period."""
        monthly = self.get_plan(plan_type)["price"]
        if billing_cycle == "yearly":
            return float(monthly * YEARLY_MONTHS_BILLED)
        return float(monthly)

    def period_days(self, billing_cycle: str) -> int:
        return 365 if billing_cycle == "yearly" else 30

    def compute_renewal_date(self, start: datetime, billing_cycle: str = "monthly") -> datetime:
        return start + timedelta(days=self.period_days(billing_cycle))

    def is_upgrade(self, current_plan: str, new_plan: str) -> bool:
        return self._PLAN_RANK[new_plan] > self._PLAN_RANK[current_plan]

    def is_downgrade(self, current_plan: str, new_plan: str) -> bool:
        return self._PLAN_RANK[new_plan] < self._PLAN_RANK[current_plan]

    def prorated_credit(
        self,
        current_plan: str,
        billing_cycle: str,
        days_remaining: float,
    ) -> float:
        """Unused value of the current period, in NGN (never negative)."""
        period = self.period_days(billing_cycle)
        if period <= 0:
            return 0.0
        days_remaining = max(0.0, min(days_remaining, period))
        full = self.plan_price(current_plan, billing_cycle)
        return round(full * (days_remaining / period), 2)

    def upgrade_charge(
        self,
        current_plan: str,
        new_plan: str,
        billing_cycle: str,
        days_remaining: float,
    ) -> float:
        """
        What the user pays now to switch up: full new-plan price minus the
        unused credit from the current plan. Floored at 0.
        """
        new_price = self.plan_price(new_plan, billing_cycle)
        credit = self.prorated_credit(current_plan, billing_cycle, days_remaining)
        return round(max(0.0, new_price - credit), 2)

    @staticmethod
    def usage_percentage(used: float, limit: float) -> float:
        if limit >= UNLIMITED or limit <= 0:
            return 0.0
        return round(min(100.0, (used / limit) * 100.0), 1)

    @staticmethod
    def _remaining(used: float, limit: float):
        if limit >= UNLIMITED:
            return UNLIMITED
        return max(0, int(limit) - int(used))

    # ------------------------------------------------------------------
    # DB operations
    # ------------------------------------------------------------------

    def get_active_subscription(self, db: Session, user_id):
        from models import Subscription  # lazy import
        return (
            db.query(Subscription)
            .filter(
                Subscription.user_id == user_id,
                Subscription.status == "active",
            )
            .order_by(Subscription.created_at.desc())
            .first()
        )

    def create_subscription(
        self,
        db: Session,
        user_id,
        plan_type: str,
        billing_cycle: str = "monthly",
        price_paid: Optional[float] = None,
    ) -> Dict:
        """
        Create an active subscription. Any prior active row is marked
        'expired' first so a user only ever has one active subscription.
        Paid plans require a successful payment upstream; this method just
        records the resulting subscription.
        """
        from models import Subscription  # lazy import

        plan = self.get_plan(plan_type)  # raises PlanNotFoundError
        if billing_cycle not in ("monthly", "yearly"):
            raise SubscriptionError(f"Invalid billing_cycle '{billing_cycle}'")

        existing = self.get_active_subscription(db, user_id)
        if existing is not None:
            existing.status = "expired"
            existing.updated_at = datetime.utcnow()

        now = datetime.utcnow()
        sub = Subscription(
            id=uuid.uuid4(),
            user_id=user_id,
            plan_type=plan_type,
            billing_cycle=billing_cycle,
            start_date=now,
            renewal_date=self.compute_renewal_date(now, billing_cycle),
            price_paid=price_paid if price_paid is not None else self.plan_price(plan_type, billing_cycle),
            currency=plan["currency"],
            status="active",
            auto_renew=plan_type != "free",
        )
        db.add(sub)
        self._sync_user_tier(db, user_id, plan_type)
        db.commit()
        db.refresh(sub)
        logger.info(f"Subscription created: user={user_id} plan={plan_type} cycle={billing_cycle}")
        return self._sub_to_dict(sub)

    def get_user_plan(self, db: Session, user_id) -> Dict:
        """
        Current plan + live usage. If the user has no subscription row we
        treat them as Free (the implicit default) rather than erroring, so
        the billing page always renders.
        """
        sub = self.get_active_subscription(db, user_id)
        plan_type = sub.plan_type if sub else "free"
        plan = self.get_plan(plan_type)

        usage = self._compute_usage(db, user_id)
        return {
            "subscription_id": str(sub.id) if sub else None,
            "plan_type": plan_type,
            "plan_name": plan["name"],
            "billing_cycle": sub.billing_cycle if sub else "monthly",
            "start_date": sub.start_date.isoformat() if sub else None,
            "renewal_date": sub.renewal_date.isoformat() if sub and sub.renewal_date else None,
            "price_paid": sub.price_paid if sub else 0,
            "currency": plan["currency"],
            "status": sub.status if sub else "active",
            "auto_renew": sub.auto_renew if sub else False,
            "pending_plan_type": sub.pending_plan_type if sub else None,
            "features": plan["features"],
            "limits": {
                "videos_per_month": plan["videos_per_month"],
                "hours_per_month": plan["hours_per_month"],
                "questions_per_day": plan["questions_per_day"],
                "concepts_per_topic": plan["concepts_per_topic"],
            },
            "usage": {
                "videos_watched": usage["videos"],
                "hours_learned": usage["hours"],
                "questions_today": usage["questions_today"],
            },
            "remaining_videos": self._remaining(usage["videos"], plan["videos_per_month"]),
            "remaining_hours": self._remaining(usage["hours"], plan["hours_per_month"]),
            "remaining_questions_today": self._remaining(usage["questions_today"], plan["questions_per_day"]),
            "usage_percentage": {
                "videos": self.usage_percentage(usage["videos"], plan["videos_per_month"]),
                "hours": self.usage_percentage(usage["hours"], plan["hours_per_month"]),
                "questions": self.usage_percentage(usage["questions_today"], plan["questions_per_day"]),
            },
        }

    def upgrade_plan(
        self,
        db: Session,
        user_id,
        new_plan: str,
        price_paid: Optional[float] = None,
    ) -> Dict:
        """
        Move to a higher tier immediately. Clears any queued downgrade. The
        caller is responsible for having collected `upgrade_charge` first.
        """
        self.get_plan(new_plan)  # validate
        current = self.get_active_subscription(db, user_id)
        current_plan = current.plan_type if current else "free"
        if not self.is_upgrade(current_plan, new_plan):
            raise InvalidPlanChangeError(
                f"'{new_plan}' is not an upgrade from '{current_plan}'"
            )
        cycle = current.billing_cycle if current else "monthly"
        return self.create_subscription(
            db, user_id, new_plan, billing_cycle=cycle, price_paid=price_paid
        )

    def downgrade_plan(self, db: Session, user_id, new_plan: str) -> Dict:
        """
        Queue a downgrade for the next renewal. Access to the current (higher)
        plan continues until renewal_date, when handle_subscription_renewal
        applies the pending plan.
        """
        self.get_plan(new_plan)  # validate
        current = self.get_active_subscription(db, user_id)
        if current is None:
            raise SubscriptionNotFoundError("No active subscription to downgrade")
        if not self.is_downgrade(current.plan_type, new_plan):
            raise InvalidPlanChangeError(
                f"'{new_plan}' is not a downgrade from '{current.plan_type}'"
            )
        current.pending_plan_type = new_plan
        current.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(current)
        logger.info(
            f"Downgrade queued: user={user_id} {current.plan_type}→{new_plan} "
            f"effective {current.renewal_date}"
        )
        result = self._sub_to_dict(current)
        result["effective_date"] = (
            current.renewal_date.isoformat() if current.renewal_date else None
        )
        return result

    def cancel_subscription(self, db: Session, user_id, reason: str = "") -> Dict:
        """
        Cancel auto-renew. Access continues until the current period ends, at
        which point renewal expires the row and drops the user to Free.
        """
        current = self.get_active_subscription(db, user_id)
        if current is None:
            raise SubscriptionNotFoundError("No active subscription to cancel")
        current.status = "cancelled"
        current.auto_renew = False
        current.pending_plan_type = None
        current.cancelled_at = datetime.utcnow()
        current.updated_at = datetime.utcnow()
        db.commit()
        logger.info(f"Subscription cancelled: user={user_id} reason={reason!r}")
        return {
            "cancellation_date": current.cancelled_at.isoformat(),
            "access_until": current.renewal_date.isoformat() if current.renewal_date else None,
            "reason": reason,
            "plan_type": current.plan_type,
        }

    async def process_payment(
        self,
        db: Session,
        user_id,
        amount: float,
        plan_type: str,
        email: str,
        billing_cycle: str = "monthly",
        redirect_url: Optional[str] = None,
    ) -> Dict:
        """
        Start a payment for a plan: record a pending Transaction and ask
        PaymentService to initialise a Flutterwave checkout. The actual
        subscription is created later, on verify/webhook confirmation.
        """
        from models import Transaction  # lazy import
        from services.payment_service import payment_service

        self.get_plan(plan_type)  # validate

        reference = f"LP-{uuid.uuid4().hex[:16]}"
        tx = Transaction(
            id=uuid.uuid4(),
            user_id=user_id,
            plan_type=plan_type,
            amount=amount,
            currency=self.PLANS[plan_type]["currency"],
            reference=reference,
            status="pending",
        )
        db.add(tx)
        db.commit()
        db.refresh(tx)

        init = await payment_service.initialize_payment(
            amount=amount,
            reference=reference,
            email=email,
            plan_type=plan_type,
            meta={"user_id": str(user_id), "billing_cycle": billing_cycle},
            redirect_url=redirect_url,
        )
        return {
            "transaction_id": str(tx.id),
            "reference": reference,
            "status": tx.status,
            "amount": amount,
            "payment_link": init.get("payment_link"),
            "timestamp": tx.created_at.isoformat(),
        }

    def confirm_payment(self, db: Session, reference: str, flutterwave_id: Optional[str] = None) -> Dict:
        """
        Mark a transaction successful and provision its subscription. Idempotent:
        a transaction already 'successful' returns its existing subscription.
        Called by the verify endpoint and the webhook handler.
        """
        from models import Transaction, BillingHistory  # lazy import

        tx = db.query(Transaction).filter(Transaction.reference == reference).first()
        if tx is None:
            raise SubscriptionError(f"Unknown transaction reference '{reference}'")

        if tx.status == "successful" and tx.subscription_id:
            sub = self.get_active_subscription(db, tx.user_id)
            return {"already_processed": True, "subscription": self._sub_to_dict(sub) if sub else None}

        tx.status = "successful"
        if flutterwave_id:
            tx.flutterwave_id = str(flutterwave_id)
        tx.updated_at = datetime.utcnow()

        plan = self.get_plan(tx.plan_type)
        sub_dict = self.create_subscription(
            db, tx.user_id, tx.plan_type, price_paid=tx.amount
        )
        tx.subscription_id = uuid.UUID(sub_dict["subscription_id"])

        usage = self._compute_usage(db, tx.user_id)
        db.add(BillingHistory(
            id=uuid.uuid4(),
            user_id=tx.user_id,
            transaction_id=tx.id,
            amount=tx.amount,
            currency=tx.currency,
            plan_used=tx.plan_type,
            description=f"{plan['name']} — payment",
            videos_watched=usage["videos"],
            hours_learned=usage["hours"],
        ))
        db.commit()
        logger.info(f"Payment confirmed: ref={reference} user={tx.user_id} plan={tx.plan_type}")
        return {"already_processed": False, "subscription": sub_dict}

    def fail_payment(self, db: Session, reference: str) -> None:
        from models import Transaction  # lazy import
        tx = db.query(Transaction).filter(Transaction.reference == reference).first()
        if tx and tx.status == "pending":
            tx.status = "failed"
            tx.updated_at = datetime.utcnow()
            db.commit()
            logger.info(f"Payment failed: ref={reference}")

    def handle_subscription_renewal(self, db: Session, now: Optional[datetime] = None) -> Dict:
        """
        Daily job: process subscriptions whose renewal_date has passed.
          - cancelled  → expire, drop user to Free
          - pending downgrade → apply it, extend renewal
          - auto_renew → extend renewal, write a billing line
        """
        from models import Subscription, BillingHistory  # lazy import

        now = now or datetime.utcnow()
        due = (
            db.query(Subscription)
            .filter(
                Subscription.status.in_(["active", "cancelled"]),
                Subscription.renewal_date <= now,
            )
            .all()
        )

        renewed = 0
        downgraded = 0
        expired = 0
        for sub in due:
            if sub.status == "cancelled" or not sub.auto_renew:
                sub.status = "expired"
                sub.updated_at = now
                self._sync_user_tier(db, sub.user_id, "free")
                expired += 1
                continue

            if sub.pending_plan_type:
                sub.plan_type = sub.pending_plan_type
                sub.pending_plan_type = None
                self._sync_user_tier(db, sub.user_id, sub.plan_type)
                downgraded += 1

            sub.price_paid = self.plan_price(sub.plan_type, sub.billing_cycle)
            sub.renewal_date = self.compute_renewal_date(now, sub.billing_cycle)
            sub.updated_at = now
            usage = self._compute_usage(db, sub.user_id)
            db.add(BillingHistory(
                id=uuid.uuid4(),
                user_id=sub.user_id,
                amount=sub.price_paid,
                currency=sub.currency,
                plan_used=sub.plan_type,
                description=f"{self.PLANS[sub.plan_type]['name']} — {sub.billing_cycle} renewal",
                videos_watched=usage["videos"],
                hours_learned=usage["hours"],
            ))
            renewed += 1

        db.commit()
        result = {"renewed_count": renewed, "downgraded_count": downgraded, "expired_count": expired}
        logger.info(f"Renewal run: {result}")
        return result

    def get_billing_history(self, db: Session, user_id) -> List[Dict]:
        from models import BillingHistory  # lazy import
        rows = (
            db.query(BillingHistory)
            .filter(BillingHistory.user_id == user_id)
            .order_by(BillingHistory.billing_date.desc())
            .all()
        )
        return [
            {
                "id": str(r.id),
                "date": r.billing_date.isoformat() if r.billing_date else None,
                "amount": r.amount,
                "currency": r.currency,
                "plan": r.plan_used,
                "description": r.description,
                "status": "successful",
            }
            for r in rows
        ]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _sync_user_tier(self, db: Session, user_id, plan_type: str) -> None:
        from models import User  # lazy import
        user = db.query(User).filter(User.id == user_id).first()
        if user is not None:
            user.tier = plan_type
            user.tier_updated_at = datetime.utcnow()

    def _compute_usage(self, db: Session, user_id) -> Dict:
        """
        Live usage for the current calendar month + today, derived from
        existing tables (no separate usage counters to keep in sync).
        Best-effort: any query failure degrades to zeros so billing never 500s.
        """
        from models import PathSession, QuestionAnswer  # lazy import
        from sqlalchemy import func

        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        try:
            videos = (
                db.query(func.count(PathSession.id))
                .filter(
                    PathSession.user_id == user_id,
                    PathSession.video_watched.is_(True),
                    PathSession.started_at >= month_start,
                )
                .scalar()
            ) or 0
        except Exception:
            videos = 0

        try:
            watch_seconds = (
                db.query(func.coalesce(func.sum(PathSession.total_watch_time_seconds), 0))
                .filter(
                    PathSession.user_id == user_id,
                    PathSession.started_at >= month_start,
                )
                .scalar()
            ) or 0
        except Exception:
            watch_seconds = 0

        try:
            questions_today = (
                db.query(func.count(QuestionAnswer.id))
                .filter(
                    QuestionAnswer.user_id == user_id,
                    QuestionAnswer.created_at >= day_start,
                )
                .scalar()
            ) or 0
        except Exception:
            questions_today = 0

        return {
            "videos": int(videos),
            "hours": round(int(watch_seconds) / 3600.0, 1),
            "questions_today": int(questions_today),
        }

    def _sub_to_dict(self, sub) -> Dict:
        return {
            "subscription_id": str(sub.id),
            "user_id": str(sub.user_id),
            "plan_type": sub.plan_type,
            "pending_plan_type": sub.pending_plan_type,
            "billing_cycle": sub.billing_cycle,
            "start_date": sub.start_date.isoformat() if sub.start_date else None,
            "renewal_date": sub.renewal_date.isoformat() if sub.renewal_date else None,
            "price_paid": sub.price_paid,
            "currency": sub.currency,
            "status": sub.status,
            "auto_renew": sub.auto_renew,
        }


subscription_service = SubscriptionService()
