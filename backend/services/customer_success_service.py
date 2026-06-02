"""Customer success service for org health scoring and churn detection (Packet 6.5)"""

from datetime import datetime, timedelta
from typing import Optional, Dict, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from models import (
    Organization,
    OrganizationSubscription,
    OrganizationPayment,
    User,
    PathSession,
    SchoolAnalytics,
)


class CustomerSuccessService:
    """Analyze organization health and detect churn risk."""

    @staticmethod
    def calculate_org_health_score(org_id: str, db: Session) -> int:
        """
        Calculate composite health score (0-100).

        Factors:
        - Active student engagement (last 7 days): 30%
        - Progress rate (quizzes completed): 30%
        - Login frequency (last 30 days): 20%
        - Invoice payment status: 10%
        - Trial conversion readiness: 10%
        """
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            return 0

        scores = {}

        # 1. Active student engagement (30%)
        now = datetime.utcnow()
        week_ago = now - timedelta(days=7)

        active_students = (
            db.query(User)
            .filter(User.organization_id == org_id)
            .join(
                PathSession,
                (User.id == PathSession.user_id)
                & (PathSession.created_at >= week_ago),
            )
            .distinct()
            .count()
        )

        total_students = db.query(User).filter(User.organization_id == org_id).count()
        engagement_rate = (active_students / total_students * 100) if total_students > 0 else 0
        scores["engagement"] = min(100, engagement_rate) * 0.30

        # 2. Progress rate (30%) - quiz completions per student
        thirty_days_ago = now - timedelta(days=30)

        from models import QuestionAnswer

        quiz_completions = (
            db.query(func.count(QuestionAnswer.id))
            .join(User)
            .filter(
                User.organization_id == org_id,
                QuestionAnswer.created_at >= thirty_days_ago,
            )
            .scalar()
            or 0
        )

        expected_quizzes = total_students * 4  # ~4 quizzes per student per month
        progress_rate = (quiz_completions / expected_quizzes * 100) if expected_quizzes > 0 else 0
        scores["progress"] = min(100, progress_rate) * 0.30

        # 3. Login frequency (20%)
        month_ago = now - timedelta(days=30)

        active_days = (
            db.query(func.count(func.distinct(func.date(PathSession.created_at))))
            .join(User)
            .filter(
                User.organization_id == org_id,
                PathSession.created_at >= month_ago,
            )
            .scalar()
            or 0
        )

        expected_days = 22  # ~22 working days per month
        frequency_score = (active_days / expected_days * 100) if expected_days > 0 else 0
        scores["frequency"] = min(100, frequency_score) * 0.20

        # 4. Invoice payment status (10%)
        invoice_score = 100
        payments = (
            db.query(OrganizationPayment)
            .filter(Organization.id == org_id)
            .order_by(OrganizationPayment.created_at.desc())
            .first()
        )

        if payments and payments.status == "failed":
            invoice_score = 50
        elif payments and payments.status == "overdue":
            invoice_score = 0

        scores["invoice"] = invoice_score * 0.10

        # 5. Trial conversion readiness (10%)
        subscription = (
            db.query(OrganizationSubscription)
            .filter(OrganizationSubscription.organization_id == org_id)
            .first()
        )

        trial_score = 100
        if subscription and subscription.tier == "trial":
            trial_created = subscription.created_at
            days_in_trial = (now - trial_created).days

            if days_in_trial < 3:
                trial_score = 50  # Too early to judge
            elif days_in_trial < 7:
                # Check usage depth in first week
                if active_students < 5:
                    trial_score = 30  # Low adoption
            elif engagement_rate < 20:
                trial_score = 0  # Not converting

        scores["trial"] = trial_score * 0.10

        # Total composite score
        total_score = int(sum(scores.values()))
        return max(0, min(100, total_score))

    @staticmethod
    def get_org_health_status(score: int) -> str:
        """Classify health status based on score."""
        if score >= 70:
            return "healthy"
        elif score >= 40:
            return "at_risk"
        else:
            return "churning"

    @staticmethod
    def detect_churn_risk(org_id: str, db: Session) -> Dict[str, any]:
        """
        Detect if organization is at risk of churning.

        Triggers:
        - Inactive >14 days on paid plan
        - Invoice overdue
        - Below 30% student engagement
        - Trial expiring in 7 days (not converting)
        """
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            return {"is_churning": False, "triggers": []}

        triggers = []
        now = datetime.utcnow()

        # 1. Inactivity check
        fourteen_days_ago = now - timedelta(days=14)

        last_session = (
            db.query(PathSession)
            .join(User)
            .filter(
                User.organization_id == org_id,
                PathSession.created_at >= fourteen_days_ago,
            )
            .order_by(PathSession.created_at.desc())
            .first()
        )

        subscription = (
            db.query(OrganizationSubscription)
            .filter(OrganizationSubscription.organization_id == org_id)
            .first()
        )

        if not last_session and subscription and subscription.tier != "trial":
            triggers.append("inactive_14_days")

        # 2. Invoice status
        payment = (
            db.query(OrganizationPayment)
            .filter(OrganizationPayment.organization_id == org_id)
            .order_by(OrganizationPayment.created_at.desc())
            .first()
        )

        if payment and payment.status == "overdue":
            triggers.append("invoice_overdue")

        # 3. Engagement rate
        total_students = db.query(User).filter(User.organization_id == org_id).count()

        seven_days_ago = now - timedelta(days=7)
        active_students = (
            db.query(User)
            .filter(User.organization_id == org_id)
            .join(
                PathSession,
                (User.id == PathSession.user_id)
                & (PathSession.created_at >= seven_days_ago),
            )
            .distinct()
            .count()
        )

        engagement_rate = (active_students / total_students * 100) if total_students > 0 else 0

        if engagement_rate < 30 and total_students >= 5:
            triggers.append("low_engagement")

        # 4. Trial expiration
        if subscription and subscription.tier == "trial":
            trial_expiry = subscription.created_at + timedelta(days=30)
            days_until_expiry = (trial_expiry - now).days

            if days_until_expiry <= 7 and days_until_expiry > 0:
                if engagement_rate < 50:
                    triggers.append("trial_expiring_low_conversion")

        is_churning = len(triggers) >= 2

        return {
            "is_churning": is_churning,
            "triggers": triggers,
            "engagement_rate": round(engagement_rate, 1),
            "active_students": active_students,
            "total_students": total_students,
        }

    @staticmethod
    def get_org_health_summary(org_id: str, db: Session) -> Dict[str, any]:
        """Get comprehensive health summary for customer success team."""
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            return {}

        health_score = CustomerSuccessService.calculate_org_health_score(org_id, db)
        status = CustomerSuccessService.get_org_health_status(health_score)
        churn_risk = CustomerSuccessService.detect_churn_risk(org_id, db)

        # Get subscription info
        subscription = (
            db.query(OrganizationSubscription)
            .filter(OrganizationSubscription.organization_id == org_id)
            .first()
        )

        # Get latest analytics
        analytics = (
            db.query(SchoolAnalytics)
            .filter(SchoolAnalytics.organization_id == org_id)
            .order_by(SchoolAnalytics.date.desc())
            .first()
        )

        # Calculate MRR (Monthly Recurring Revenue)
        now = datetime.utcnow()
        month_ago = now - timedelta(days=30)

        recent_payments = (
            db.query(OrganizationPayment)
            .filter(
                OrganizationPayment.organization_id == org_id,
                OrganizationPayment.created_at >= month_ago,
                OrganizationPayment.status == "successful",
            )
            .all()
        )

        mrr = sum(p.amount for p in recent_payments)

        return {
            "organization_id": org_id,
            "organization_name": org.name,
            "health_score": health_score,
            "status": status,
            "subscription_tier": subscription.tier if subscription else "free",
            "subscription_seats": subscription.seats if subscription else 0,
            "active_students": churn_risk.get("active_students", 0),
            "total_students": churn_risk.get("total_students", 0),
            "engagement_rate": churn_risk.get("engagement_rate", 0),
            "is_churning": churn_risk.get("is_churning", False),
            "churn_triggers": churn_risk.get("triggers", []),
            "mrr": round(mrr, 2),
            "avg_score": analytics.avg_score if analytics else 0,
            "completion_rate": analytics.completion_rate if analytics else 0,
            "last_active": analytics.date if analytics else None,
        }

    @staticmethod
    def get_all_orgs_health(db: Session) -> List[Dict[str, any]]:
        """Get health summary for all organizations (for admin dashboard)."""
        orgs = db.query(Organization).all()

        summaries = []
        for org in orgs:
            summary = CustomerSuccessService.get_org_health_summary(org.id, db)
            summaries.append(summary)

        # Sort by churn risk first, then by health score
        summaries.sort(key=lambda x: (not x.get("is_churning"), -x.get("health_score", 0)))

        return summaries

    @staticmethod
    def flag_for_outreach(org_id: str, reason: str, db: Session):
        """Flag organization for customer success outreach."""
        # In production, this would write to a support ticket system
        # or send a message to the CS team in Slack

        from services.notification_service import NotificationService

        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            return

        admin_email = db.query(User).filter(User.id == org.admin_id).first().email

        NotificationService.send_cs_alert(
            admin_email=admin_email,
            organization_name=org.name,
            alert_type=reason,
        )
