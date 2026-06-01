"""
Unit tests for UsageTrackingService and RateLimitingService (Packet 4.2).

Covers all pure logic: limit calculations, sliding-window rate limiting,
action type routing, and graceful-degradation paths. No DB or network needed.
"""

import time
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from services.usage_tracking_service import UsageTrackingService, LimitExceededError, _UNLIMITED
from services.rate_limiting_service import RateLimitingService, RateLimitExceededError, ENDPOINT_LIMITS


# ─── UsageTrackingService ─────────────────────────────────────────────────────

@pytest.fixture
def usage_svc():
    return UsageTrackingService()


def _make_plan_info(plan_type="free", videos=0, hours=0.0, questions_today=0):
    """Build a get_user_plan return value for a given plan and usage."""
    from services.subscription_service import SubscriptionService
    svc = SubscriptionService()
    plan = svc.PLANS[plan_type]
    vid_limit  = plan["videos_per_month"]
    hr_limit   = plan["hours_per_month"]
    q_limit    = plan["questions_per_day"]
    return {
        "plan_type": plan_type,
        "plan_name": plan["name"],
        "limits": {
            "videos_per_month": vid_limit,
            "hours_per_month":  hr_limit,
            "questions_per_day": q_limit,
        },
        "usage": {
            "videos_watched":  videos,
            "hours_learned":   hours,
            "questions_today": questions_today,
        },
        "remaining_videos":            max(0, vid_limit - videos) if vid_limit < _UNLIMITED else _UNLIMITED,
        "remaining_hours":             max(0, hr_limit - hours)   if hr_limit  < _UNLIMITED else _UNLIMITED,
        "remaining_questions_today":   max(0, q_limit - questions_today) if q_limit < _UNLIMITED else _UNLIMITED,
        "usage_percentage": {
            "videos":    round(min(100, videos / vid_limit * 100), 1) if vid_limit < _UNLIMITED else 0.0,
            "hours":     round(min(100, hours  / hr_limit  * 100), 1) if hr_limit  < _UNLIMITED else 0.0,
            "questions": round(min(100, questions_today / q_limit * 100), 1) if q_limit < _UNLIMITED else 0.0,
        },
    }


def test_check_limit_allowed_within_quota(usage_svc):
    plan_info = _make_plan_info("free", videos=5)
    with patch("services.usage_tracking_service.UsageTrackingService.check_limit",
               wraps=usage_svc.check_limit) as _:
        with patch("services.subscription_service.SubscriptionService.get_user_plan",
                   return_value=plan_info):
            result = usage_svc.check_limit(MagicMock(), "user-1", "watch_video")
    assert result["allowed"] is True
    assert result["remaining"] == 5   # 10 - 5


def test_check_limit_denied_at_quota(usage_svc):
    plan_info = _make_plan_info("free", videos=10)
    with patch("services.subscription_service.SubscriptionService.get_user_plan",
               return_value=plan_info):
        result = usage_svc.check_limit(MagicMock(), "user-1", "watch_video")
    assert result["allowed"] is False
    assert result["remaining"] == 0
    assert result["upgrade_needed"] is True
    assert "limit" in result["reason"].lower() or "plan" in result["reason"].lower()


def test_check_limit_premium_always_allowed(usage_svc):
    # Premium limits are UNLIMITED — always allowed even with high usage
    plan_info = _make_plan_info("premium", videos=50000)
    with patch("services.subscription_service.SubscriptionService.get_user_plan",
               return_value=plan_info):
        result = usage_svc.check_limit(MagicMock(), "user-1", "watch_video")
    assert result["allowed"] is True
    assert result["remaining"] == _UNLIMITED


def test_check_limit_unknown_action_allowed(usage_svc):
    result = usage_svc.check_limit(MagicMock(), "user-1", "nonexistent_action")
    assert result["allowed"] is True


def test_check_limit_degrades_on_service_error(usage_svc):
    with patch("services.subscription_service.SubscriptionService.get_user_plan",
               side_effect=RuntimeError("DB down")):
        result = usage_svc.check_limit(MagicMock(), "user-1", "watch_video")
    # Must degrade gracefully — never block a user due to monitoring failure
    assert result["allowed"] is True


def test_enforce_limit_raises_when_denied(usage_svc):
    plan_info = _make_plan_info("free", videos=10)
    with patch("services.subscription_service.SubscriptionService.get_user_plan",
               return_value=plan_info):
        with pytest.raises(LimitExceededError) as exc_info:
            usage_svc.enforce_limit(MagicMock(), "user-1", "watch_video")
    assert exc_info.value.action_type == "watch_video"
    assert exc_info.value.upgrade_needed is True


def test_enforce_limit_passes_within_quota(usage_svc):
    plan_info = _make_plan_info("free", videos=3)
    with patch("services.subscription_service.SubscriptionService.get_user_plan",
               return_value=plan_info):
        usage_svc.enforce_limit(MagicMock(), "user-1", "watch_video")  # must not raise


def test_question_limit_free_plan(usage_svc):
    plan_info = _make_plan_info("free", questions_today=5)
    with patch("services.subscription_service.SubscriptionService.get_user_plan",
               return_value=plan_info):
        result = usage_svc.check_limit(MagicMock(), "user-1", "answer_question")
    assert result["allowed"] is False


def test_question_limit_pro_within_quota(usage_svc):
    plan_info = _make_plan_info("pro", questions_today=10)
    with patch("services.subscription_service.SubscriptionService.get_user_plan",
               return_value=plan_info):
        result = usage_svc.check_limit(MagicMock(), "user-1", "answer_question")
    assert result["allowed"] is True
    assert result["remaining"] == 10   # 20 - 10


def test_get_usage_percentage_returns_four_keys(usage_svc):
    plan_info = _make_plan_info("free", videos=5, hours=5.0, questions_today=3)
    with patch("services.subscription_service.SubscriptionService.get_user_plan",
               return_value=plan_info):
        pct = usage_svc.get_usage_percentage(MagicMock(), "user-1")
    assert set(pct.keys()) == {"videos", "hours", "questions", "overall"}
    assert 0 <= pct["overall"] <= 100


# ─── RateLimitingService ──────────────────────────────────────────────────────

@pytest.fixture
def rl():
    # Fresh instance so each test starts with zero counters
    return RateLimitingService()


def test_rate_limit_first_call_allowed(rl):
    result = rl.check_and_increment("user-1", "search:build-path", "free")
    assert result["allowed"] is True
    assert result["remaining"] == 1   # 2 max - 1 used


def test_rate_limit_second_call_allowed(rl):
    rl.check_and_increment("user-1", "search:build-path", "free")
    result = rl.check_and_increment("user-1", "search:build-path", "free")
    assert result["allowed"] is True
    assert result["remaining"] == 0


def test_rate_limit_third_call_denied(rl):
    rl.check_and_increment("user-1", "search:build-path", "free")
    rl.check_and_increment("user-1", "search:build-path", "free")
    result = rl.check_and_increment("user-1", "search:build-path", "free")
    assert result["allowed"] is False
    assert result["remaining"] == 0
    assert result["retry_after"] >= 0


def test_rate_limit_different_users_independent(rl):
    rl.check_and_increment("user-1", "search:build-path", "free")
    rl.check_and_increment("user-1", "search:build-path", "free")
    # user-2 has its own counter — still allowed
    result = rl.check_and_increment("user-2", "search:build-path", "free")
    assert result["allowed"] is True


def test_rate_limit_pro_higher_quota(rl):
    for _ in range(10):
        rl.check_and_increment("user-1", "search:build-path", "pro")
    # 10th call used up the pro quota
    result = rl.check_and_increment("user-1", "search:build-path", "pro")
    assert result["allowed"] is False


def test_rate_limit_premium_unlimited(rl):
    for _ in range(200):
        result = rl.check_and_increment("user-1", "search:build-path", "premium")
        assert result["allowed"] is True


def test_rate_limit_unknown_endpoint_allowed(rl):
    result = rl.check_and_increment("user-1", "unknown:endpoint", "free")
    assert result["allowed"] is True
    assert result["remaining"] == _UNLIMITED


def test_enforce_raises_on_exceeded(rl):
    rl.check_and_increment("user-1", "search:build-path", "free")
    rl.check_and_increment("user-1", "search:build-path", "free")
    with pytest.raises(RateLimitExceededError) as exc_info:
        rl.enforce("user-1", "search:build-path", "free")
    assert exc_info.value.retry_after >= 0


def test_enforce_passes_within_quota(rl):
    rl.enforce("user-1", "search:build-path", "free")  # first call — must not raise


def test_get_limits_for_plan_has_all_endpoints(rl):
    limits = rl.get_limits_for_plan("free")
    for ep in ENDPOINT_LIMITS:
        assert ep in limits


def test_get_limits_premium_unlimited(rl):
    limits = rl.get_limits_for_plan("premium")
    for ep, cfg in limits.items():
        assert cfg["unlimited"] is True
        assert cfg["limit"] is None


def test_question_evaluate_day_limit_free(rl):
    for _ in range(5):
        rl.check_and_increment("user-1", "questions:evaluate", "free")
    result = rl.check_and_increment("user-1", "questions:evaluate", "free")
    assert result["allowed"] is False


def test_question_evaluate_day_limit_pro(rl):
    for _ in range(20):
        r = rl.check_and_increment("user-1", "questions:evaluate", "pro")
        assert r["allowed"] is True
    result = rl.check_and_increment("user-1", "questions:evaluate", "pro")
    assert result["allowed"] is False
