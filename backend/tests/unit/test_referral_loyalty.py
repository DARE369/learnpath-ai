"""Unit tests for Referral & Loyalty System (Packet 4.6)"""

import pytest
import uuid
from unittest.mock import Mock, MagicMock

def test_referral_code_generation():
    """Test that referral codes are generated uniquely"""
    from services.referral_service import ReferralService
    service = ReferralService()
    
    code1 = service._make_code("John Doe")
    code2 = service._make_code("John Doe")
    
    assert code1 is not None
    assert code2 is not None
    assert code1 != code2

def test_loyalty_tier_calculation():
    """Test tier calculation based on lifetime points"""
    from services.loyalty_service import tier_for_lifetime_points
    
    assert tier_for_lifetime_points(0) == "bronze"
    assert tier_for_lifetime_points(500) == "silver"
    assert tier_for_lifetime_points(1000) == "gold"
    assert tier_for_lifetime_points(2000) == "platinum"

def test_loyalty_multiplier():
    """Test point multiplier per tier"""
    from services.loyalty_service import multiplier_for_tier
    
    assert multiplier_for_tier("bronze") == 1.0
    assert multiplier_for_tier("silver") == 1.1
    assert multiplier_for_tier("gold") == 1.2
    assert multiplier_for_tier("platinum") == 1.5

def test_loyalty_point_multiplication():
    """Test that base points are correctly multiplied"""
    from services.loyalty_service import apply_multiplier
    
    assert apply_multiplier(10, 1.0) == 10
    assert apply_multiplier(10, 1.1) == 11
    assert apply_multiplier(10, 1.2) == 12
    assert apply_multiplier(10, 1.5) == 15

def test_next_tier():
    """Test tier progression logic"""
    from services.loyalty_service import next_tier
    
    assert next_tier("bronze") == "silver"
    assert next_tier("silver") == "gold"
    assert next_tier("gold") == "platinum"
    assert next_tier("platinum") is None

def test_points_to_next_tier():
    """Test calculation of points needed for next tier"""
    from services.loyalty_service import points_to_next_tier
    
    pts = points_to_next_tier(0)
    assert pts == 500
    
    pts = points_to_next_tier(500)
    assert pts == 500
    
    pts = points_to_next_tier(2000)
    assert pts is None

def test_referral_config_constants():
    """Test that referral configuration is properly set"""
    from services.referral_service import REFERRAL_CONFIG
    
    assert REFERRAL_CONFIG["referrer_reward_ngn"] == 500
    assert REFERRAL_CONFIG["referred_reward_ngn"] == 500
    assert REFERRAL_CONFIG["max_monthly_referrer_ngn"] == 5000
    assert REFERRAL_CONFIG["credit_expiry_days"] == 180

def test_loyalty_config_constants():
    """Test that loyalty configuration is properly set"""
    from services.loyalty_service import POINT_AWARDS, TIERS, REDEMPTION_OPTIONS
    
    assert POINT_AWARDS["video_watch"] == 10
    assert POINT_AWARDS["question_answer"] == 5
    assert POINT_AWARDS["streak_day"] == 50
    assert POINT_AWARDS["upgrade_plan"] == 100
    assert POINT_AWARDS["referral_signup"] == 250
    
    assert "bronze" in TIERS
    assert "silver" in TIERS
    assert "gold" in TIERS
    assert "platinum" in TIERS
    
    assert len(REDEMPTION_OPTIONS) >= 3

def test_tier_benefits_structure():
    """Test that tier benefits are properly defined"""
    from services.loyalty_service import TIERS
    
    for tier_name, tier_config in TIERS.items():
        assert "name" in tier_config
        assert "min_lifetime_points" in tier_config
        assert "multiplier" in tier_config
        assert "benefits" in tier_config
        assert isinstance(tier_config["benefits"], dict)

def test_redemption_options_valid():
    """Test that redemption options are valid"""
    from services.loyalty_service import REDEMPTION_OPTIONS
    
    for option in REDEMPTION_OPTIONS:
        assert "points_cost" in option
        assert "reward_type" in option
        assert "label" in option
        assert option["points_cost"] > 0
