"""
Unit tests for EQSExpandedService — pure parsing/math + mocked Opus calls.
DB ops use an in-memory SQLite session restricted to expanded_video_scores.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from services.eqs_expanded_service import (
    BASE_MAX,
    BONUS_MAX,
    EQSExpandedService,
    InvalidScoreResponse,
    compute_cache_ttl,
    compute_confidence,
)


# ---------------------------------------------------------------------------
# Pure math
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("score,expected", [
    (0, "poor"),
    (50, "poor"),
    (51, "acceptable"),
    (70, "acceptable"),
    (71, "good"),
    (100, "good"),
    (101, "excellent"),
    (130, "excellent"),
    (131, "outstanding"),
    (170, "outstanding"),
])
def test_compute_confidence(score, expected):
    assert compute_confidence(score) == expected


@pytest.mark.parametrize("score,expected_ttl", [
    (0, 0),
    (59, 0),
    (60, 7),
    (79, 7),
    (80, 14),
    (99, 14),
    (100, 30),
    (119, 30),
    (120, 60),
    (170, 60),
])
def test_compute_cache_ttl(score, expected_ttl):
    assert compute_cache_ttl(score) == expected_ttl


# ---------------------------------------------------------------------------
# DB fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def db():
    """In-memory SQLite with only the expanded_video_scores table."""
    from models import ExpandedVideoScore
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine, tables=[ExpandedVideoScore.__table__])
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def service():
    return EQSExpandedService()


# ---------------------------------------------------------------------------
# _parse
# ---------------------------------------------------------------------------

def test_parse_valid_json(service):
    text = json.dumps({
        "base_scores": {"pedagogy": 35, "clarity": 25, "credibility": 18, "length": 8},
        "bonus_scores": {
            "engagement": 12, "production": 10, "recency": 6, "accessibility": 8,
            "student_feedback": 7, "curriculum_align": 6, "diversity": 5,
        },
        "reasoning": "Solid pedagogy, clear narration.",
    })
    base, bonus, reasoning = service._parse(text)
    assert base["pedagogy"] == 35
    assert bonus["engagement"] == 12
    assert reasoning == "Solid pedagogy, clear narration."


def test_parse_clamps_to_max(service):
    """Claude returning over-max values should be clamped, not raised."""
    text = json.dumps({
        "base_scores": {"pedagogy": 99, "clarity": 99, "credibility": 99, "length": 99},
        "bonus_scores": {k: 99 for k in BONUS_MAX},
    })
    base, bonus, _ = service._parse(text)
    assert base["pedagogy"] == BASE_MAX["pedagogy"]
    assert base["length"] == BASE_MAX["length"]
    assert bonus["engagement"] == BONUS_MAX["engagement"]
    assert bonus["diversity"] == BONUS_MAX["diversity"]


def test_parse_negative_floored_at_zero(service):
    text = json.dumps({
        "base_scores": {"pedagogy": -5, "clarity": 0, "credibility": 0, "length": 0},
        "bonus_scores": {k: 0 for k in BONUS_MAX},
    })
    base, _, _ = service._parse(text)
    assert base["pedagogy"] == 0


def test_parse_missing_keys_default_zero(service):
    text = json.dumps({
        "base_scores": {"pedagogy": 30},  # missing clarity/credibility/length
        "bonus_scores": {},
    })
    base, bonus, _ = service._parse(text)
    assert base["pedagogy"] == 30
    assert base["clarity"] == 0
    assert base["length"] == 0
    assert bonus["engagement"] == 0


def test_parse_invalid_json_raises(service):
    with pytest.raises(InvalidScoreResponse):
        service._parse("not json at all")


def test_parse_non_integer_raises(service):
    text = json.dumps({
        "base_scores": {"pedagogy": "high", "clarity": 0, "credibility": 0, "length": 0},
        "bonus_scores": {},
    })
    with pytest.raises(InvalidScoreResponse):
        service._parse(text)


def test_parse_missing_score_objects_raises(service):
    with pytest.raises(InvalidScoreResponse):
        service._parse(json.dumps({"reasoning": "no scores"}))


# ---------------------------------------------------------------------------
# evaluate_video_expanded (mocked Opus)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_evaluate_happy_path(service):
    fake_response = MagicMock()
    fake_response.content = [
        MagicMock(text=json.dumps({
            "base_scores": {"pedagogy": 35, "clarity": 28, "credibility": 18, "length": 9},  # 90
            "bonus_scores": {
                "engagement": 12, "production": 10, "recency": 6, "accessibility": 9,
                "student_feedback": 8, "curriculum_align": 7, "diversity": 5,  # 57
            },
            "reasoning": "Strong overall.",
        }))
    ]
    fake_client = MagicMock()
    fake_client.messages.create = AsyncMock(return_value=fake_response)
    service.api_key = "test-key"

    with patch("services.eqs_expanded_service.anthropic.AsyncAnthropic", return_value=fake_client), \
         patch("services.eqs_expanded_service.cost_tracker.charge"):
        result = await service.evaluate_video_expanded(
            youtube_id="abc",
            video_summary="A solid lecture on photosynthesis covering all the basics.",
            title="Intro to Photosynthesis",
        )

    assert result.base_score == 90
    assert result.bonus_total == 57
    assert result.total_score == 147
    assert result.confidence_level == "outstanding"
    assert result.cache_ttl_days == 60


@pytest.mark.asyncio
async def test_evaluate_missing_key_raises(service):
    service.api_key = None
    with pytest.raises(ValueError):
        await service.evaluate_video_expanded("abc", "summary text long enough")


@pytest.mark.asyncio
async def test_evaluate_summary_too_short_raises(service):
    service.api_key = "test-key"
    with pytest.raises(ValueError):
        await service.evaluate_video_expanded("abc", "short")


# ---------------------------------------------------------------------------
# Persistence + reads
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_persist_writes_row_and_invalidates_prior(service, db):
    """A second persist for the same youtube_id should deactivate the first."""
    fake_response = MagicMock()
    fake_response.content = [
        MagicMock(text=json.dumps({
            "base_scores": {"pedagogy": 30, "clarity": 25, "credibility": 15, "length": 8},
            "bonus_scores": {k: 0 for k in BONUS_MAX},
            "reasoning": "ok",
        }))
    ]
    fake_client = MagicMock()
    fake_client.messages.create = AsyncMock(return_value=fake_response)
    service.api_key = "test-key"

    with patch("services.eqs_expanded_service.anthropic.AsyncAnthropic", return_value=fake_client), \
         patch("services.eqs_expanded_service.cost_tracker.charge"):
        r1 = await service.evaluate_video_expanded("yt1", "summary here, long enough.")
        service.persist(db, r1)
        r2 = await service.evaluate_video_expanded("yt1", "summary here, long enough.")
        service.persist(db, r2)

    from models import ExpandedVideoScore
    rows = db.query(ExpandedVideoScore).filter_by(youtube_id="yt1").all()
    assert len(rows) == 2
    active = [r for r in rows if r.is_valid]
    assert len(active) == 1


def test_stats_empty(service, db):
    s = service.stats(db)
    assert s["total_scored"] == 0
    assert s["average_score"] is None


def test_list_scores_filter_by_confidence(service, db):
    from models import ExpandedVideoScore
    db.add(ExpandedVideoScore(
        youtube_id="a",
        base_scores={"pedagogy": 40, "clarity": 30, "credibility": 20, "length": 10},
        bonus_scores={k: BONUS_MAX[k] for k in BONUS_MAX},
        base_score=100, total_score=170,
        confidence_level="outstanding", cache_ttl_days=60,
        is_valid=True,
    ))
    db.add(ExpandedVideoScore(
        youtube_id="b",
        base_scores={"pedagogy": 10, "clarity": 5, "credibility": 5, "length": 0},
        bonus_scores={k: 0 for k in BONUS_MAX},
        base_score=20, total_score=20,
        confidence_level="poor", cache_ttl_days=0,
        is_valid=True,
    ))
    db.commit()

    outstanding = service.list_scores(db, confidence_level="outstanding")
    assert len(outstanding) == 1
    assert outstanding[0]["youtube_id"] == "a"

    poor = service.list_scores(db, confidence_level="poor")
    assert len(poor) == 1
    assert poor[0]["youtube_id"] == "b"


def test_stats_distribution_and_criteria_averages(service, db):
    from models import ExpandedVideoScore
    db.add(ExpandedVideoScore(
        youtube_id="a",
        base_scores={"pedagogy": 40, "clarity": 30, "credibility": 20, "length": 10},
        bonus_scores={k: 0 for k in BONUS_MAX},
        base_score=100, total_score=100,
        confidence_level="good", cache_ttl_days=30,
        is_valid=True,
    ))
    db.add(ExpandedVideoScore(
        youtube_id="b",
        base_scores={"pedagogy": 20, "clarity": 20, "credibility": 10, "length": 5},
        bonus_scores={k: 0 for k in BONUS_MAX},
        base_score=55, total_score=55,
        confidence_level="acceptable", cache_ttl_days=7,
        is_valid=True,
    ))
    db.commit()

    s = service.stats(db)
    assert s["total_scored"] == 2
    assert s["distribution"]["good"] == 1
    assert s["distribution"]["acceptable"] == 1
    assert s["criteria_averages"]["pedagogy"] == 30.0  # (40 + 20) / 2
    assert s["criteria_averages"]["clarity"] == 25.0
    assert s["cache_distribution"]["30d"] == 1
    assert s["cache_distribution"]["7d"] == 1
