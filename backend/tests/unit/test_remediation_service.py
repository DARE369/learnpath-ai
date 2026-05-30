"""
Unit tests for RemediationService.

Variant generation is mocked (no Claude / Gemini calls). SearchService is mocked
to return canned path dicts. DB ops use an in-memory SQLite session restricted
to the remediation_events table.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from services.remediation_service import (
    LOW_CONFIDENCE_THRESHOLD,
    RemediationService,
    _parse_variants,
)


# ---------------------------------------------------------------------------
# DB fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def db():
    from models import RemediationEvent
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine, tables=[RemediationEvent.__table__])
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def service():
    return RemediationService()


def _path(score: float, video_count: int = 3) -> dict:
    return {
        "topic_id": "tid",
        "average_score": score,
        "video_count": video_count,
        "videos": [{"youtube_id": f"v{i}", "title": f"Video {i}"} for i in range(video_count)],
    }


# ---------------------------------------------------------------------------
# Detection
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("score,expected", [
    (0, True),
    (45, True),
    (59, True),
    (60, False),
    (65, False),
    (100, False),
])
def test_detect_low_confidence(service, score, expected):
    assert service.detect_low_confidence(score) is expected


def test_detect_low_confidence_handles_non_numeric(service):
    assert service.detect_low_confidence("not a number") is False
    assert service.detect_low_confidence(None) is False


# ---------------------------------------------------------------------------
# Variant parsing
# ---------------------------------------------------------------------------

def test_parse_variants_valid():
    text = json.dumps({"variants": ["a", "b", "c"]})
    assert _parse_variants(text) == ["a", "b", "c"]


def test_parse_variants_with_surrounding_text():
    """Should still extract the JSON even if Claude wraps it in prose."""
    text = "Here you go:\n" + json.dumps({"variants": ["x", "y"]}) + "\nHope that helps."
    assert _parse_variants(text) == ["x", "y"]


def test_parse_variants_drops_blank_and_non_string():
    text = json.dumps({"variants": ["", "  ", "real", 42, None, "other"]})
    assert _parse_variants(text) == ["real", "other"]


def test_parse_variants_invalid_json():
    assert _parse_variants("not json") == []


def test_parse_variants_missing_key():
    assert _parse_variants(json.dumps({"results": ["a"]})) == []


def test_parse_variants_caps_count():
    text = json.dumps({"variants": ["a", "b", "c", "d", "e"]})
    assert len(_parse_variants(text, max_count=3)) == 3


# ---------------------------------------------------------------------------
# auto_remediate — Tier 1 success
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tier_1_success(service, db):
    service.claude_api_key = "test-key"

    fake_search = MagicMock()
    fake_search.search_and_build_path = AsyncMock(
        side_effect=[
            {"path": _path(70)},
            {"path": _path(85)},   # winner
            {"path": _path(65)},
        ]
    )

    with patch.object(service, "_claude_variants", AsyncMock(return_value=["a", "b", "c"])), \
         patch.object(service, "_gemini_variants", AsyncMock(return_value=[])), \
         patch("services.remediation_service.cost_tracker.charge"):
        result = await service.auto_remediate(
            query="addition",
            original_score=45,
            original_path=_path(45),
            db=db,
            search_service=fake_search,
        )

    assert result["success"] is True
    assert result["tier_used"] == "tier_1"
    assert result["remediated_score"] == 85
    assert result["variant_query"] == "b"
    assert result["notification"]["state"] == "success"

    from models import RemediationEvent
    rows = db.query(RemediationEvent).all()
    assert len(rows) == 1
    assert rows[0].tier_used == "tier_1"
    assert rows[0].success is True


# ---------------------------------------------------------------------------
# auto_remediate — Tier 1 no improvement, Tier 2 wins
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tier_2_wins_when_tier_1_doesnt_improve(service, db):
    service.claude_api_key = "test-key"
    service.gemini_api_key = "gemini-key"

    fake_search = MagicMock()
    fake_search.search_and_build_path = AsyncMock(
        side_effect=[
            # Tier 1 attempts — none beat the original score (45)
            {"path": _path(40)},
            {"path": _path(30)},
            # Tier 2 attempts — one beats the original
            {"path": _path(75)},
            {"path": _path(50)},
        ]
    )

    with patch.object(service, "_claude_variants", AsyncMock(return_value=["a", "b"])), \
         patch.object(service, "_gemini_variants", AsyncMock(return_value=["c", "d"])), \
         patch("services.remediation_service.cost_tracker.charge"):
        result = await service.auto_remediate(
            query="topic",
            original_score=45,
            original_path=_path(45),
            db=db,
            search_service=fake_search,
        )

    assert result["success"] is True
    assert result["tier_used"] == "tier_2"
    assert result["remediated_score"] == 75


# ---------------------------------------------------------------------------
# auto_remediate — Tier 3 fallback (everything fails)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tier_3_fallback_when_no_improvement(service, db):
    fake_search = MagicMock()
    fake_search.search_and_build_path = AsyncMock(return_value={"path": _path(30)})

    with patch.object(service, "_claude_variants", AsyncMock(return_value=["a"])), \
         patch.object(service, "_gemini_variants", AsyncMock(return_value=["b"])), \
         patch("services.remediation_service.cost_tracker.charge"):
        result = await service.auto_remediate(
            query="topic",
            original_score=45,
            original_path=_path(45),
            db=db,
            search_service=fake_search,
        )

    assert result["success"] is False
    assert result["tier_used"] == "tier_3"
    assert result["remediated_score"] == 45  # original preserved
    assert result["notification"]["state"] == "fallback"


@pytest.mark.asyncio
async def test_tier_3_when_no_variants_returned(service, db):
    """Both LLMs return empty variant lists — no calls to SearchService at all."""
    fake_search = MagicMock()
    fake_search.search_and_build_path = AsyncMock()  # should never be called

    with patch.object(service, "_claude_variants", AsyncMock(return_value=[])), \
         patch.object(service, "_gemini_variants", AsyncMock(return_value=[])), \
         patch("services.remediation_service.cost_tracker.charge"):
        result = await service.auto_remediate(
            query="obscure",
            original_score=20,
            original_path=_path(20),
            db=db,
            search_service=fake_search,
        )

    assert result["tier_used"] == "tier_3"
    assert result["success"] is False
    fake_search.search_and_build_path.assert_not_called()


# ---------------------------------------------------------------------------
# Budget exhausted mid-tier
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_budget_exhausted_skips_to_next_tier(service, db):
    from services.cost_tracker import BudgetExceeded

    fake_search = MagicMock()
    fake_search.search_and_build_path = AsyncMock(return_value={"path": _path(80)})

    charge_mock = MagicMock(side_effect=[BudgetExceeded("tier1 spent"), None])

    with patch.object(service, "_claude_variants", AsyncMock(return_value=["a"])), \
         patch.object(service, "_gemini_variants", AsyncMock(return_value=["b"])), \
         patch("services.remediation_service.cost_tracker.charge", charge_mock):
        result = await service.auto_remediate(
            query="topic",
            original_score=45,
            original_path=_path(45),
            db=db,
            search_service=fake_search,
        )

    # Tier 1 charge raised → skipped. Tier 2 charge succeeded → ran.
    assert result["tier_used"] == "tier_2"
    assert result["success"] is True
    assert result["remediated_score"] == 80


# ---------------------------------------------------------------------------
# Variant search timeout / failure
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_failed_variant_search_doesnt_break_others(service, db):
    fake_search = MagicMock()
    fake_search.search_and_build_path = AsyncMock(
        side_effect=[
            ValueError("no videos"),       # first variant fails
            {"path": _path(75)},           # second variant succeeds
            {"path": _path(60)},           # third variant lower
        ]
    )

    with patch.object(service, "_claude_variants", AsyncMock(return_value=["a", "b", "c"])), \
         patch.object(service, "_gemini_variants", AsyncMock(return_value=[])), \
         patch("services.remediation_service.cost_tracker.charge"):
        result = await service.auto_remediate(
            query="x",
            original_score=45,
            original_path=_path(45),
            db=db,
            search_service=fake_search,
        )

    assert result["success"] is True
    assert result["remediated_score"] == 75


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

def test_stats_empty(service, db):
    s = service.get_remediation_stats(db)
    assert s["total"] == 0
    assert s["success_rate"] is None
    assert s["by_tier"] == {}


def test_stats_computes_per_tier_success_rate(service, db):
    from models import RemediationEvent
    rows = [
        RemediationEvent(query_normalized="x", original_score=40, remediated_score=80,
                         tier_used="tier_1", success=True, duration_ms=10_000),
        RemediationEvent(query_normalized="x", original_score=40, remediated_score=85,
                         tier_used="tier_1", success=True, duration_ms=12_000),
        RemediationEvent(query_normalized="x", original_score=40, remediated_score=40,
                         tier_used="tier_1", success=False, duration_ms=15_000),
        RemediationEvent(query_normalized="y", original_score=20, remediated_score=20,
                         tier_used="tier_3", success=False, duration_ms=8_000),
    ]
    for r in rows:
        db.add(r)
    db.commit()

    s = service.get_remediation_stats(db)
    assert s["total"] == 4
    assert s["success_rate"] == 0.5
    assert s["by_tier"]["tier_1"]["count"] == 3
    assert s["by_tier"]["tier_1"]["successes"] == 2
    assert s["by_tier"]["tier_1"]["success_rate"] == round(2 / 3, 3)
    assert s["by_tier"]["tier_3"]["count"] == 1
    assert s["by_tier"]["tier_3"]["successes"] == 0


def test_stats_top_queries(service, db):
    from models import RemediationEvent
    # 'addition' three times, 'fractions' once
    for _ in range(3):
        db.add(RemediationEvent(query_normalized="addition", original_score=40,
                                remediated_score=40, tier_used="tier_3", success=False,
                                duration_ms=5000))
    db.add(RemediationEvent(query_normalized="fractions", original_score=40,
                            remediated_score=80, tier_used="tier_1", success=True,
                            duration_ms=5000))
    db.commit()

    s = service.get_remediation_stats(db)
    assert s["top_remediated_queries"][0]["query"] == "addition"
    assert s["top_remediated_queries"][0]["count"] == 3
