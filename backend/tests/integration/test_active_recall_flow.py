"""
Integration tests for /api/questions endpoints.
Validates request/response shapes and auth guards — no real Claude API calls.
"""

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


# ─── POST /api/questions/generate ────────────────────────────────────────────

def test_generate_missing_body():
    response = client.post("/api/questions/generate")
    assert response.status_code == 422


def test_generate_missing_concept():
    response = client.post("/api/questions/generate", json={"video_summary": "summary"})
    assert response.status_code == 422


def test_generate_missing_summary():
    response = client.post("/api/questions/generate", json={"concept_name": "ML"})
    assert response.status_code == 422


def test_generate_requires_auth():
    response = client.post("/api/questions/generate", json={
        "video_summary": "A video about photosynthesis",
        "concept_name": "Photosynthesis",
    })
    assert response.status_code == 401


# ─── POST /api/questions/evaluate ────────────────────────────────────────────

def test_evaluate_missing_body():
    response = client.post("/api/questions/evaluate")
    assert response.status_code == 422


def test_evaluate_missing_student_answer():
    response = client.post("/api/questions/evaluate", json={
        "question": "What is X?",
        "correct_answer": "X is Y",
    })
    assert response.status_code == 422


def test_evaluate_requires_auth():
    response = client.post("/api/questions/evaluate", json={
        "question": "What is X?",
        "correct_answer": "X is Y",
        "student_answer": "X is Z",
    })
    assert response.status_code == 401


# ─── POST /api/questions/schedule ────────────────────────────────────────────

def test_schedule_missing_body():
    response = client.post("/api/questions/schedule")
    assert response.status_code == 422


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

def test_explanation_missing_body():
    response = client.post("/api/questions/explanation")
    assert response.status_code == 422


def test_explanation_requires_auth():
    response = client.post("/api/questions/explanation", json={
        "answer": "Plants use sunlight",
        "concept_name": "Photosynthesis",
    })
    assert response.status_code == 401
