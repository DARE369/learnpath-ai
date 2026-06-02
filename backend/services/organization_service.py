"""Organization and school management service (Packet 5.0)"""

import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Optional, List
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

SCHOOL_TIERS = {
    "starter": {
        "name": "Starter",
        "price_ngn": 50000,
        "price_usd": 35,
        "student_limit": 50,
        "teacher_limit": 3,
        "class_limit": 5,
        "features": {
            "basic_dashboard": True,
            "student_progress_tracking": True,
            "basic_analytics": True,
            "email_support": True,
            "offline_mode": True
        }
    },
    "pro": {
        "name": "Pro",
        "price_ngn": 150000,
        "price_usd": 100,
        "student_limit": 500,
        "teacher_limit": 25,
        "class_limit": 50,
        "features": {
            "basic_dashboard": True,
            "student_progress_tracking": True,
            "advanced_analytics": True,
            "email_support": True,
            "priority_support": True,
            "offline_mode": True,
            "custom_branding": True,
            "sso_integration": True
        }
    },
    "enterprise": {
        "name": "Enterprise",
        "price_ngn": 0,  # Custom pricing
        "student_limit": 10000,
        "teacher_limit": 500,
        "class_limit": 1000,
        "features": {
            "everything": True,
            "api_access": True,
            "dedicated_account_manager": True,
            "custom_integrations": True,
            "sla_guarantee": True,
            "phone_support": True,
            "training_included": True
        }
    }
}


class OrganizationService:
    def __init__(self, db: Session):
        self.db = db

    async def create_organization(self, org_data: Dict) -> Dict:
        """Create new organization (school) account"""
        from models import Organization, OrganizationSubscription

        org = Organization(
            id=uuid.uuid4(),
            name=org_data.get("name"),
            type=org_data.get("type", "school"),
            country=org_data.get("country"),
            city=org_data.get("city"),
            admin_email=org_data.get("admin_email"),
            admin_name=org_data.get("admin_name"),
            phone=org_data.get("phone"),
            website=org_data.get("website"),
            subscription_tier="trial",
            subscription_start_date=datetime.utcnow(),
            subscription_end_date=datetime.utcnow() + timedelta(days=30),
            status="trial"
        )
        self.db.add(org)
        self.db.commit()
        self.db.refresh(org)

        # Create trial subscription
        trial_config = SCHOOL_TIERS["starter"]
        subscription = OrganizationSubscription(
            id=uuid.uuid4(),
            organization_id=org.id,
            tier="trial",
            student_limit=trial_config["student_limit"],
            teacher_limit=trial_config["teacher_limit"],
            class_limit=trial_config["class_limit"],
            features=trial_config["features"],
            start_date=datetime.utcnow(),
            end_date=datetime.utcnow() + timedelta(days=30),
            auto_renew=False,
            status="active"
        )
        self.db.add(subscription)
        self.db.commit()

        logger.info(f"Organization created: {org.id}")
        return {
            "organization_id": str(org.id),
            "trial_days": 30,
            "admin_email": org.admin_email
        }

    async def upgrade_organization(self, org_id: str, new_tier: str) -> Dict:
        """Upgrade organization to paid tier"""
        from models import Organization, OrganizationSubscription, OrganizationPayment

        if new_tier not in SCHOOL_TIERS:
            raise ValueError(f"Invalid tier: {new_tier}")

        org = self.db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            raise ValueError(f"Organization not found: {org_id}")

        tier_config = SCHOOL_TIERS[new_tier]

        # Create new subscription
        subscription = OrganizationSubscription(
            id=uuid.uuid4(),
            organization_id=org_id,
            tier=new_tier,
            student_limit=tier_config["student_limit"],
            teacher_limit=tier_config["teacher_limit"],
            class_limit=tier_config["class_limit"],
            features=tier_config["features"],
            start_date=datetime.utcnow(),
            end_date=datetime.utcnow() + timedelta(days=30),
            auto_renew=True,
            status="active"
        )
        self.db.add(subscription)

        # Create invoice
        invoice = OrganizationPayment(
            id=uuid.uuid4(),
            organization_id=org_id,
            subscription_id=subscription.id,
            amount=tier_config["price_ngn"],
            currency="NGN",
            billing_period_start=datetime.utcnow().date(),
            billing_period_end=(datetime.utcnow() + timedelta(days=30)).date(),
            invoice_number=f"INV-{org_id[:8]}-{datetime.utcnow().strftime('%Y%m%d')}",
            status="pending",
            due_date=(datetime.utcnow() + timedelta(days=30)).date()
        )
        self.db.add(invoice)

        # Update organization
        org.subscription_tier = new_tier
        org.subscription_start_date = datetime.utcnow()
        org.subscription_end_date = datetime.utcnow() + timedelta(days=30)

        self.db.commit()

        logger.info(f"Organization upgraded: {org_id} -> {new_tier}")
        return {
            "invoice_id": str(invoice.id),
            "amount": tier_config["price_ngn"],
            "currency": "NGN"
        }

    async def get_organization_usage(self, org_id: str) -> Dict:
        """Check current usage vs limits"""
        from models import Organization, OrganizationSubscription, Teacher, Class, ClassMembership

        org = self.db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            raise ValueError(f"Organization not found: {org_id}")

        subscription = self.db.query(OrganizationSubscription).filter(
            OrganizationSubscription.organization_id == org_id,
            OrganizationSubscription.status == "active"
        ).first()

        if not subscription:
            raise ValueError(f"No active subscription: {org_id}")

        # Count current usage
        teacher_count = self.db.query(Teacher).filter(Teacher.organization_id == org_id).count()
        classes = self.db.query(Class).filter(Class.organization_id == org_id).all()
        class_ids = [c.id for c in classes]

        student_count = self.db.query(ClassMembership).filter(
            ClassMembership.class_id.in_(class_ids)
        ).count() if class_ids else 0

        return {
            "students": {
                "used": student_count,
                "limit": subscription.student_limit,
                "percent": (student_count / subscription.student_limit * 100) if subscription.student_limit > 0 else 0
            },
            "teachers": {
                "used": teacher_count,
                "limit": subscription.teacher_limit,
                "percent": (teacher_count / subscription.teacher_limit * 100) if subscription.teacher_limit > 0 else 0
            },
            "classes": {
                "used": len(classes),
                "limit": subscription.class_limit,
                "percent": (len(classes) / subscription.class_limit * 100) if subscription.class_limit > 0 else 0
            },
            "upgrade_needed": (student_count >= subscription.student_limit * 0.9) or 
                             (teacher_count >= subscription.teacher_limit * 0.9)
        }
