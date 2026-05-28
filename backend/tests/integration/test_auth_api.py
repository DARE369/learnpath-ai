"""
Integration tests for /api/auth endpoints.
Uses FastAPI TestClient — validates request/response shapes without a real DB.
DB-touching paths are skipped here; covered by unit tests with mocks.
"""

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# POST /api/auth/signup
# ---------------------------------------------------------------------------

def test_signup_missing_body():
    response = client.post("/api/auth/signup")
    assert response.status_code == 422


def test_signup_missing_email():
    response = client.post("/api/auth/signup", json={"password": "Secure@123"})
    assert response.status_code == 422


def test_signup_missing_password():
    response = client.post("/api/auth/signup", json={"email": "user@example.com"})
    assert response.status_code == 422


def test_signup_password_too_short():
    response = client.post("/api/auth/signup", json={
        "email": "user@example.com",
        "password": "ab",
    })
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/auth/login
# ---------------------------------------------------------------------------

def test_login_missing_body():
    response = client.post("/api/auth/login")
    assert response.status_code == 422


def test_login_missing_email():
    response = client.post("/api/auth/login", json={"password": "Secure@123"})
    assert response.status_code == 422


def test_login_missing_password():
    response = client.post("/api/auth/login", json={"email": "user@example.com"})
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/auth/refresh
# ---------------------------------------------------------------------------

def test_refresh_without_cookie():
    response = client.post("/api/auth/refresh")
    assert response.status_code == 401
    assert "Refresh token required" in response.json()["detail"]


def test_refresh_with_invalid_token():
    client.cookies.set("refresh_token", "totally.invalid.token")
    response = client.post("/api/auth/refresh")
    assert response.status_code == 401
    client.cookies.clear()


# ---------------------------------------------------------------------------
# POST /api/auth/logout
# ---------------------------------------------------------------------------

def test_logout_returns_200():
    response = client.post("/api/auth/logout")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "Logged out" in data["message"]


# ---------------------------------------------------------------------------
# GET /api/auth/me
# ---------------------------------------------------------------------------

def test_me_without_token_returns_401():
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_me_with_invalid_token_returns_401():
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer totally.bad.token"},
    )
    assert response.status_code == 401
