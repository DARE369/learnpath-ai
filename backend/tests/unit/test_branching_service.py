"""
Unit tests for ConceptBranchingService — pure validation and budget logic
(no Claude calls; the Opus client is mocked).
"""

import json
from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.branching_service import (
    Branch,
    ConceptBranchingService,
    InvalidBranchSet,
)
from services.cost_tracker import CostTracker, BudgetExceeded


# ---------------------------------------------------------------------------
# validate_linear_progression
# ---------------------------------------------------------------------------

@pytest.fixture
def service():
    return ConceptBranchingService()


def _branch(title, level, prereqs=None, order=0):
    return Branch(
        branch_id=f"id-{title}",
        concept_name="Addition",
        branch_title=title,
        description="...",
        difficulty_level=level,
        prerequisites=prereqs or [],
        estimated_duration_minutes=20,
        branch_order=order,
    )


def test_valid_progression_passes(service):
    branches = [
        _branch("Single-digit addition", 1, [], 0),
        _branch("Two-digit addition", 2, ["Single-digit addition"], 1),
        _branch("Adding decimals", 3, ["Two-digit addition"], 2),
    ]
    assert service.validate_linear_progression(branches) is True


def test_too_few_branches_fails(service):
    branches = [
        _branch("A", 1, [], 0),
        _branch("B", 2, ["A"], 1),
    ]
    assert service.validate_linear_progression(branches) is False


def test_too_many_branches_fails(service):
    branches = [_branch(f"B{i}", i + 1, [], i) for i in range(6)]
    assert service.validate_linear_progression(branches) is False


def test_non_monotonic_difficulty_fails(service):
    branches = [
        _branch("A", 1, [], 0),
        _branch("B", 2, ["A"], 1),
        _branch("C", 2, ["B"], 2),  # tied with B — not strict
    ]
    assert service.validate_linear_progression(branches) is False


def test_unknown_prerequisite_fails(service):
    branches = [
        _branch("A", 1, [], 0),
        _branch("B", 2, ["NotARealBranch"], 1),
        _branch("C", 3, ["B"], 2),
    ]
    assert service.validate_linear_progression(branches) is False


def test_empty_title_fails(service):
    branches = [
        _branch("", 1, [], 0),
        _branch("B", 2, [], 1),
        _branch("C", 3, ["B"], 2),
    ]
    assert service.validate_linear_progression(branches) is False


# ---------------------------------------------------------------------------
# _hydrate ordering
# ---------------------------------------------------------------------------

def test_hydrate_sorts_by_difficulty(service):
    raw = [
        {"branch_title": "Hard", "difficulty_level": 5, "prerequisites": []},
        {"branch_title": "Easy", "difficulty_level": 1, "prerequisites": []},
        {"branch_title": "Medium", "difficulty_level": 3, "prerequisites": []},
    ]
    branches = service._hydrate("Addition", raw)
    assert [b.branch_title for b in branches] == ["Easy", "Medium", "Hard"]
    assert [b.branch_order for b in branches] == [0, 1, 2]


# ---------------------------------------------------------------------------
# generate_branches — mocked Opus response, no DB
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_generate_branches_happy_path(service):
    fake_response = MagicMock()
    fake_response.content = [
        MagicMock(text=json.dumps({
            "branches": [
                {"branch_title": "Foundations", "difficulty_level": 1, "prerequisites": [],
                 "description": "...", "estimated_duration_minutes": 15},
                {"branch_title": "Intermediate", "difficulty_level": 2, "prerequisites": ["Foundations"],
                 "description": "...", "estimated_duration_minutes": 25},
                {"branch_title": "Applied", "difficulty_level": 3, "prerequisites": ["Intermediate"],
                 "description": "...", "estimated_duration_minutes": 35},
            ]
        }))
    ]

    fake_client = MagicMock()
    fake_client.messages.create = AsyncMock(return_value=fake_response)
    service.api_key = "test-key"  # bypass missing-key guard

    with patch("services.branching_service.anthropic.AsyncAnthropic", return_value=fake_client), \
         patch("services.branching_service.cost_tracker.charge"):
        branches = await service.generate_branches(
            concept_name="Addition",
            base_concept_summary="basic math",
            db=None,
        )

    assert len(branches) == 3
    assert branches[0].branch_title == "Foundations"
    assert branches[-1].difficulty_level == 3


@pytest.mark.asyncio
async def test_generate_branches_rejects_invalid_set(service):
    """Claude returning a non-monotonic set should raise InvalidBranchSet."""
    fake_response = MagicMock()
    fake_response.content = [
        MagicMock(text=json.dumps({
            "branches": [
                {"branch_title": "A", "difficulty_level": 1, "prerequisites": []},
                {"branch_title": "B", "difficulty_level": 1, "prerequisites": []},  # tied
                {"branch_title": "C", "difficulty_level": 2, "prerequisites": ["A"]},
            ]
        }))
    ]
    fake_client = MagicMock()
    fake_client.messages.create = AsyncMock(return_value=fake_response)
    service.api_key = "test-key"

    with patch("services.branching_service.anthropic.AsyncAnthropic", return_value=fake_client), \
         patch("services.branching_service.cost_tracker.charge"):
        with pytest.raises(InvalidBranchSet):
            await service.generate_branches("X", "y", db=None)


@pytest.mark.asyncio
async def test_generate_branches_missing_key_raises(service):
    service.api_key = None
    with pytest.raises(ValueError):
        await service.generate_branches("X", "y", db=None)


# ---------------------------------------------------------------------------
# CostTracker
# ---------------------------------------------------------------------------

def test_cost_tracker_charges_and_remaining():
    tracker = CostTracker(budgets={"branching": 0.50})
    tracker.charge("branching", 0.15)
    tracker.charge("branching", 0.15)
    assert round(tracker.remaining("branching"), 2) == 0.20


def test_cost_tracker_blocks_over_budget():
    tracker = CostTracker(budgets={"branching": 0.50})
    tracker.charge("branching", 0.40)
    with pytest.raises(BudgetExceeded):
        tracker.charge("branching", 0.20)  # would total 0.60 > 0.50


def test_cost_tracker_day_rollover():
    tracker = CostTracker(budgets={"branching": 0.50})
    tracker.charge("branching", 0.40)
    # Simulate the next day by mutating the tracked day
    tracker._day = date.today() - timedelta(days=1)
    # First call on a "new day" should rollover and let us charge fully again
    tracker.charge("branching", 0.50)
    assert round(tracker.remaining("branching"), 2) == 0.00
