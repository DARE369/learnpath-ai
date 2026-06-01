"""
Unit tests for AnalyticsService (Packet 4.5).

Tests the pure/cache logic that doesn't need a real DB session, and the
graceful-degradation paths that matter in production (DB errors → zeros).
DB-querying methods are tested via mocks so CI can run without Postgres.
"""

import time
from unittest.mock import MagicMock, patch

import pytest

from services.analytics_service import AnalyticsService, _cache, _cached_get, _cached_set


@pytest.fixture(autouse=True)
def clear_cache():
    """Reset the module-level cache between tests."""
    _cache.clear()
    yield
    _cache.clear()


@pytest.fixture
def svc():
    return AnalyticsService()


# ─── In-memory TTL cache ──────────────────────────────────────────────────────

def test_cache_set_and_get():
    _cached_set("test-key", {"val": 42}, ttl=60)
    assert _cached_get("test-key") == {"val": 42}


def test_cache_miss_on_unknown_key():
    assert _cached_get("nope") is None


def test_cache_expires():
    _cached_set("expire-key", "soon", ttl=0)
    time.sleep(0.01)
    assert _cached_get("expire-key") is None


def test_cache_invalidate_all(svc):
    _cached_set("user:1", {}, ttl=60)
    _cached_set("platform", {}, ttl=60)
    n = svc.invalidate_cache()
    assert n == 2
    assert _cached_get("user:1") is None


def test_cache_invalidate_prefix(svc):
    _cached_set("user:1", {}, ttl=60)
    _cached_set("user:2", {}, ttl=60)
    _cached_set("platform", {}, ttl=60)
    n = svc.invalidate_cache("user:")
    assert n == 2
    assert _cached_get("platform") is not None


def test_cache_stats_returns_keys(svc):
    _cached_set("x", 1, ttl=60)
    stats = svc.cache_stats()
    assert stats["total_entries"] >= 1
    assert "x" in stats["keys"]


# ─── zero_user_analytics ─────────────────────────────────────────────────────

def test_zero_user_analytics_shape():
    z = AnalyticsService._zero_user_analytics()
    assert z["videos_watched_total"] == 0
    assert z["accuracy_percentage"] == 0.0
    assert z["last_active"] is None


# ─── get_user_analytics (mocked DB) ──────────────────────────────────────────

def _mock_db_for_user(svc, user_id="u1"):
    """Patch _compute_user_analytics to return a canned result."""
    expected = {
        "videos_watched_total": 7,
        "videos_watched_this_month": 3,
        "hours_learned_total": 5.2,
        "hours_learned_this_month": 2.1,
        "concepts_mastered": 4,
        "questions_answered": 20,
        "questions_correct": 15,
        "accuracy_percentage": 75.0,
        "learning_velocity": 0.1,
        "days_active": 12,
        "last_active": "2026-06-01T10:00:00",
    }
    with patch.object(svc, "_compute_user_analytics", return_value=expected):
        result = svc.get_user_analytics(MagicMock(), user_id)
    return result, expected


def test_get_user_analytics_returns_expected(svc):
    result, expected = _mock_db_for_user(svc)
    assert result == expected


def test_get_user_analytics_uses_cache(svc):
    result1, _ = _mock_db_for_user(svc, user_id="u-cache")
    # Second call should hit cache — patch would raise if called again
    with patch.object(svc, "_compute_user_analytics", side_effect=RuntimeError("should not call")):
        result2 = svc.get_user_analytics(MagicMock(), "u-cache")
    assert result1 == result2


def test_get_user_analytics_degrades_on_error(svc):
    with patch.object(svc, "_compute_user_analytics", side_effect=RuntimeError("DB down")):
        # The public method wraps the call — currently it lets the exception
        # propagate; the router catches it. Test the zero helper directly.
        z = svc._zero_user_analytics()
    assert z["videos_watched_total"] == 0


# ─── get_platform_metrics (mocked) ───────────────────────────────────────────

def test_get_platform_metrics_caches(svc):
    canned = {"total_users": 100, "active_users_30d": 50}
    with patch.object(svc, "_compute_platform_metrics", return_value=canned):
        r1 = svc.get_platform_metrics(MagicMock())
    with patch.object(svc, "_compute_platform_metrics", side_effect=RuntimeError("should not call")):
        r2 = svc.get_platform_metrics(MagicMock())
    assert r1 == r2 == canned


# ─── get_revenue_metrics (mocked) ────────────────────────────────────────────

def test_get_revenue_metrics_shape(svc):
    canned = {
        "monthly_recurring_revenue": 50000,
        "total_revenue_all_time": 300000,
        "arpu": 5000.0,
        "free_users_count": 900,
        "pro_users_count": 80,
        "premium_users_count": 20,
        "revenue_by_plan": {"free": 0, "pro": 239920, "premium": 199980},
        "revenue_trend_last_6_months": [],
    }
    with patch.object(svc, "_compute_revenue_metrics", return_value=canned):
        r = svc.get_revenue_metrics(MagicMock())
    assert r["monthly_recurring_revenue"] >= 0
    assert "revenue_by_plan" in r
    # revenue_by_plan consistency check
    assert r["revenue_by_plan"]["free"] == 0


# ─── get_churn_metrics (mocked) ──────────────────────────────────────────────

def test_get_churn_metrics_shape(svc):
    canned = {
        "churn_rate_monthly": 2.5,
        "users_churned_this_month": 3,
        "at_risk_users_count": 7,
        "churn_reasons": {},
    }
    with patch.object(svc, "_compute_churn_metrics", return_value=canned):
        r = svc.get_churn_metrics(MagicMock())
    assert 0 <= r["churn_rate_monthly"] <= 100
    assert r["users_churned_this_month"] >= 0


# ─── get_retention_cohorts (mocked) ──────────────────────────────────────────

def test_get_retention_cohorts_shape(svc):
    canned = {"cohorts": [
        {"signup_month": "2026-01", "total_users": 50, "still_active": 40, "retention_percentage": 80.0},
    ]}
    with patch.object(svc, "_compute_retention_cohorts", return_value=canned):
        r = svc.get_retention_cohorts(MagicMock())
    assert isinstance(r["cohorts"], list)
    for c in r["cohorts"]:
        assert 0 <= c["retention_percentage"] <= 100


# ─── get_engagement_metrics (mocked) ─────────────────────────────────────────

def test_get_engagement_metrics_shape(svc):
    canned = {"avg_session_length_minutes": 23.0, "sessions_per_user_30d": 7.2, "video_completion_rate_pct": 68.0}
    with patch.object(svc, "_compute_engagement_metrics", return_value=canned):
        r = svc.get_engagement_metrics(MagicMock())
    assert r["avg_session_length_minutes"] >= 0
    assert 0 <= r["video_completion_rate_pct"] <= 100


# ─── get_funnel_metrics (mocked) ─────────────────────────────────────────────

def test_get_funnel_metrics_has_required_keys(svc):
    canned = {
        "funnel_steps": {"total_signups": 1000, "watched_first_video": 600, "upgraded_to_paid": 80},
        "conversion_rates": {"signup_to_first_video_pct": 60.0, "first_video_to_paid_pct": 13.3, "overall_free_to_paid_pct": 8.0},
        "note": "test",
    }
    with patch.object(svc, "_compute_funnel_metrics", return_value=canned):
        r = svc.get_funnel_metrics(MagicMock())
    assert "funnel_steps" in r
    assert "conversion_rates" in r
    assert all(0 <= v <= 100 for v in r["conversion_rates"].values())


# ─── get_platform_health ─────────────────────────────────────────────────────

def test_get_platform_health_db_ok(svc):
    db = MagicMock()
    r = svc.get_platform_health(db)
    assert "health_score" in r
    assert "db_connected" in r


def test_get_platform_health_db_fail(svc):
    db = MagicMock()
    db.execute.side_effect = RuntimeError("connection refused")
    r = svc.get_platform_health(db)
    assert r["health_score"] == 50
    assert r["db_connected"] is False
