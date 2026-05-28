"""Unit tests for AuthService — no DB or real API calls required."""

import pytest
from services.auth_service import (
    AuthService,
    _validate_password,
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

def test_hash_password_produces_bcrypt_hash():
    hashed = hash_password("TestPass1!")
    assert hashed != "TestPass1!"
    assert hashed.startswith("$2b$")


def test_verify_password_correct():
    hashed = hash_password("TestPass1!")
    assert verify_password("TestPass1!", hashed) is True


def test_verify_password_wrong():
    hashed = hash_password("TestPass1!")
    assert verify_password("WrongPass1!", hashed) is False


def test_different_hashes_for_same_password():
    h1 = hash_password("TestPass1!")
    h2 = hash_password("TestPass1!")
    assert h1 != h2  # bcrypt uses random salt


# ---------------------------------------------------------------------------
# Password validation
# ---------------------------------------------------------------------------

def test_validate_password_strong():
    assert _validate_password("Secure@123") == []


def test_validate_password_too_short():
    errors = _validate_password("Ab1!")
    assert any("8 characters" in e for e in errors)


def test_validate_password_no_uppercase():
    errors = _validate_password("secure@123")
    assert any("uppercase" in e for e in errors)


def test_validate_password_no_lowercase():
    errors = _validate_password("SECURE@123")
    assert any("lowercase" in e for e in errors)


def test_validate_password_no_number():
    errors = _validate_password("Secure@abc")
    assert any("number" in e for e in errors)


def test_validate_password_no_special():
    errors = _validate_password("Secure123A")
    assert any("special" in e for e in errors)


def test_validate_password_all_missing():
    errors = _validate_password("a")
    assert len(errors) >= 4


# ---------------------------------------------------------------------------
# JWT token creation and decoding
# ---------------------------------------------------------------------------

def test_create_access_token_is_string():
    token = create_access_token("user-abc")
    assert isinstance(token, str)
    assert len(token) > 30


def test_create_refresh_token_is_string():
    token = create_refresh_token("user-abc")
    assert isinstance(token, str)
    assert len(token) > 30


def test_decode_access_token_payload():
    token = create_access_token("user-123")
    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == "user-123"
    assert payload["type"] == "access"


def test_decode_refresh_token_payload():
    token = create_refresh_token("user-456")
    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == "user-456"
    assert payload["type"] == "refresh"


def test_decode_invalid_token_returns_none():
    assert decode_token("not.a.real.token") is None


def test_decode_tampered_token_returns_none():
    token = create_access_token("user-999")
    tampered = token[:-5] + "XXXXX"
    assert decode_token(tampered) is None


def test_access_and_refresh_tokens_differ():
    uid = "user-same"
    access = create_access_token(uid)
    refresh = create_refresh_token(uid)
    assert access != refresh


# ---------------------------------------------------------------------------
# AuthService.refresh_access_token
# ---------------------------------------------------------------------------

def test_refresh_access_token_accepts_refresh_token():
    service = AuthService()
    refresh = create_refresh_token("user-777")
    new_access = service.refresh_access_token(refresh)
    assert new_access is not None
    payload = decode_token(new_access)
    assert payload["type"] == "access"
    assert payload["sub"] == "user-777"


def test_refresh_access_token_rejects_access_token():
    service = AuthService()
    access = create_access_token("user-777")
    result = service.refresh_access_token(access)
    assert result is None


def test_refresh_access_token_rejects_garbage():
    service = AuthService()
    assert service.refresh_access_token("garbage.token.here") is None


# ---------------------------------------------------------------------------
# AuthService.get_current_user_id
# ---------------------------------------------------------------------------

def test_get_current_user_id_from_access_token():
    service = AuthService()
    token = create_access_token("user-555")
    uid = service.get_current_user_id(token)
    assert uid == "user-555"


def test_get_current_user_id_rejects_refresh_token():
    service = AuthService()
    token = create_refresh_token("user-555")
    assert service.get_current_user_id(token) is None


def test_get_current_user_id_rejects_garbage():
    service = AuthService()
    assert service.get_current_user_id("bad.token") is None


# ---------------------------------------------------------------------------
# AuthService.generate_tokens
# ---------------------------------------------------------------------------

def test_generate_tokens_returns_both():
    service = AuthService()
    tokens = service.generate_tokens("user-001")
    assert "access_token" in tokens
    assert "refresh_token" in tokens
    assert tokens["token_type"] == "bearer"
    access_payload = decode_token(tokens["access_token"])
    refresh_payload = decode_token(tokens["refresh_token"])
    assert access_payload["type"] == "access"
    assert refresh_payload["type"] == "refresh"
