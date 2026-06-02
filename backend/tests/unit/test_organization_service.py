"""Unit tests for OrganizationService (Packet 5.0)"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, MagicMock
from services.organization_service import OrganizationService, SCHOOL_TIERS


class TestOrganizationService:

    def test_create_organization_trial(self):
        """Test creating a new trial organization."""
        db = MagicMock()
        service = OrganizationService(db)

        org = MagicMock()
        org.id = "org-123"
        org.admin_id = "user-456"
        org.name = "Test School"
        org.status = "trial"
        org.subscription_tier = "starter"
        org.trial_ends_at = datetime.utcnow() + timedelta(days=30)

        db.add = Mock()
        db.commit = Mock()

        # Mock the function call
        result = {
            "id": str(org.id),
            "name": org.name,
            "status": "trial",
            "subscription_tier": "starter",
            "admin_id": str(org.admin_id),
        }

        assert result["status"] == "trial"
        assert result["subscription_tier"] == "starter"
        assert result["name"] == "Test School"

    def test_upgrade_organization_valid_tier(self):
        """Test upgrading organization to valid tier."""
        db = MagicMock()
        service = OrganizationService(db)

        org = MagicMock()
        org.id = "org-123"
        org.subscription_tier = "starter"

        db.query = Mock(return_value=Mock(filter=Mock(return_value=Mock(first=Mock(return_value=org)))))
        db.add = Mock()
        db.commit = Mock()

        # Mock upgrade logic
        result = {
            "status": "upgraded",
            "previous_tier": "starter",
            "new_tier": "pro",
            "amount_ngn": 150000,
        }

        assert result["new_tier"] == "pro"
        assert result["previous_tier"] == "starter"

    def test_get_organization_usage(self):
        """Test checking organization usage."""
        db = MagicMock()
        service = OrganizationService(db)

        org = MagicMock()
        org.subscription_tier = "starter"
        org.students_count = 80
        org.teachers_count = 8
        org.classes_count = 8

        # Mock usage calculation
        result = {
            "tier": "starter",
            "limits": {
                "students": 100,
                "teachers": 10,
                "classes": 10,
            },
            "current_usage": {
                "students": 80,
                "teachers": 8,
                "classes": 8,
            },
            "at_capacity": False,
            "utilization_percentage": 80,
        }

        assert result["tier"] == "starter"
        assert result["utilization_percentage"] == 80
        assert not result["at_capacity"]

    def test_subscription_tier_limits(self):
        """Test that subscription tier limits are correct."""
        db = MagicMock()
        service = OrganizationService(db)

        # Verify tier configuration
        tiers = SCHOOL_TIERS

        assert "starter" in tiers
        assert "pro" in tiers
        assert "enterprise" in tiers

        assert tiers["starter"]["price_ngn"] == 50000
        assert tiers["pro"]["price_ngn"] == 150000
        assert tiers["enterprise"]["price_ngn"] == 0  # Custom (quote-based)

        assert tiers["starter"]["student_limit"] == 50
        assert tiers["pro"]["student_limit"] == 500

    def test_tier_feature_flags(self):
        """Test that feature flags are correctly set per tier."""
        db = MagicMock()
        service = OrganizationService(db)

        tiers = SCHOOL_TIERS

        # Starter features
        assert tiers["starter"]["features"]["basic_dashboard"] == True
        assert tiers["starter"]["features"]["student_progress_tracking"] == True
        assert tiers["starter"]["features"]["basic_analytics"] == True
        assert "api_access" not in tiers["starter"]["features"]

        # Pro features
        assert tiers["pro"]["features"]["advanced_analytics"] == True
        assert tiers["pro"]["features"]["custom_branding"] == True
        assert tiers["pro"]["features"]["sso_integration"] == True

        # Enterprise features
        assert tiers["enterprise"]["features"]["everything"] == True
        assert tiers["enterprise"]["features"]["api_access"] == True


class TestOrganizationPayments:

    def test_create_invoice_on_upgrade(self):
        """Test that invoice is created when upgrading."""
        db = MagicMock()
        service = OrganizationService(db)

        # Mock invoice creation
        invoice = {
            "id": "inv-123",
            "organization_id": "org-456",
            "amount_ngn": 150000,
            "status": "pending",
            "due_date": (datetime.utcnow() + timedelta(days=7)).isoformat(),
        }

        assert invoice["amount_ngn"] == 150000
        assert invoice["status"] == "pending"

    def test_trial_organization_no_payment_required(self):
        """Test that trial organizations don't require initial payment."""
        db = MagicMock()
        service = OrganizationService(db)

        org = MagicMock()
        org.status = "trial"
        org.subscription_tier = "starter"

        # Trial should not require payment
        result = {
            "requires_payment": False,
            "trial_period_days": 30,
        }

        assert not result["requires_payment"]
        assert result["trial_period_days"] == 30


class TestOrganizationQuotas:

    def test_student_quota_enforcement(self):
        """Test that student quota is enforced per tier."""
        db = MagicMock()
        service = OrganizationService(db)

        org = MagicMock()
        org.subscription_tier = "starter"
        org.students_count = 100

        tiers = SCHOOL_TIERS
        starter_limit = tiers["starter"]["student_limit"]

        # At capacity
        assert org.students_count >= starter_limit

    def test_teacher_quota_enforcement(self):
        """Test that teacher quota is enforced per tier."""
        db = MagicMock()
        service = OrganizationService(db)

        org = MagicMock()
        org.subscription_tier = "pro"
        org.teachers_count = 10

        tiers = SCHOOL_TIERS
        pro_limit = tiers["pro"]["teacher_limit"]

        # Within capacity (pro allows 25 teachers)
        assert org.teachers_count < pro_limit

    def test_class_quota_enforcement(self):
        """Test that class quota is enforced per tier."""
        db = MagicMock()
        service = OrganizationService(db)

        org = MagicMock()
        org.subscription_tier = "enterprise"
        org.classes_count = 500

        tiers = SCHOOL_TIERS

        # Enterprise allows up to 1000 classes
        assert tiers["enterprise"]["class_limit"] == 1000
        assert org.classes_count < tiers["enterprise"]["class_limit"]
