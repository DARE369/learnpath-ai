"""
Unit tests for SubscriptionService + PaymentService (Packet 4.1).

Covers the pure logic only — plan catalogue, pricing, proration, renewal-date
math, usage percentages, and PaymentService's safe-by-default behaviour and
webhook parsing. No DB session or network is required, so these run in CI.
"""

from datetime import datetime, timedelta

import pytest

from services.subscription_service import (
    SubscriptionService,
    PlanNotFoundError,
    UNLIMITED,
)
from services.payment_service import PaymentService, PaymentError


@pytest.fixture
def svc():
    return SubscriptionService()


# ─── Plan catalogue ───────────────────────────────────────────────────────────

def test_three_plans_exist(svc):
    assert set(svc.PLANS) == {"free", "pro", "premium"}


def test_get_plan_unknown_raises(svc):
    with pytest.raises(PlanNotFoundError):
        svc.get_plan("enterprise")


def test_free_plan_is_zero_cost(svc):
    assert svc.PLANS["free"]["price"] == 0


def test_premium_limits_unlimited(svc):
    p = svc.PLANS["premium"]
    assert p["videos_per_month"] >= UNLIMITED
    assert p["questions_per_day"] >= UNLIMITED


# ─── Pricing ──────────────────────────────────────────────────────────────────

def test_monthly_price(svc):
    assert svc.plan_price("pro", "monthly") == 2999


def test_yearly_price_is_ten_months(svc):
    assert svc.plan_price("pro", "yearly") == 2999 * 10


def test_period_days(svc):
    assert svc.period_days("monthly") == 30
    assert svc.period_days("yearly") == 365


# ─── Upgrade / downgrade classification ───────────────────────────────────────

def test_is_upgrade(svc):
    assert svc.is_upgrade("free", "pro")
    assert svc.is_upgrade("pro", "premium")
    assert not svc.is_upgrade("premium", "pro")


def test_is_downgrade(svc):
    assert svc.is_downgrade("premium", "pro")
    assert svc.is_downgrade("pro", "free")
    assert not svc.is_downgrade("free", "pro")


# ─── Renewal date ─────────────────────────────────────────────────────────────

def test_monthly_renewal_30_days(svc):
    start = datetime(2026, 1, 1)
    assert svc.compute_renewal_date(start, "monthly") == start + timedelta(days=30)


def test_yearly_renewal_365_days(svc):
    start = datetime(2026, 1, 1)
    assert svc.compute_renewal_date(start, "yearly") == start + timedelta(days=365)


# ─── Proration ────────────────────────────────────────────────────────────────

def test_prorated_credit_half_period(svc):
    # 15 of 30 days remaining on Pro monthly → half of ₦2999
    credit = svc.prorated_credit("pro", "monthly", 15)
    assert credit == pytest.approx(1499.5, abs=0.01)


def test_prorated_credit_clamped(svc):
    # more days than the period can't exceed the full price
    assert svc.prorated_credit("pro", "monthly", 999) == 2999
    assert svc.prorated_credit("pro", "monthly", -5) == 0


def test_upgrade_charge_subtracts_credit(svc):
    # Upgrading free→pro mid-cycle: free has zero credit, so full price.
    assert svc.upgrade_charge("free", "pro", "monthly", 15) == 2999
    # pro→premium with 15 days left: premium price minus half of pro price.
    charge = svc.upgrade_charge("pro", "premium", "monthly", 15)
    assert charge == pytest.approx(9999 - 1499.5, abs=0.01)


def test_upgrade_charge_floored_at_zero(svc):
    # A huge credit can never produce a negative charge.
    assert svc.upgrade_charge("premium", "premium", "monthly", 30) >= 0


# ─── Usage percentage / remaining ─────────────────────────────────────────────

def test_usage_percentage_basic(svc):
    assert svc.usage_percentage(5, 10) == 50.0


def test_usage_percentage_caps_at_100(svc):
    assert svc.usage_percentage(20, 10) == 100.0


def test_usage_percentage_unlimited_is_zero(svc):
    assert svc.usage_percentage(500, UNLIMITED) == 0.0


def test_remaining_unlimited(svc):
    assert svc._remaining(500, UNLIMITED) == UNLIMITED


def test_remaining_never_negative(svc):
    assert svc._remaining(15, 10) == 0


# ─── PaymentService: safe by default ──────────────────────────────────────────

@pytest.fixture
def pay():
    p = PaymentService()
    p.secret_key = None  # force unconfigured regardless of env
    p.webhook_secret = None
    return p


def test_payment_not_configured(pay):
    assert pay.is_configured is False


def test_headers_raise_without_key(pay):
    with pytest.raises(PaymentError):
        pay._headers()


def test_webhook_signature_rejected_without_secret(pay):
    assert pay.verify_webhook_signature("anything", b"{}") is False


def test_webhook_signature_exact_match():
    p = PaymentService()
    p.webhook_secret = "supersecret"
    assert p.verify_webhook_signature("supersecret", b"{}") is True
    assert p.verify_webhook_signature("wrong", b"{}") is False


def test_parse_webhook_successful():
    p = PaymentService()
    parsed = p.parse_webhook_event({"data": {"tx_ref": "LP-abc", "status": "successful", "id": 42}})
    assert parsed == {"reference": "LP-abc", "status": "successful", "flutterwave_id": 42}


def test_parse_webhook_failed_status():
    p = PaymentService()
    parsed = p.parse_webhook_event({"data": {"tx_ref": "LP-xyz", "status": "failed"}})
    assert parsed["status"] == "failed"


def test_parse_webhook_missing_ref_raises():
    p = PaymentService()
    with pytest.raises(PaymentError):
        p.parse_webhook_event({"data": {"status": "successful"}})
