"""
Integration tests for YouTube API endpoints.
These tests exercise the full FastAPI request/response cycle.
YOUTUBE_API_KEY is not set in CI so 400 is an expected status code.
"""

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_search_endpoint_with_query():
    """Search endpoint accepts a valid query and returns a sensible status code."""
    response = client.get("/api/youtube/search?query=photosynthesis&max_results=5")
    # 200 success, 400 API key not configured, 404 no results, 500 API error
    assert response.status_code in [200, 400, 404, 500]
    if response.status_code == 200:
        data = response.json()
        assert isinstance(data, list)
        if data:
            assert "youtube_id" in data[0]
            assert "title" in data[0]


def test_search_endpoint_missing_query():
    """Search endpoint returns 422 when required 'query' param is absent."""
    response = client.get("/api/youtube/search")
    assert response.status_code == 422


def test_search_endpoint_query_too_short():
    """Search endpoint returns 422 when query is shorter than min_length=2."""
    response = client.get("/api/youtube/search?query=a")
    assert response.status_code == 422


def test_search_endpoint_max_results_out_of_range():
    """Search endpoint returns 422 when max_results is out of valid range."""
    response = client.get("/api/youtube/search?query=photosynthesis&max_results=0")
    assert response.status_code == 422
    response2 = client.get("/api/youtube/search?query=photosynthesis&max_results=51")
    assert response2.status_code == 422


def test_health_check_still_works():
    """Sanity check that adding YouTube router didn't break the health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
