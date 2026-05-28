"""Unit tests for SummaryService — Claude API calls are mocked."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from services.summary_service import SummaryService, _parse_json_response, _word_count


# ---------------------------------------------------------------------------
# Pure function tests
# ---------------------------------------------------------------------------

def test_word_count():
    assert _word_count("hello world") == 2
    assert _word_count("one two three four five") == 5
    assert _word_count("") == 0


def test_parse_json_response_raw():
    data = {"summary": "test", "key_concepts": ["a"], "sections": []}
    result = _parse_json_response(json.dumps(data))
    assert result["summary"] == "test"
    assert result["key_concepts"] == ["a"]


def test_parse_json_response_with_fences():
    data = {"summary": "test", "key_concepts": ["a", "b"], "sections": []}
    text = f"```json\n{json.dumps(data)}\n```"
    result = _parse_json_response(text)
    assert result["summary"] == "test"


def test_parse_json_response_invalid():
    with pytest.raises(Exception):
        _parse_json_response("no json here at all")


# ---------------------------------------------------------------------------
# Async — generate_summary
# ---------------------------------------------------------------------------

@pytest.fixture
def service():
    s = SummaryService()
    s.api_key = "test_key"
    return s


SAMPLE_RESPONSE = json.dumps({
    "summary": "This video explains photosynthesis clearly. It covers light reactions and the Calvin cycle. Students will understand how plants convert sunlight to energy.",
    "key_concepts": ["photosynthesis", "chlorophyll", "light reactions", "Calvin cycle", "glucose"],
    "sections": [
        {"title": "Introduction", "content": "Overview of photosynthesis"},
        {"title": "Light Reactions", "content": "How plants capture light energy"},
        {"title": "Calvin Cycle", "content": "How CO2 is converted to glucose"},
    ],
})


async def test_generate_summary_raises_without_api_key():
    s = SummaryService()
    s.api_key = None
    with pytest.raises(ValueError, match="CLAUDE_API_KEY not configured"):
        await s.generate_summary("abc", "transcript text here long enough")


async def test_generate_summary_success(service):
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=SAMPLE_RESPONSE)]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_message)

    with patch("services.summary_service.anthropic.AsyncAnthropic", return_value=mock_client):
        result = await service.generate_summary(
            youtube_id="abc123",
            transcript="Photosynthesis is the process by which plants make food from sunlight.",
            title="Photosynthesis Explained",
        )

    assert result["youtube_id"] == "abc123"
    assert "photosynthesis" in result["summary"].lower()
    assert len(result["key_concepts"]) == 5
    assert len(result["sections"]) == 3
    assert result["word_count"] > 0


async def test_generate_summary_uses_correct_model(service):
    assert service.model == "claude-sonnet-4-6"


async def test_generate_summary_with_max_length(service):
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=SAMPLE_RESPONSE)]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_message)

    with patch("services.summary_service.anthropic.AsyncAnthropic", return_value=mock_client):
        result = await service.generate_summary(
            youtube_id="xyz",
            transcript="A long transcript about machine learning concepts.",
            max_length=200,
        )

    assert result["youtube_id"] == "xyz"
    assert isinstance(result["key_concepts"], list)
