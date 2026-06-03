"""
Customer success service: org health scoring + churn detection (Packet 6.5, rebuilt).

Rebuilt against the real schema. There is NO User.organization_id and no
PathSession.created_at — students belong to an organization through
ClassMembership -> Class -> Organization, and ClassMembership already carries
the per-student signals we need (progress_percent, average_score, last_active).
So health is derived from class memberships, payments, and (optionally) the
latest SchoolAnalytics row, rather than from raw session joins.
"""

from datetime import datetime, timedelta
from typing import Dict, List

from sqlalchemy.orm import Session

from models import (
    Organization,
    OrganizationSubscription,
    OrganizationPayment,
    SchoolAnalytics,
    Class,
    ClassMembership,
)


# Payment status -> invoice health contribution (0-100)
_INVOICE_SCORE = {"paid": 100, "pending": 70, "failed": 40, "overdue": 0}


class CustomerSuccessService:
    """Analyze organization health and detect churn risk from real B2B data."""

    # ── internal helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _org_memberships(org_id: str, db: Session) -> List[ClassMembership]:
        """All active student memberships for classes in this org."""
        return (
            db.query(ClassMembership)
            .join(Class, ClassMembership.class_id == Class.id)
            .filter(
                Class.organization_id == org_id,
                ClassMembership.enrollment_status == "active",
            )
            .all()
        )

    @staticmethod
    def _latest_payment(org_id: str, db: Session):
        return (
            db.query(OrganizationPayment)
            .filter(OrganizationPayment.organization_id == org_id)
            .order_by(OrganizationPayment.created_at.desc())
            .first()
        )

    @staticmethod
    def _engagement(memberships: List[ClassMembership]) -> Dict:
        """Active-in-last-7-days rate + totals from membership signals."""
        total = len(memberships)
        if total == 0:
            return {"total_students": 0, "active_students": 0, "engagement_rate": 0.0}
        week_ago = datetime.utcnow() - timedelta(days=7)
        active = sum(1 for m in memberships if m.last_active and m.last_active >= week_ago)
        return {
            "total_students": total,
            "active_students": active,
            "engagement_rate": round(active / total * 100, 1),
        }

    # ── scoring ───────────────────────────────────────────────────────────────

    @staticmethod
    def calculate_org_health_score(org_id: str, db: Session) -> int:
        """
        Composite 0-100 health score:
          engagement (active last 7d)   40%
          progress   (avg progress %)   30%
          invoice    (latest payment)   15%
          subscription / trial standing 15%
        """
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            return 0

        memberships = CustomerSuccessService._org_memberships(org_id, db)
        eng = CustomerSuccessService._engagement(memberships)

        engagement_score = min(100.0, eng["engagement_rate"]) * 0.40

        avg_progress = (
            sum(m.progress_percent or 0 for m in memberships) / len(memberships)
            if memberships else 0
        )
        progress_score = min(100.0, avg_progress) * 0.30

        payment = CustomerSuccessService._latest_payment(org_id, db)
        invoice_score = (_INVOICE_SCORE.get(payment.status, 70) if payment else 100) * 0.15

        # Subscription standing: a trial nearing expiry with low engagement is risky.
        sub_score = 100.0
        if (org.subscription_tier or "").lower() == "trial":
            if org.subscription_end_date:
                days_left = (org.subscription_end_date - datetime.utcnow()).days
                if days_left <= 7 and eng["engagement_rate"] < 50:
                    sub_score = 30.0
            elif eng["engagement_rate"] < 30:
                sub_score = 50.0
        sub_score *= 0.15

        total = engagement_score + progress_score + invoice_score + sub_score
        return max(0, min(100, int(round(total))))

    @staticmethod
    def get_org_health_status(score: int) -> str:
        if score >= 70:
            return "healthy"
        if score >= 40:
            return "at_risk"
        return "churning"

    @staticmethod
    def detect_churn_risk(org_id: str, db: Session) -> Dict:
        """Return churn triggers + engagement context for an org."""
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            return {"is_churning": False, "triggers": [], "engagement_rate": 0,
                    "active_students": 0, "total_students": 0}

        memberships = CustomerSuccessService._org_memberships(org_id, db)
        eng = CustomerSuccessService._engagement(memberships)
        triggers: List[str] = []
        now = datetime.utcnow()
        is_trial = (org.subscription_tier or "").lower() == "trial"

        # 1. Inactivity (paid plans): nobody active in 14 days
        fourteen_days_ago = now - timedelta(days=14)
        any_recent = any(m.last_active and m.last_active >= fourteen_days_ago for m in memberships)
        if memberships and not any_recent and not is_trial:
            triggers.append("inactive_14_days")

        # 2. Invoice overdue
        payment = CustomerSuccessService._latest_payment(org_id, db)
        if payment and payment.status == "overdue":
            triggers.append("invoice_overdue")

        # 3. Low engagement (only meaningful with a real cohort)
        if eng["engagement_rate"] < 30 and eng["total_students"] >= 5:
            triggers.append("low_engagement")

        # 4. Trial expiring soon with weak adoption
        if is_trial and org.subscription_end_date:
            days_left = (org.subscription_end_date - now).days
            if 0 < days_left <= 7 and eng["engagement_rate"] < 50:
                triggers.append("trial_expiring")

        return {
            "is_churning": len(triggers) >= 2,
            "triggers": triggers,
            "engagement_rate": eng["engagement_rate"],
            "active_students": eng["active_students"],
            "total_students": eng["total_students"],
        }

    # ── summaries ───────────────────────────────────────────────────────────--

    @staticmethod
    def get_org_health_summary(org_id: str, db: Session) -> Dict:
        """Full health summary shaped for the admin dashboard (frontend OrgHealth)."""
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            return {}

        memberships = CustomerSuccessService._org_memberships(org_id, db)
        health_score = CustomerSuccessService.calculate_org_health_score(org_id, db)
        churn = CustomerSuccessService.detect_churn_risk(org_id, db)

        subscription = (
            db.query(OrganizationSubscription)
            .filter(OrganizationSubscription.organization_id == org_id)
            .first()
        )

        # MRR = paid invoices in the last 30 days
        month_ago = datetime.utcnow() - timedelta(days=30)
        paid = (
            db.query(OrganizationPayment)
            .filter(
                OrganizationPayment.organization_id == org_id,
                OrganizationPayment.status == "paid",
                OrganizationPayment.created_at >= month_ago,
            )
            .all()
        )
        mrr = round(sum(p.amount or 0 for p in paid), 2)

        avg_score = (
            round(sum(m.average_score or 0 for m in memberships) / len(memberships), 1)
            if memberships else 0
        )
        completion_rate = (
            round(sum(m.progress_percent or 0 for m in memberships) / len(memberships), 1)
            if memberships else 0
        )

        return {
            "organization_id": str(org.id),
            "organization_name": org.name,
            "health_score": health_score,
            "status": CustomerSuccessService.get_org_health_status(health_score),
            "subscription_tier": (subscription.tier if subscription else org.subscription_tier) or "trial",
            "active_students": churn["active_students"],
            "total_students": churn["total_students"],
            "engagement_rate": churn["engagement_rate"],
            "is_churning": churn["is_churning"],
            "churn_triggers": churn["triggers"],
            "mrr": mrr,
            "avg_score": avg_score,
            "completion_rate": completion_rate,
        }

    @staticmethod
    def get_all_orgs_health(db: Session) -> List[Dict]:
        """Health summary for every org, sorted by churn risk then health score."""
        orgs = db.query(Organization).all()
        summaries = [CustomerSuccessService.get_org_health_summary(o.id, db) for o in orgs]
        summaries = [s for s in summaries if s]
        summaries.sort(key=lambda s: (not s.get("is_churning"), -s.get("health_score", 0)))
        return summaries

    # ── actions ───────────────────────────────────────────────────────────────

    @staticmethod
    def flag_for_outreach(org_id: str, reason: str, db: Session) -> bool:
        """Email the org admin a health alert (best effort)."""
        from services.notification_service import NotificationService

        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org or not org.admin_email:
            return False
        try:
            return NotificationService.send_cs_alert(
                admin_email=org.admin_email,
                organization_name=org.name,
                alert_type=reason,
            )
        except Exception:
            return False
