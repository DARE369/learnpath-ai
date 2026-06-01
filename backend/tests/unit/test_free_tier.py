"""
Unit tests for AdService and FreeTierService (Packet 4.3).

All pure logic — no DB, no network, no async calls.
"""

import pytest
from services.ad_service import AdService, _ADS
from services.free_tier_service import FreeTierService, FEATURE_MAP


@pytest.fixture
def ads():
    return AdService()


@pytest.fixture
def ft():
    return FreeTierService()


# ─── AdService ────────────────────────────────────────────────────────────────

def test_get_ad_banner_returns_dict(ads):
    ad = ads.get_ad_for_placement("banner", user_id="user-1")
    assert ad is not None
    assert "ad_id" in ad
    assert "title" in ad
    assert "cta_text" in ad
    assert "cta_url" in ad


def test_get_ad_sidebar_returns_dict(ads):
    ad = ads.get_ad_for_placement("sidebar", user_id="user-1")
    assert ad is not None
    assert ad["placement"] == "sidebar"


def test_get_ad_modal_returns_dict(ads):
    ad = ads.get_ad_for_placement("modal", user_id="user-1")
    assert ad is not None


def test_get_ad_unknown_placement_returns_none(ads):
    ad = ads.get_ad_for_placement("nonexistent", user_id="user-1")
    assert ad is None


def test_ad_rotation_deterministic_same_hour(ads):
    """Same user + placement within the same hour returns the same ad."""
    a1 = ads.get_ad_for_placement("banner", user_id="user-42")
    a2 = ads.get_ad_for_placement("banner", user_id="user-42")
    assert a1 == a2


def test_ad_rotation_different_users_may_differ(ads):
    """Different users can get different ads (not guaranteed, but check no crash)."""
    ads.get_ad_for_placement("banner", user_id="user-1")
    ads.get_ad_for_placement("banner", user_id="user-999")


def test_get_all_for_placement_returns_list(ads):
    result = ads.get_all_for_placement("banner")
    assert isinstance(result, list)
    assert len(result) >= 1


def test_all_ads_have_required_fields(ads):
    for ad in _ADS:
        assert "id" in ad
        assert "title" in ad
        assert "description" in ad
        assert "cta_text" in ad
        assert "cta_url" in ad
        assert "placement_types" in ad


# ─── FreeTierService — feature availability ───────────────────────────────────

def test_free_user_offline_unavailable(ft):
    result = ft.check_feature("free", "offline_download")
    assert result["available"] is False
    assert result["upgrade_needed"] is True
    assert result["suggested_plan"] == "pro"


def test_pro_user_offline_available(ft):
    result = ft.check_feature("pro", "offline_download")
    assert result["available"] is True
    assert result["upgrade_needed"] is False


def test_premium_user_all_features(ft):
    for feature in FEATURE_MAP["premium"]:
        result = ft.check_feature("premium", feature)
        assert result["available"] is True


def test_free_user_watch_videos_available(ft):
    result = ft.check_feature("free", "watch_videos")
    assert result["available"] is True


def test_free_user_certificate_unavailable(ft):
    result = ft.check_feature("free", "certificate_generation")
    assert result["available"] is False


def test_unknown_feature_returns_unavailable(ft):
    result = ft.check_feature("free", "teleportation")
    assert result["available"] is False


def test_get_all_features_returns_complete_map(ft):
    features = ft.get_all_features("free")
    assert "watch_videos" in features
    assert "offline_download" in features
    assert isinstance(features["watch_videos"], bool)


def test_is_free_user_true(ft):
    assert ft.is_free_user("free") is True


def test_is_free_user_false_for_pro(ft):
    assert ft.is_free_user("pro") is False


def test_shows_ads_for_free(ft):
    assert ft.shows_ads("free") is True


def test_shows_ads_false_for_pro(ft):
    assert ft.shows_ads("pro") is False


def test_shows_ads_false_for_premium(ft):
    assert ft.shows_ads("premium") is False


# ─── FreeTierService — upgrade prompts ────────────────────────────────────────

def test_get_upgrade_prompt_feature_locked(ft):
    result = ft.get_upgrade_prompt("feature_locked", "free")
    assert result["show_prompt"] is True
    assert result["prompt_type"] == "feature_lock"
    assert "cta_text" in result
    assert "cta_url" in result
    assert "/billing" in result["cta_url"]


def test_get_upgrade_prompt_video_limit(ft):
    result = ft.get_upgrade_prompt("video_limit_reached", "free")
    assert result["show_prompt"] is True
    assert result["prompt_type"] == "limit_reached"


def test_get_upgrade_prompt_paid_user_returns_no_show(ft):
    result = ft.get_upgrade_prompt("feature_locked", "pro")
    assert result["show_prompt"] is False


def test_get_upgrade_prompt_premium_returns_no_show(ft):
    result = ft.get_upgrade_prompt("general", "premium")
    assert result["show_prompt"] is False


def test_get_upgrade_prompt_unknown_context_falls_back(ft):
    result = ft.get_upgrade_prompt("something_random", "free")
    assert result["show_prompt"] is True  # falls back to general


def test_all_contexts_have_highlights(ft):
    for ctx in ("feature_locked", "video_limit_reached", "approaching_limit",
                "question_limit", "search_limit", "general"):
        result = ft.get_upgrade_prompt(ctx, "free")
        assert isinstance(result.get("highlights"), list)
        assert len(result["highlights"]) >= 1


# ─── FreeTierService — success stories ────────────────────────────────────────

def test_get_success_stories_returns_list(ft):
    stories = ft.get_success_stories(count=3)
    assert isinstance(stories, list)
    assert len(stories) <= 3


def test_success_story_fields(ft):
    stories = ft.get_success_stories(count=1, shuffle=False)
    assert len(stories) == 1
    s = stories[0]
    assert "user_name" in s
    assert "achievement" in s
    assert "story" in s
    assert "before_plan" in s
    assert "after_plan" in s
    assert "metric" in s


def test_get_random_story_returns_story(ft):
    story = ft.get_random_story()
    assert story is not None
    assert "user_name" in story


def test_get_success_stories_count_respected(ft):
    stories = ft.get_success_stories(count=2)
    assert len(stories) == 2
