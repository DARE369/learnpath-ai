"""
Integration tests for /api/search endpoints.
Auth runs before body validation — these tests cover the auth gate only.
Real search behavior is covered by unit tests of SearchService directly.
"""

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_build_path_requires_auth():
    response = client.post("/api/search/build-path", json={"query": "Machine Learning"})
    assert response.status_code == 401
