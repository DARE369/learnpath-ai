"""Integration tests for summary API endpoints."""

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_generate_summary_missing_body():
    """POST without body returns 422."""
    response = client.post("/api/summary/generate")
    assert response.status_code == 422


def test_generate_summary_empty_transcript():
    """POST with empty transcript returns 422 (min_length=10)."""
    response = client.post("/api/summary/generate", json={
        "youtube_id": "abc123",
        "transcript": "",
    })
    assert response.status_code == 422


def test_generate_summary_short_transcript():
    """POST with transcript under min_length returns 422."""
    response = client.post("/api/summary/generate", json={
        "youtube_id": "abc123",
        "transcript": "short",
    })
    assert response.status_code == 422


def test_generate_summary_no_api_key():
    """Without CLAUDE_API_KEY, endpoint returns 400 or 500 (not 422)."""
    response = client.post("/api/summary/generate", json={
        "youtube_id": "abc123",
        "transcript": "This is a test transcript about learning and education.",
        "title": "Test Video",
    })
    assert response.status_code in [200, 400, 500]


def test_generate_summary_max_length_out_of_range():
    """max_length outside [100, 2000] returns 422."""
    response = client.post("/api/summary/generate", json={
        "youtube_id": "abc123",
        "transcript": "This is a valid transcript for testing purposes.",
        "max_length": 50,
    })
    assert response.status_code == 422


def test_health_check_still_works():
    """Adding summary router must not break the health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
