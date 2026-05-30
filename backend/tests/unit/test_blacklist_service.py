"""
Unit tests for BlacklistService — DB ops use an in-memory SQLite session.
"""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from services.blacklist_service import (
    BlacklistService,
    SOFT_BLACKLIST_THRESHOLD,
    SOFT_RETRY_DAYS,
)


# ---------------------------------------------------------------------------
# In-memory DB fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def db():
    """
    In-memory SQLite session with only the tables we need.

    Can't run Base.metadata.create_all wholesale because models.Topic uses
    Postgres-specific ARRAY columns which SQLite rejects. Restrict to the
    blacklist tables.
    """
    from models import VideoBlacklist, BlacklistFeedback
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(
        bind=engine,
        tables=[VideoBlacklist.__table__, BlacklistFeedback.__table__],
    )
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def service():
    return BlacklistService()


# ---------------------------------------------------------------------------
# blacklist_video + is_blacklisted
# ---------------------------------------------------------------------------

def test_soft_blacklist_creates_row_with_retry_date(service, db):
    result = service.blacklist_video(db, "abc123", "low score", "soft", last_score=42)
    assert result["blacklist_type"] == "soft"
    assert result["retry_date"] is not None
    assert service.is_blacklisted(db, "abc123") is True


def test_hard_blacklist_has_no_retry(service, db):
    result = service.blacklist_video(db, "abc123", "inappropriate", "hard")
    assert result["retry_date"] is None
    assert service.is_blacklisted(db, "abc123") is True


def test_invalid_type_raises(service, db):
    with pytest.raises(ValueError):
        service.blacklist_video(db, "abc123", "x", "medium")


def test_soft_blacklist_past_retry_returns_false(service, db):
    """A soft blacklist past its retry_date should no longer block."""
    service.blacklist_video(db, "abc123", "low score", "soft")

    from models import VideoBlacklist
    row = db.query(VideoBlacklist).filter_by(youtube_id="abc123").first()
    row.retry_date = datetime.utcnow() - timedelta(days=1)
    db.commit()

    assert service.is_blacklisted(db, "abc123") is False


def test_repeat_blacklist_updates_existing(service, db):
    """Re-blacklisting the same video should refresh the existing row, not create a new one."""
    service.blacklist_video(db, "abc123", "first reason", "soft", last_score=40)
    service.blacklist_video(db, "abc123", "second reason", "soft", last_score=30)

    from models import VideoBlacklist
    rows = db.query(VideoBlacklist).filter_by(youtube_id="abc123", is_active=True).all()
    assert len(rows) == 1
    assert rows[0].reason == "second reason"
    assert rows[0].last_score == 30


# ---------------------------------------------------------------------------
# remove + convert
# ---------------------------------------------------------------------------

def test_remove_blacklist(service, db):
    service.blacklist_video(db, "abc123", "x", "soft")
    assert service.remove_blacklist(db, "abc123") is True
    assert service.is_blacklisted(db, "abc123") is False


def test_remove_nonexistent_returns_false(service, db):
    assert service.remove_blacklist(db, "ghost") is False


def test_convert_soft_to_hard_clears_retry(service, db):
    service.blacklist_video(db, "abc123", "x", "soft")
    out = service.convert_type(db, "abc123", "hard")
    assert out["blacklist_type"] == "hard"
    assert out["retry_date"] is None


def test_convert_hard_to_soft_sets_retry(service, db):
    service.blacklist_video(db, "abc123", "x", "hard")
    out = service.convert_type(db, "abc123", "soft")
    assert out["blacklist_type"] == "soft"
    assert out["retry_date"] is not None


def test_convert_unknown_raises(service, db):
    with pytest.raises(ValueError):
        service.convert_type(db, "ghost", "hard")


# ---------------------------------------------------------------------------
# filter_blacklisted
# ---------------------------------------------------------------------------

def test_filter_excludes_blacklisted(service, db):
    service.blacklist_video(db, "bad1", "x", "soft")
    service.blacklist_video(db, "bad2", "x", "hard")
    remaining = service.filter_blacklisted(db, ["good1", "bad1", "good2", "bad2"])
    assert remaining == ["good1", "good2"]


def test_filter_includes_expired_soft(service, db):
    service.blacklist_video(db, "bad1", "x", "soft")
    from models import VideoBlacklist
    row = db.query(VideoBlacklist).filter_by(youtube_id="bad1").first()
    row.retry_date = datetime.utcnow() - timedelta(days=1)
    db.commit()
    remaining = service.filter_blacklisted(db, ["good1", "bad1"])
    assert "bad1" in remaining  # expired soft blacklist no longer blocks


# ---------------------------------------------------------------------------
# Shadow testing
# ---------------------------------------------------------------------------

def test_shadow_test_anonymous_returns_false(service):
    assert service.should_shadow_test(None) is False
    assert service.should_shadow_test("") is False


def test_shadow_test_is_deterministic(service):
    """Same user_id → same answer across calls."""
    user_id = "0e9c4d8a-cafe-4cca-b0bb-1111aaaa2222"
    first = service.should_shadow_test(user_id)
    for _ in range(10):
        assert service.should_shadow_test(user_id) == first


def test_shadow_test_roughly_one_in_ten(service):
    """Out of 1000 random-looking user_ids, ~10% should be shadow testers."""
    import uuid
    hits = sum(1 for _ in range(1000) if service.should_shadow_test(str(uuid.uuid4())))
    # Allow a wide band — distribution is fine as long as it's clearly not 0% or 50%.
    assert 50 <= hits <= 200


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------

def test_submit_feedback_records_row(service, db):
    out = service.submit_feedback(db, "abc123", rating=4, feedback="ok", helpful=True)
    assert out["youtube_id"] == "abc123"
    from models import BlacklistFeedback
    rows = db.query(BlacklistFeedback).filter_by(youtube_id="abc123").all()
    assert len(rows) == 1
    assert rows[0].rating == 4


def test_feedback_rating_validates_range(service, db):
    with pytest.raises(ValueError):
        service.submit_feedback(db, "abc123", rating=6)
    with pytest.raises(ValueError):
        service.submit_feedback(db, "abc123", rating=0)


def test_feedback_aggregates(service, db):
    service.submit_feedback(db, "abc123", rating=4)
    service.submit_feedback(db, "abc123", rating=2)
    service.submit_feedback(db, "def456", rating=5)
    agg = service.feedback_aggregates(db, ["abc123", "def456", "ghost"])
    assert agg["abc123"]["count"] == 2
    assert agg["abc123"]["avg_rating"] == 3.0
    assert agg["def456"]["avg_rating"] == 5.0
    assert "ghost" not in agg


# ---------------------------------------------------------------------------
# Listing / stats
# ---------------------------------------------------------------------------

def test_list_blacklist_filters_by_type(service, db):
    service.blacklist_video(db, "soft1", "x", "soft")
    service.blacklist_video(db, "hard1", "x", "hard")
    soft_only = service.list_blacklist(db, blacklist_type="soft")
    assert len(soft_only) == 1
    assert soft_only[0]["youtube_id"] == "soft1"


def test_stats_counts(service, db):
    service.blacklist_video(db, "soft1", "x", "soft")
    service.blacklist_video(db, "soft2", "x", "soft")
    service.blacklist_video(db, "hard1", "x", "hard")
    s = service.stats(db)
    assert s["total_active"] == 3
    assert s["soft"] == 2
    assert s["hard"] == 1


# ---------------------------------------------------------------------------
# re_evaluate_blacklist with mocked EQS
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_re_evaluate_lifts_when_score_improves(service, db):
    service.blacklist_video(db, "yt1", "low", "soft")
    from models import VideoBlacklist
    row = db.query(VideoBlacklist).filter_by(youtube_id="yt1").first()
    row.retry_date = datetime.utcnow() - timedelta(days=1)  # mark expired
    db.commit()

    fake_eqs = MagicMock()
    fake_eqs.score_video = AsyncMock(return_value={"score": 80})

    result = await service.re_evaluate_blacklist(db, eqs_service=fake_eqs)
    assert result["lifted"] == 1
    assert result["extended"] == 0
    assert service.is_blacklisted(db, "yt1") is False


@pytest.mark.asyncio
async def test_re_evaluate_extends_when_still_low(service, db):
    service.blacklist_video(db, "yt1", "low", "soft")
    from models import VideoBlacklist
    row = db.query(VideoBlacklist).filter_by(youtube_id="yt1").first()
    row.retry_date = datetime.utcnow() - timedelta(days=1)
    db.commit()

    fake_eqs = MagicMock()
    fake_eqs.score_video = AsyncMock(return_value={"score": 40})

    result = await service.re_evaluate_blacklist(db, eqs_service=fake_eqs)
    assert result["lifted"] == 0
    assert result["extended"] == 1
    assert service.is_blacklisted(db, "yt1") is True


@pytest.mark.asyncio
async def test_re_evaluate_skips_non_expired(service, db):
    service.blacklist_video(db, "yt1", "low", "soft")  # retry_date is in the future
    fake_eqs = MagicMock()
    fake_eqs.score_video = AsyncMock(return_value={"score": 80})
    result = await service.re_evaluate_blacklist(db, eqs_service=fake_eqs)
    assert result["total_expired"] == 0
    assert result["lifted"] == 0
