"""
Unit tests for YouTubeService — all HTTP calls are mocked.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from services.youtube_service import YouTubeService


@pytest.fixture
def service():
    s = YouTubeService()
    s.api_key = "test_api_key"  # avoid ValueError in tests
    return s


# ---------------------------------------------------------------------------
# Synchronous helpers
# ---------------------------------------------------------------------------

def test_parse_duration(service):
    assert service._parse_duration("PT1H23M45S") == 5025
    assert service._parse_duration("PT45M") == 2700
    assert service._parse_duration("PT30S") == 30
    assert service._parse_duration("PT5H") == 18000
    assert service._parse_duration("PT0S") == 0
    assert service._parse_duration("INVALID") == 0


def test_extract_youtube_id(service):
    assert service.extract_youtube_id(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    ) == "dQw4w9WgXcQ"
    assert service.extract_youtube_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert service.extract_youtube_id("dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert service.extract_youtube_id("invalid") is None
    assert service.extract_youtube_id("https://example.com/not-a-video") is None


# ---------------------------------------------------------------------------
# Async — search_videos
# ---------------------------------------------------------------------------

async def test_search_videos_success(service):
    mock_response_data = {
        "items": [
            {
                "id": {"kind": "youtube#video", "videoId": "test123"},
                "snippet": {
                    "title": "Test Video",
                    "description": "Test description",
                    "channelId": "ch123",
                    "channelTitle": "Test Channel",
                    "publishedAt": "2026-05-27T00:00:00Z",
                    "thumbnails": {"default": {"url": "http://example.com/thumb.jpg"}},
                },
            }
        ]
    }

    mock_response = MagicMock()
    mock_response.json.return_value = mock_response_data
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)

    with patch("services.youtube_service.httpx.AsyncClient") as MockClient:
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await service.search_videos("test")

    assert len(result) == 1
    assert result[0]["youtube_id"] == "test123"
    assert result[0]["title"] == "Test Video"
    assert result[0]["channel_name"] == "Test Channel"


async def test_search_videos_no_results(service):
    mock_response = MagicMock()
    mock_response.json.return_value = {"items": []}
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)

    with patch("services.youtube_service.httpx.AsyncClient") as MockClient:
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await service.search_videos("nonexistent_xyz_123")

    assert result == []


async def test_search_videos_raises_without_api_key():
    s = YouTubeService()
    s.api_key = None
    with pytest.raises(ValueError, match="YOUTUBE_API_KEY not configured"):
        await s.search_videos("photosynthesis")


# ---------------------------------------------------------------------------
# Async — get_video_details
# ---------------------------------------------------------------------------

async def test_get_video_details_success(service):
    mock_response_data = {
        "items": [
            {
                "contentDetails": {"duration": "PT1H23M45S"},
                "statistics": {
                    "viewCount": "1000000",
                    "likeCount": "50000",
                    "commentCount": "1200",
                },
            }
        ]
    }

    mock_response = MagicMock()
    mock_response.json.return_value = mock_response_data
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)

    with patch("services.youtube_service.httpx.AsyncClient") as MockClient:
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        details = await service.get_video_details("dQw4w9WgXcQ")

    assert details["youtube_id"] == "dQw4w9WgXcQ"
    assert details["duration_seconds"] == 5025
    assert details["view_count"] == 1000000
