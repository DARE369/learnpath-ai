"""Unit tests for EQSService — Claude API calls are mocked."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from services.eqs_service import EQSService, _parse_answers, _compute_tier


# ---------------------------------------------------------------------------
# Pure function tests
# ---------------------------------------------------------------------------

def test_compute_tier_boundaries():
    assert _compute_tier(100) == 1
    assert _compute_tier(85) == 1
    assert _compute_tier(84) == 2
    assert _compute_tier(65) == 2
    assert _compute_tier(64) == 3
    assert _compute_tier(40) == 3
    assert _compute_tier(39) == 4
    assert _compute_tier(0) == 4


def test_parse_answers_all_yes():
    text = "\n".join(f"{i}. YES" for i in range(1, 15))
    answers = _parse_answers(text)
    assert len(answers) == 14
    assert all(answers)


def test_parse_answers_all_no():
    text = "\n".join(f"{i}. NO" for i in range(1, 15))
    answers = _parse_answers(text)
    assert len(answers) == 14
    assert not any(answers)


def test_parse_answers_mixed():
    lines = [f"{i}. {'YES' if i % 2 == 0 else 'NO'}" for i in range(1, 15)]
    answers = _parse_answers("\n".join(lines))
    assert answers[0] is False   # question 1 → NO
    assert answers[1] is True    # question 2 → YES


# ---------------------------------------------------------------------------
# Async — score_video
# ---------------------------------------------------------------------------

@pytest.fixture
def service():
    s = EQSService()
    s.api_key = "test_key"
    return s


async def test_score_video_raises_without_api_key():
    s = EQSService()
    s.api_key = None
    with pytest.raises(ValueError, match="CLAUDE_API_KEY not configured"):
        await s.score_video("dQw4w9WgXcQ", "Test Video")


async def test_score_video_all_yes(service):
    yes_answers = "\n".join(f"{i}. YES" for i in range(1, 15))
    mock_response = f"{yes_answers}\nASSESSMENT: Excellent educational video."

    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=mock_response)]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_message)

    with patch("services.eqs_service.anthropic.AsyncAnthropic", return_value=mock_client):
        result = await service.score_video(
            "dQw4w9WgXcQ", "Test Video", transcript="some content"
        )

    assert result["score"] == 100
    assert result["tier"] == 1
    assert result["tier_label"] == "Excellent"
    assert result["yes_count"] == 14
    assert len(result["answers"]) == 14
    assert "Excellent" in result["reasoning"]


async def test_score_video_half_yes(service):
    lines = [f"{i}. {'YES' if i <= 7 else 'NO'}" for i in range(1, 15)]
    mock_response = "\n".join(lines) + "\nASSESSMENT: Decent but could improve."

    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=mock_response)]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_message)

    with patch("services.eqs_service.anthropic.AsyncAnthropic", return_value=mock_client):
        result = await service.score_video("abc123", "Half Good Video")

    assert result["score"] == 50
    assert result["tier"] == 3
    assert result["yes_count"] == 7


async def test_score_video_all_no(service):
    no_answers = "\n".join(f"{i}. NO" for i in range(1, 15))
    mock_response = f"{no_answers}\nASSESSMENT: Poor quality video."

    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=mock_response)]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_message)

    with patch("services.eqs_service.anthropic.AsyncAnthropic", return_value=mock_client):
        result = await service.score_video("xyz", "Bad Video")

    assert result["score"] == 0
    assert result["tier"] == 4
    assert result["tier_label"] == "Poor"
    assert result["yes_count"] == 0
