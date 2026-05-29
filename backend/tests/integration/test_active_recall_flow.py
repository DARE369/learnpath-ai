"""
Integration tests for /api/questions endpoints.
All routes require auth, which is checked BEFORE body validation —
so unauthenticated requests always get 401, never 422.
These tests cover only what can be verified without a real auth fixture.
"""

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


# ─── POST /api/questions/generate ────────────────────────────────────────────

def test_generate_requires_auth():
    response = client.post("/api/questions/generate", json={
        "video_summary": "A video about photosynthesis",
        "concept_name": "Photosynthesis",
    })
    assert response.status_code == 401


# ─── POST /api/questions/evaluate ────────────────────────────────────────────

def test_evaluate_requires_auth():
    response = client.post("/api/questions/evaluate", json={
        "question": "What is X?",
        "correct_answer": "X is Y",
        "student_answer": "X is Z",
    })
    assert response.status_code == 401


# ─── POST /api/questions/schedule ────────────────────────────────────────────

def test_schedule_requires_auth():
    response = client.post("/api/questions/schedule", json={
        "concept_name": "ML",
        "is_correct": True,
        "times_reviewed": 0,
    })
    assert response.status_code == 401


# ─── GET /api/questions/due/{user_id} ────────────────────────────────────────

def test_due_requires_auth():
    response = client.get("/api/questions/due/some-user-id")
    assert response.status_code == 401


# ─── POST /api/questions/explanation ─────────────────────────────────────────

def test_explanation_requires_auth():
    response = client.post("/api/questions/explanation", json={
        "answer": "Plants use sunlight",
        "concept_name": "Photosynthesis",
    })
    assert response.status_code == 401
