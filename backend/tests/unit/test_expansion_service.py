"""
Unit tests for ExpansionService — semantic dedup with mocked Claude,
popular-topic detection from real SearchEvent rows, keyword extraction,
budget-exhaustion handling, and the orchestrator's NightlyRun record.

DB uses in-memory SQLite restricted to the tables this packet adds.
"""

import json
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from services.expansion_service import (
    ExpansionService,
    POPULAR_THRESHOLD,
    _extract_json,
)


# ---------------------------------------------------------------------------
# DB fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def db():
    from models import SearchEvent, TopicAlias, TopicKeyword, NightlyRun
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(
        bind=engine,
        tables=[
            SearchEvent.__table__,
            TopicAlias.__table__,
            TopicKeyword.__table__,
            NightlyRun.__table__,
        ],
    )
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def service():
    return ExpansionService()


def _add_searches(db, query: str, count: int, days_ago: int = 0):
    from models import SearchEvent
    base = datetime.utcnow() - timedelta(days=days_ago)
    for i in range(count):
        db.add(SearchEvent(
            query_normalized=query,
            source="generated",
            average_score=70,
            created_at=base - timedelta(minutes=i),
        ))
    db.commit()


# ---------------------------------------------------------------------------
# _extract_json
# ---------------------------------------------------------------------------

def test_extract_json_finds_embedded_object():
    text = "Sure thing!\n" + json.dumps({"groups": [{"canonical": "x"}]}) + "\nDone."
    out = _extract_json(text)
    assert out == {"groups": [{"canonical": "x"}]}


def test_extract_json_returns_none_on_garbage():
    assert _extract_json("no json here at all") is None


# ---------------------------------------------------------------------------
# distinct_queries_in_window
# ---------------------------------------------------------------------------

def test_distinct_queries_counts_within_window(service, db):
    _add_searches(db, "addition", 15, days_ago=2)
    _add_searches(db, "fractions", 8, days_ago=5)
    _add_searches(db, "old query", 50, days_ago=60)  # outside 30-day window
    rows = service.distinct_queries_in_window(db, days=30)
    queries = dict(rows)
    assert queries["addition"] == 15
    assert queries["fractions"] == 8
    assert "old query" not in queries


# ---------------------------------------------------------------------------
# identify_popular_topics
# ---------------------------------------------------------------------------

def test_popular_topics_applies_threshold(service, db):
    _add_searches(db, "popular", POPULAR_THRESHOLD + 5)
    _add_searches(db, "edge", POPULAR_THRESHOLD)         # exactly at threshold — NOT popular
    _add_searches(db, "rare", 3)
    popular = service.identify_popular_topics(db)
    names = [p["query"] for p in popular]
    assert "popular" in names
    assert "edge" not in names  # uses strict > not >=
    assert "rare" not in names


# ---------------------------------------------------------------------------
# deduplicate_topics (mocked Claude)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_deduplicate_writes_alias_rows(service, db):
    service.api_key = "test-key"
    _add_searches(db, "photosynthesis", 5)
    _add_searches(db, "how plants make food", 3)
    _add_searches(db, "fractions", 7)

    fake_response = MagicMock()
    fake_response.content = [
        MagicMock(text=json.dumps({
            "groups": [
                {
                    "canonical": "photosynthesis",
                    "aliases": ["how plants make food"],
                    "confidence": 0.92,
                }
            ]
        }))
    ]
    fake_client = MagicMock()
    fake_client.messages.create = AsyncMock(return_value=fake_response)

    with patch("services.expansion_service.anthropic.AsyncAnthropic", return_value=fake_client), \
         patch("services.expansion_service.cost_tracker.charge"):
        result = await service.deduplicate_topics(db)

    assert result["groups"] == 1
    assert result["merged"] == 1
    assert result["distinct_scanned"] == 3

    from models import TopicAlias
    rows = db.query(TopicAlias).filter_by(is_active=True).all()
    assert len(rows) == 1
    assert rows[0].alias_query == "how plants make food"
    assert rows[0].canonical_query == "photosynthesis"
    assert 0.9 <= rows[0].similarity_score <= 0.95


@pytest.mark.asyncio
async def test_deduplicate_drops_single_member_groups(service, db):
    """Claude returning a group with empty aliases (or just the canonical) is ignored."""
    service.api_key = "test-key"
    _add_searches(db, "addition", 5)
    _add_searches(db, "fractions", 5)

    fake_response = MagicMock()
    fake_response.content = [
        MagicMock(text=json.dumps({
            "groups": [
                {"canonical": "addition", "aliases": [], "confidence": 1.0},
                {"canonical": "fractions", "aliases": ["fractions"], "confidence": 1.0},
            ]
        }))
    ]
    fake_client = MagicMock()
    fake_client.messages.create = AsyncMock(return_value=fake_response)

    with patch("services.expansion_service.anthropic.AsyncAnthropic", return_value=fake_client), \
         patch("services.expansion_service.cost_tracker.charge"):
        result = await service.deduplicate_topics(db)

    assert result["merged"] == 0
    assert result["groups"] == 0


@pytest.mark.asyncio
async def test_deduplicate_skips_when_fewer_than_two_queries(service, db):
    """Nothing to cluster — should NOT call Claude or charge the budget."""
    _add_searches(db, "lonely", 5)
    charge = MagicMock()
    with patch("services.expansion_service.cost_tracker.charge", charge):
        result = await service.deduplicate_topics(db)
    assert result["merged"] == 0
    assert result["distinct_scanned"] == 1
    charge.assert_not_called()


# ---------------------------------------------------------------------------
# extract_keywords + persistence
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_extract_keywords_clean(service):
    service.api_key = "test-key"
    fake_response = MagicMock()
    fake_response.content = [
        MagicMock(text=json.dumps({"keywords": ["light", "chlorophyll", "Glucose", "  ", 42]}))
    ]
    fake_client = MagicMock()
    fake_client.messages.create = AsyncMock(return_value=fake_response)
    with patch("services.expansion_service.anthropic.AsyncAnthropic", return_value=fake_client):
        out = await service.extract_keywords("photosynthesis")
    assert out == ["light", "chlorophyll", "glucose"]


@pytest.mark.asyncio
async def test_index_keywords_stops_at_budget(service, db):
    from services.cost_tracker import BudgetExceeded
    service.api_key = "test-key"

    fake_response = MagicMock()
    fake_response.content = [
        MagicMock(text=json.dumps({"keywords": ["a", "b", "c"]}))
    ]
    fake_client = MagicMock()
    fake_client.messages.create = AsyncMock(return_value=fake_response)

    charge_calls = MagicMock(side_effect=[None, None, BudgetExceeded("no budget")])

    with patch("services.expansion_service.anthropic.AsyncAnthropic", return_value=fake_client), \
         patch("services.expansion_service.cost_tracker.charge", charge_calls):
        result = await service.index_keywords_for_topics(
            db, ["topic_a", "topic_b", "topic_c", "topic_d"]
        )

    assert result["indexed"] == 2
    assert result["skipped_budget"] == 2  # topics c and d skipped


# ---------------------------------------------------------------------------
# auto_expand_topic (delegates to branching_service)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_auto_expand_delegates_to_branching(service, db):
    fake_branches = [MagicMock(branch_id=str(i)) for i in range(3)]
    fake_branching = MagicMock()
    fake_branching.generate_branches = AsyncMock(return_value=fake_branches)
    with patch("services.branching_service.branching_service", fake_branching):
        out = await service.auto_expand_topic(db, "photosynthesis")
    assert out["branch_count"] == 3
    assert out["error"] is None


@pytest.mark.asyncio
async def test_auto_expand_handles_budget_exceeded(service, db):
    from services.cost_tracker import BudgetExceeded
    fake_branching = MagicMock()
    fake_branching.generate_branches = AsyncMock(side_effect=BudgetExceeded("spent"))
    with patch("services.branching_service.branching_service", fake_branching):
        out = await service.auto_expand_topic(db, "x")
    assert out["branch_count"] == 0
    assert "budget" in out["error"]


# ---------------------------------------------------------------------------
# run_nightly_job orchestrator
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_nightly_job_writes_run_record(service, db):
    service.api_key = "test-key"
    _add_searches(db, "popular topic", POPULAR_THRESHOLD + 2)
    _add_searches(db, "other topic", 5)

    dedup_response = MagicMock()
    dedup_response.content = [MagicMock(text=json.dumps({"groups": []}))]
    keywords_response = MagicMock()
    keywords_response.content = [MagicMock(text=json.dumps({"keywords": ["k1", "k2"]}))]
    fake_client = MagicMock()
    fake_client.messages.create = AsyncMock(side_effect=[dedup_response, keywords_response])

    fake_branching = MagicMock()
    fake_branching.generate_branches = AsyncMock(return_value=[MagicMock(), MagicMock()])

    with patch("services.expansion_service.anthropic.AsyncAnthropic", return_value=fake_client), \
         patch("services.branching_service.branching_service", fake_branching), \
         patch("services.expansion_service.cost_tracker.charge"):
        result = await service.run_nightly_job(db)

    assert result["status"] in ("success", "partial")
    assert result["popular_topics_count"] == 1
    assert result["keywords_extracted"] == 1
    assert result["topics_expanded"] == 1

    from models import NightlyRun
    rows = db.query(NightlyRun).all()
    assert len(rows) == 1
    assert rows[0].finished_at is not None
    assert rows[0].duration_seconds is not None


@pytest.mark.asyncio
async def test_run_nightly_job_handles_no_popular_topics(service, db):
    """No popular topics → no LLM calls past dedup; status still success."""
    _add_searches(db, "rare1", 3)
    _add_searches(db, "rare2", 4)
    service.api_key = "test-key"

    dedup_response = MagicMock()
    dedup_response.content = [MagicMock(text=json.dumps({"groups": []}))]
    fake_client = MagicMock()
    fake_client.messages.create = AsyncMock(return_value=dedup_response)

    with patch("services.expansion_service.anthropic.AsyncAnthropic", return_value=fake_client), \
         patch("services.expansion_service.cost_tracker.charge"):
        result = await service.run_nightly_job(db)

    assert result["popular_topics_count"] == 0
    assert result["keywords_extracted"] == 0
    assert result["topics_expanded"] == 0
    assert result["status"] == "success"
