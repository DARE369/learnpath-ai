"""Unit tests for ADMIN-2.4 billing service.

All tests use mock DB sessions — no real database required.
"""

import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch, call

import pytest

from services.billing_service import BillingService, PLAN_CATALOGUE


# ── Fixtures ───────────────────────────────────────────────────────────────

@pytest.fixture
def svc():
    return BillingService()


def _ids():
    return {"school": str(uuid.uuid4()), "user": str(uuid.uuid4())}


def _make_plan(slug="pro"):
    catalogue = next(p for p in PLAN_CATALOGUE if p["plan_slug"] == slug)
    plan = MagicMock()
    plan.id = uuid.uuid4()
    plan.plan_slug = catalogue["plan_slug"]
    plan.plan_name = catalogue["plan_name"]
    plan.description = catalogue["description"]
    plan.monthly_price = catalogue["monthly_price"]
    plan.annual_price = catalogue["annual_price"]
    plan.features = catalogue["features"]
    plan.is_active = True
    plan.display_order = catalogue["display_order"]
    return plan


def _make_sub(school_id, plan_slug="pro"):
    plan = _make_plan(plan_slug)
    sub = MagicMock()
    sub.id = uuid.uuid4()
    sub.school_id = uuid.UUID(school_id)
    sub.plan_id = plan.id
    sub.plan_name = plan.plan_name
    sub.monthly_price = plan.monthly_price
    sub.billing_cycle = "monthly"
    sub.status = "active"
    sub.auto_renew = True
    sub.started_at = datetime.utcnow() - timedelta(days=90)
    renews = date.today().replace(day=1)
    if renews.month == 12:
        renews = renews.replace(year=renews.year + 1, month=1)
    else:
        renews = renews.replace(month=renews.month + 1)
    sub.renews_at = datetime(renews.year, renews.month, 1)
    sub.max_teachers = plan.features["max_teachers"]
    sub.max_students = plan.features["max_students"]
    sub.max_classes = plan.features["max_classes"]
    sub.max_storage_gb = Decimal(str(plan.features["storage_gb"]))
    sub.max_api_calls = plan.features["max_api_calls"]
    sub.billing_contact_email = "admin@school.edu"
    sub.billing_contact_name = "Principal Smith"
    return sub, plan


def _make_db_with_sub(sub, plan):
    db = MagicMock()

    def query_side(model):
        q = MagicMock()
        q.filter_by.return_value = q
        q.filter.return_value = q
        q.first.return_value = None
        q.all.return_value = []
        q.count.return_value = 0
        q.order_by.return_value = q
        q.offset.return_value = q
        q.limit.return_value = q

        name = getattr(model, "__name__", "")
        if name == "SchoolBillingSubscription":
            q.filter_by.return_value.first.return_value = sub
        if name == "SchoolBillingPlan":
            q.filter_by.return_value.first.return_value = plan
        return q

    db.query.side_effect = query_side
    db.add = MagicMock()
    db.flush = MagicMock()
    db.commit = MagicMock()
    db.delete = MagicMock()
    return db


# ── Plan catalogue ─────────────────────────────────────────────────────────

class TestPlanCatalogue:
    def test_three_plans_defined(self):
        assert len(PLAN_CATALOGUE) == 3

    def test_slugs_are_unique(self):
        slugs = [p["plan_slug"] for p in PLAN_CATALOGUE]
        assert len(set(slugs)) == 3

    def test_enterprise_is_most_expensive(self):
        prices = {p["plan_slug"]: p["monthly_price"] for p in PLAN_CATALOGUE}
        assert prices["enterprise"] > prices["pro"] > prices["starter"]

    def test_all_have_required_features(self):
        required = {"max_teachers", "max_students", "max_classes", "storage_gb", "max_api_calls"}
        for p in PLAN_CATALOGUE:
            assert required.issubset(set(p["features"].keys()))

    def test_enterprise_limits_are_effectively_unlimited(self):
        ent = next(p for p in PLAN_CATALOGUE if p["plan_slug"] == "enterprise")
        assert ent["features"]["max_students"] >= 999_999

    def test_annual_price_lower_than_12x_monthly(self):
        for p in PLAN_CATALOGUE:
            assert p["annual_price"] < p["monthly_price"] * 12


# ── seed_plans ─────────────────────────────────────────────────────────────

class TestSeedPlans:
    def test_inserts_three_plans_when_empty(self, svc):
        db = MagicMock()
        db.query.return_value.filter_by.return_value.first.return_value = None
        db.add = MagicMock()
        db.commit = MagicMock()
        svc.seed_plans(db)
        assert db.add.call_count == 3
        db.commit.assert_called_once()

    def test_is_idempotent(self, svc):
        db = MagicMock()
        existing = MagicMock()
        db.query.return_value.filter_by.return_value.first.return_value = existing
        db.add = MagicMock()
        svc.seed_plans(db)
        db.add.assert_not_called()

    def test_skips_existing_slugs(self, svc):
        db = MagicMock()
        call_results = [MagicMock(), None, None]

        def first_side_effect():
            return call_results.pop(0) if call_results else None

        db.query.return_value.filter_by.return_value.first.side_effect = first_side_effect
        db.add = MagicMock()
        db.commit = MagicMock()
        svc.seed_plans(db)
        assert db.add.call_count == 2


# ── get_plans ──────────────────────────────────────────────────────────────

class TestGetPlans:
    def test_returns_formatted_list(self, svc):
        pro = _make_plan("pro")
        db = MagicMock()
        db.query.return_value.filter_by.return_value.first.return_value = None
        db.query.return_value.filter_by.return_value.order_by.return_value.all.return_value = [pro]
        db.add = MagicMock()
        db.commit = MagicMock()

        with patch.object(svc, "seed_plans"):
            db.query.return_value.filter_by.return_value.order_by.return_value.all.return_value = [pro]
            result = svc.get_plans(db)

        assert isinstance(result, list)

    def test_format_plan_structure(self, svc):
        plan = _make_plan("starter")
        formatted = svc._format_plan(plan)
        assert "plan_id" in formatted
        assert "plan_slug" in formatted
        assert "monthly_price" in formatted
        assert "features" in formatted
        assert isinstance(formatted["monthly_price"], float)


# ── _compute_usage ─────────────────────────────────────────────────────────

class TestComputeUsage:
    def test_returns_all_five_metrics(self, svc):
        ids = _ids()
        sub, plan = _make_sub(ids["school"])
        db = MagicMock()
        db.query.return_value.filter_by.return_value.count.return_value = 5
        db.query.return_value.filter_by.return_value.join.return_value.filter.return_value.scalar.return_value = 100
        db.query.return_value.join.return_value.filter.return_value.scalar.return_value = 100
        db.query.return_value.filter.return_value.count.return_value = 0
        # Mock the scalar query
        db.query.return_value.scalar.return_value = 100
        db.query.return_value.filter_by.return_value.scalar.return_value = 100

        usage = svc._compute_usage(db, ids["school"], sub)
        assert set(usage.keys()) == {"teachers", "students", "classes", "storage_gb", "api_calls"}

    def test_pct_capped_at_100(self, svc):
        ids = _ids()
        sub, _ = _make_sub(ids["school"])
        sub.max_teachers = 5  # Set low so count exceeds it
        db = MagicMock()
        db.query.return_value.filter_by.return_value.count.return_value = 100
        db.query.return_value.join.return_value.filter.return_value.scalar.return_value = 0
        db.query.return_value.filter.return_value.count.return_value = 0
        db.query.return_value.scalar.return_value = 0

        usage = svc._compute_usage(db, ids["school"], sub)
        assert usage["teachers"]["pct"] == 100


# ── _compute_forecast ──────────────────────────────────────────────────────

class TestComputeForecast:
    def test_returns_empty_when_well_under_limits(self, svc):
        _, sub = _make_sub(str(uuid.uuid4()))
        usage = {
            "teachers":   {"used": 5,   "limit": 50,   "pct": 10},
            "students":   {"used": 100, "limit": 2000, "pct": 5},
            "classes":    {"used": 10,  "limit": 100,  "pct": 10},
            "storage_gb": {"used": 1,   "limit": 100,  "pct": 1},
            "api_calls":  {"used": 100, "limit": 1_000_000, "pct": 0},
        }
        warnings = svc._compute_forecast(usage, sub)
        # Should have no critical warnings with very low usage
        criticals = [w for w in warnings if w["severity"] == "critical"]
        assert len(criticals) == 0

    def test_warns_when_near_limit(self, svc):
        _, sub = _make_sub(str(uuid.uuid4()))
        usage = {
            "teachers":   {"used": 49,  "limit": 50,   "pct": 98},
            "students":   {"used": 1900, "limit": 2000, "pct": 95},
            "classes":    {"used": 10,  "limit": 100,  "pct": 10},
            "storage_gb": {"used": 1,   "limit": 100,  "pct": 1},
            "api_calls":  {"used": 100, "limit": 1_000_000, "pct": 0},
        }
        warnings = svc._compute_forecast(usage, sub)
        metrics = {w["metric"] for w in warnings}
        assert "students" in metrics


# ── upgrade_plan ───────────────────────────────────────────────────────────

class TestUpgradePlan:
    def test_upgrades_to_enterprise(self, svc):
        ids = _ids()
        sub, pro_plan = _make_sub(ids["school"], "pro")
        ent_plan = _make_plan("enterprise")
        db = MagicMock()

        def query_side(model):
            q = MagicMock()
            q.filter_by.return_value = q
            q.filter.return_value = q
            q.first.return_value = None
            q.order_by.return_value = q
            q.count.return_value = 0

            name = getattr(model, "__name__", "")
            if name == "SchoolBillingSubscription":
                q.filter_by.return_value.first.return_value = sub
            elif name == "SchoolBillingPlan":
                def fb(**kwargs):
                    inner = MagicMock()
                    if kwargs.get("plan_slug") == "enterprise":
                        inner.first.return_value = ent_plan
                    elif kwargs.get("id") == sub.plan_id:
                        inner.first.return_value = pro_plan
                    else:
                        inner.first.return_value = None
                    return inner
                q.filter_by.side_effect = fb
            return q

        db.query.side_effect = query_side
        db.add = MagicMock()
        db.flush = MagicMock()
        db.commit = MagicMock()

        with patch.object(svc, "_verify_access"), patch.object(svc, "_log"):
            result = svc.upgrade_plan(db, ids["user"], ids["school"], "enterprise")

        assert result["status"] in ("upgraded", "downgraded")
        assert result["plan_name"] == "Enterprise"
        db.commit.assert_called_once()

    def test_rejects_unknown_plan(self, svc):
        from fastapi import HTTPException
        ids = _ids()
        sub, _ = _make_sub(ids["school"])

        db = MagicMock()

        def query_side(model):
            q = MagicMock()
            q.filter_by.return_value = q
            q.first.return_value = None
            return q

        db.query.side_effect = query_side

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_get_or_create_subscription", return_value=sub), \
             pytest.raises(HTTPException) as exc:
            svc.upgrade_plan(db, ids["user"], ids["school"], "nonexistent_plan")

        assert exc.value.status_code == 404

    def test_proration_positive_on_upgrade(self, svc):
        ids = _ids()
        sub, pro_plan = _make_sub(ids["school"], "pro")
        sub.monthly_price = Decimal("99.00")  # Pretend current is Starter price
        ent_plan = _make_plan("enterprise")
        db = MagicMock()

        def query_side(model):
            q = MagicMock()
            q.filter_by.return_value = q
            q.filter.return_value = q
            q.first.return_value = None
            name = getattr(model, "__name__", "")
            if name == "SchoolBillingSubscription":
                q.filter_by.return_value.first.return_value = sub
            elif name == "SchoolBillingPlan":
                def fb(**kwargs):
                    inner = MagicMock()
                    if kwargs.get("plan_slug") == "enterprise":
                        inner.first.return_value = ent_plan
                    elif kwargs.get("id") == sub.plan_id:
                        inner.first.return_value = pro_plan
                    else:
                        inner.first.return_value = None
                    return inner
                q.filter_by.side_effect = fb
            q.order_by.return_value = q
            q.count.return_value = 0
            return q

        db.query.side_effect = query_side
        db.add = MagicMock()
        db.flush = MagicMock()
        db.commit = MagicMock()

        with patch.object(svc, "_verify_access"), patch.object(svc, "_log"):
            result = svc.upgrade_plan(db, ids["user"], ids["school"], "enterprise")

        # Upgrading from a lower price should yield a positive proration
        assert result["proration_charge"] > 0


# ── list_invoices ──────────────────────────────────────────────────────────

class TestListInvoices:
    def test_returns_paginated_invoices(self, svc):
        ids = _ids()
        sub, plan = _make_sub(ids["school"])

        inv = MagicMock()
        inv.id = uuid.uuid4()
        inv.invoice_number = "INV-2025-01-TEST"
        inv.invoice_date = date(2025, 1, 1)
        inv.total = Decimal("499.00")
        inv.status = "paid"
        inv.email_sent_to = None

        db = MagicMock()

        def query_side(model):
            q = MagicMock()
            q.filter_by.return_value = q
            q.filter.return_value = q
            q.order_by.return_value = q
            q.offset.return_value = q
            q.count.return_value = 1
            q.limit.return_value = q

            name = getattr(model, "__name__", "")
            if name == "SchoolBillingSubscription":
                q.filter_by.return_value.first.return_value = sub
            elif name == "SchoolBillingInvoice":
                q.filter_by.return_value.count.return_value = 1
                q.filter_by.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [inv]
            else:
                q.filter_by.return_value.first.return_value = None
                q.filter_by.return_value.all.return_value = []
            return q

        db.query.side_effect = query_side
        db.add = MagicMock()
        db.commit = MagicMock()

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_get_or_create_subscription", return_value=sub):
            result = svc.list_invoices(db, ids["user"], ids["school"])

        assert "invoices" in result
        assert "pagination" in result
        assert result["pagination"]["total"] == 1

    def test_pagination_structure(self, svc):
        ids = _ids()
        sub, plan = _make_sub(ids["school"])
        db = MagicMock()

        def query_side(model):
            q = MagicMock()
            q.filter_by.return_value = q
            q.filter_by.return_value.count.return_value = 0
            q.filter_by.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = []
            q.filter_by.return_value.first.return_value = None
            return q

        db.query.side_effect = query_side

        with patch.object(svc, "_verify_access"), \
             patch.object(svc, "_get_or_create_subscription", return_value=sub):
            result = svc.list_invoices(db, ids["user"], ids["school"], page=2, page_size=10)

        assert result["pagination"]["page"] == 2
        assert result["pagination"]["page_size"] == 10


# ── email_invoice ──────────────────────────────────────────────────────────

class TestEmailInvoice:
    def test_marks_invoice_sent(self, svc):
        ids = _ids()
        sub, plan = _make_sub(ids["school"])
        sub.billing_contact_email = "finance@school.edu"

        inv = MagicMock()
        inv.id = uuid.uuid4()
        inv.invoice_number = "INV-2025-01-TEST"
        inv.email_sent_to = None

        db = MagicMock()

        def query_side(model):
            q = MagicMock()
            name = getattr(model, "__name__", "")
            q.filter_by.return_value = q
            if name == "SchoolBillingInvoice":
                q.filter_by.return_value.first.return_value = inv
            elif name == "SchoolBillingSubscription":
                q.filter_by.return_value.first.return_value = sub
            else:
                q.filter_by.return_value.first.return_value = None
            return q

        db.query.side_effect = query_side
        db.commit = MagicMock()

        with patch.object(svc, "_verify_access"), patch.object(svc, "_log"):
            result = svc.email_invoice(db, ids["user"], ids["school"], str(inv.id))

        assert result["status"] == "sent"
        assert result["to"] == "finance@school.edu"
        assert inv.email_sent_to == "finance@school.edu"
        db.commit.assert_called_once()

    def test_raises_when_no_email(self, svc):
        from fastapi import HTTPException
        ids = _ids()
        sub, _ = _make_sub(ids["school"])
        sub.billing_contact_email = None

        inv = MagicMock()
        inv.id = uuid.uuid4()

        db = MagicMock()

        def query_side(model):
            q = MagicMock()
            name = getattr(model, "__name__", "")
            q.filter_by.return_value = q
            if name == "SchoolBillingInvoice":
                q.filter_by.return_value.first.return_value = inv
            elif name == "SchoolBillingSubscription":
                q.filter_by.return_value.first.return_value = sub
            else:
                q.filter_by.return_value.first.return_value = None
            return q

        db.query.side_effect = query_side

        with patch.object(svc, "_verify_access"), pytest.raises(HTTPException) as exc:
            svc.email_invoice(db, ids["user"], ids["school"], str(inv.id))

        assert exc.value.status_code == 400

    def test_uses_override_email(self, svc):
        ids = _ids()
        sub, _ = _make_sub(ids["school"])
        sub.billing_contact_email = "billing@school.edu"

        inv = MagicMock()
        inv.id = uuid.uuid4()
        inv.invoice_number = "INV-TEST"

        db = MagicMock()

        def query_side(model):
            q = MagicMock()
            name = getattr(model, "__name__", "")
            q.filter_by.return_value = q
            if name == "SchoolBillingInvoice":
                q.filter_by.return_value.first.return_value = inv
            elif name == "SchoolBillingSubscription":
                q.filter_by.return_value.first.return_value = sub
            else:
                q.filter_by.return_value.first.return_value = None
            return q

        db.query.side_effect = query_side
        db.commit = MagicMock()

        with patch.object(svc, "_verify_access"), patch.object(svc, "_log"):
            result = svc.email_invoice(db, ids["user"], ids["school"], str(inv.id),
                                        to_email="custom@example.com")

        assert result["to"] == "custom@example.com"


# ── Router request models ─────────────────────────────────────────────────

class TestRequestModels:
    def test_upgrade_requires_plan_slug(self):
        from routers.billing import UpgradePlanRequest
        with pytest.raises(Exception):
            UpgradePlanRequest()

    def test_upgrade_defaults_monthly(self):
        from routers.billing import UpgradePlanRequest
        req = UpgradePlanRequest(plan_slug="enterprise")
        assert req.billing_cycle == "monthly"

    def test_email_invoice_optional_email(self):
        from routers.billing import EmailInvoiceRequest
        req = EmailInvoiceRequest()
        assert req.to_email is None

    def test_billing_settings_all_optional(self):
        from routers.billing import BillingSettingsRequest
        req = BillingSettingsRequest()
        assert req.billing_contact_name is None
        assert req.send_invoice_emails is None
