"""Settings & Profile router — ADMIN-1.6."""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user
from services.settings_service import settings_service

router = APIRouter(prefix="/api/settings", tags=["settings"])
logger = logging.getLogger(__name__)


# ── Request schemas ────────────────────────────────────────────────────────────

class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    school_name: Optional[str] = None
    grade_levels: Optional[List[str]] = None
    social_links: Optional[Dict[str, str]] = None
    avatar_url: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class Confirm2FARequest(BaseModel):
    totp_code: str


class Disable2FARequest(BaseModel):
    password: str


class LogoutOtherSessionsRequest(BaseModel):
    current_session_id: Optional[str] = None


class CreateClassRequest(BaseModel):
    name: str
    subject: Optional[str] = ""
    description: Optional[str] = ""
    max_students: Optional[int] = 30


class UpdateClassRequest(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    description: Optional[str] = None
    max_students: Optional[int] = None


class DuplicateClassRequest(BaseModel):
    new_name: str
    copy_roster: bool = False


class ConnectIntegrationRequest(BaseModel):
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    provider_email: Optional[str] = None
    provider_name: Optional[str] = None
    provider_user_id: Optional[str] = None


class UpdatePreferencesRequest(BaseModel):
    theme: Optional[str] = None
    language: Optional[str] = None
    timezone: Optional[str] = None
    default_class_view: Optional[str] = None
    auto_refresh_interval: Optional[int] = None
    remember_sidebar_state: Optional[bool] = None
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    alert_at_risk: Optional[bool] = None
    alert_low_submission: Optional[bool] = None
    alert_system: Optional[bool] = None


class DeleteAccountRequest(BaseModel):
    confirmation: str  # must be "DELETE"


# ── Profile ────────────────────────────────────────────────────────────────────

@router.get("/profile")
def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.get_profile(db, str(current_user.id))


@router.put("/profile")
def update_profile(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.update_profile(db, str(current_user.id), payload.dict(exclude_none=True))


# ── Account & Security ─────────────────────────────────────────────────────────

@router.post("/account/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.change_password(
        db, str(current_user.id), payload.current_password, payload.new_password
    )


@router.get("/account/2fa")
def get_2fa_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.get_2fa_status(db, str(current_user.id))


@router.post("/account/2fa/init")
def init_2fa(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.init_2fa(db, str(current_user.id))


@router.post("/account/2fa/confirm")
def confirm_2fa(
    payload: Confirm2FARequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.confirm_2fa(db, str(current_user.id), payload.totp_code)


@router.post("/account/2fa/disable")
def disable_2fa(
    payload: Disable2FARequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.disable_2fa(db, str(current_user.id), payload.password)


@router.get("/account/sessions")
def get_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.get_sessions(db, str(current_user.id))


@router.post("/account/sessions/logout-others")
def logout_other_sessions(
    payload: LogoutOtherSessionsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.logout_other_sessions(
        db, str(current_user.id), payload.current_session_id
    )


@router.get("/account/activity")
def get_login_activity(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.get_login_activity(db, str(current_user.id), limit)


# ── Classes ────────────────────────────────────────────────────────────────────

@router.get("/classes")
def get_classes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.get_classes(db, str(current_user.id))


@router.post("/classes")
def create_class(
    payload: CreateClassRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.create_class(db, str(current_user.id), payload.dict())


@router.put("/classes/{class_id}")
def update_class(
    class_id: str,
    payload: UpdateClassRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.update_class(
        db, str(current_user.id), class_id, payload.dict(exclude_none=True)
    )


@router.post("/classes/{class_id}/archive")
def archive_class(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.archive_class(db, str(current_user.id), class_id)


@router.post("/classes/{class_id}/duplicate")
def duplicate_class(
    class_id: str,
    payload: DuplicateClassRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.duplicate_class(
        db, str(current_user.id), class_id, payload.new_name, payload.copy_roster
    )


# ── Integrations ───────────────────────────────────────────────────────────────

@router.get("/integrations")
def get_integrations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.get_integrations(db, str(current_user.id))


@router.post("/integrations/{provider}/connect")
def connect_integration(
    provider: str,
    payload: ConnectIntegrationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.connect_integration(
        db, str(current_user.id), provider, payload.dict(exclude_none=True)
    )


@router.delete("/integrations/{provider}")
def disconnect_integration(
    provider: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.disconnect_integration(db, str(current_user.id), provider)


# ── Preferences ────────────────────────────────────────────────────────────────

@router.get("/preferences")
def get_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.get_preferences(db, str(current_user.id))


@router.put("/preferences")
def update_preferences(
    payload: UpdatePreferencesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.update_preferences(
        db, str(current_user.id), payload.dict(exclude_none=True)
    )


# ── Billing ────────────────────────────────────────────────────────────────────

@router.get("/billing")
def get_billing(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.get_billing(db, str(current_user.id))


# ── Privacy & Data ─────────────────────────────────────────────────────────────

@router.post("/privacy/export")
def request_export(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.request_data_export(db, str(current_user.id))


@router.get("/privacy/export")
def get_export_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.get_export_status(db, str(current_user.id))


@router.post("/privacy/delete-account")
def request_deletion(
    payload: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.request_account_deletion(
        db, str(current_user.id), payload.confirmation
    )


@router.post("/privacy/cancel-deletion")
def cancel_deletion(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settings_service.cancel_account_deletion(db, str(current_user.id))
