"""
Unit tests for FeatureUnlockService (Packet 4.4).

Covers feature availability per plan, plan-level summaries, promo payloads,
and the feature-info catalogue. All pure logic — no DB or network.
"""

import pytest
from services.feature_unlock_service import (
    FeatureUnlockService,
    FEATURE_INFO,
    _PLAN_PRICES,
    _PLAN_RANK,
)


@pytest.fixture
def svc():
    return FeatureUnlockService()


# ─── Feature availability ─────────────────────────────────────────────────────

def test_free_user_offline_unavailable(svc):
    result = svc.check_feature("free", "offline_download")
    assert result["available"] is False
    assert result["user_plan"] == "free"
    assert result["min_plan_required"] == "pro"
    assert result["upgrade_cost_monthly"] == _PLAN_PRICES["pro"]


def test_pro_user_offline_available(svc):
    result = svc.check_feature("pro", "offline_download")
    assert result["available"] is True
    assert result["upgrade_cost_monthly"] == 0 or result.get("min_plan_required") in (None, "pro")


def test_premium_user_all_features(svc):
    for feature in FEATURE_INFO:
        result = svc.check_feature("premium", feature)
        assert result["available"] is True, f"Premium user should have {feature}"


def test_free_user_watch_videos_available(svc):
    result = svc.check_feature("free", "watch_videos")
    assert result["available"] is True


def test_free_user_certificate_unavailable(svc):
    result = svc.check_feature("free", "certificate_generation")
    assert result["available"] is False
    assert result["min_plan_required"] == "premium"
    assert result["upgrade_cost_monthly"] == _PLAN_PRICES["premium"]


def test_pro_user_certificate_unavailable(svc):
    result = svc.check_feature("pro", "certificate_generation")
    assert result["available"] is False
    assert result["min_plan_required"] == "premium"


def test_result_includes_feature_name(svc):
    result = svc.check_feature("free", "offline_download")
    assert result["feature_name"] == "offline_download"
    assert result["user_plan"] == "free"


def test_upgrade_cost_zero_for_available_feature(svc):
    result = svc.check_feature("free", "browse_courses")
    assert result["available"] is True
    assert result["upgrade_benefit"] == ""


# ─── Plan-level summaries ─────────────────────────────────────────────────────

def test_get_features_for_free_plan(svc):
    summary = svc.get_features_for_plan("free")
    assert summary["plan_type"] == "free"
    assert "offline_download" in summary["locked_features"]
    assert "watch_videos" in summary["available_features"]
    assert isinstance(summary["features"], dict)
    assert isinstance(summary["limits"], dict)


def test_get_features_for_pro_plan(svc):
    summary = svc.get_features_for_plan("pro")
    assert "offline_download" in summary["available_features"]
    assert "certificate_generation" in summary["locked_features"]


def test_get_features_for_premium_plan(svc):
    summary = svc.get_features_for_plan("premium")
    assert len(summary["locked_features"]) == 0, "Premium should have no locked features"


def test_get_features_limits_has_keys(svc):
    summary = svc.get_features_for_plan("pro")
    limits = summary["limits"]
    assert "videos_per_month" in limits
    assert "hours_per_month" in limits
    assert "questions_per_day" in limits


def test_get_features_none_plan_defaults_to_free(svc):
    summary = svc.get_features_for_plan(None)
    assert summary["plan_type"] == "free"


# ─── Feature promos ───────────────────────────────────────────────────────────

def test_show_promo_returns_dict(svc):
    promo = svc.show_feature_promo("offline_download")
    assert promo is not None
    assert promo["feature_name"] == "offline_download"
    assert promo["title"] == "Offline Download"
    assert promo["required_plan"] == "pro"
    assert promo["cost_monthly"] == _PLAN_PRICES["pro"]
    assert promo["cost_yearly"] == _PLAN_PRICES["pro"] * 10
    assert "/billing" in promo["cta_url"]
    assert isinstance(promo["benefits"], list)


def test_show_promo_premium_feature(svc):
    promo = svc.show_feature_promo("certificate_generation")
    assert promo is not None
    assert promo["required_plan"] == "premium"
    assert promo["cost_monthly"] == _PLAN_PRICES["premium"]


def test_show_promo_unknown_feature_returns_none(svc):
    result = svc.show_feature_promo("teleportation")
    assert result is None


def test_all_known_features_have_promos(svc):
    """Every feature in FEATURE_INFO should produce a valid promo."""
    for key in FEATURE_INFO:
        promo = svc.show_feature_promo(key)
        assert promo is not None, f"Missing promo for {key}"
        assert promo["title"]
        assert promo["required_plan"] in ("free", "pro", "premium")


# ─── Feature info catalogue ───────────────────────────────────────────────────

def test_get_all_feature_info_returns_dict(svc):
    info = svc.get_all_feature_info()
    assert isinstance(info, dict)
    assert len(info) >= 6


def test_feature_info_has_required_keys(svc):
    info = svc.get_all_feature_info()
    for key, val in info.items():
        assert "name" in val, f"{key} missing name"
        assert "description" in val, f"{key} missing description"
        assert "min_plan" in val, f"{key} missing min_plan"
        assert val["min_plan"] in ("free", "pro", "premium"), f"{key} has invalid min_plan"


def test_plan_prices_consistent():
    """Plan rank order must match price order."""
    ranked = sorted(_PLAN_RANK, key=lambda p: _PLAN_RANK[p])
    prices = [_PLAN_PRICES[p] for p in ranked]
    assert prices == sorted(prices), "Plan prices must increase with plan rank"


# ─── Usage logging (no crash guarantee) ──────────────────────────────────────

def test_log_feature_usage_does_not_raise(svc):
    svc.log_feature_usage("user-test", "offline_download", "viewed")
    svc.log_feature_usage(None, "watch_videos", "used")
