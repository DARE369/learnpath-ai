import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import UserCreate, UserLogin, UserResponse, GoogleSignIn
from services.auth_service import auth_service

router = APIRouter()
logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

REFRESH_COOKIE = "refresh_token"


def _set_refresh_cookie(response: Response, token: str) -> None:
    """Single place for refresh-cookie attributes so login/google/refresh stay
    consistent. httponly + secure + samesite=lax (requests are same-origin via the
    Next.js rewrite proxy)."""
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
        max_age=7 * 24 * 60 * 60,
    )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = auth_service.get_current_user_id(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = auth_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.account_active:
        raise HTTPException(status_code=403, detail="Account deactivated")

    # Auto-promote configured admin emails (ADMIN_EMAILS) on the fly — no SQL,
    # no restart needed for a configured admin to gain access.
    try:
        from config import settings
        admin_emails = {e.strip().lower() for e in (settings.ADMIN_EMAILS or "").split(",") if e.strip()}
        if admin_emails and user.email and user.email.lower() in admin_emails and user.role != "admin":
            user.role = "admin"
            db.commit()
    except Exception:
        db.rollback()

    # Presence heartbeat for the study-buddy system — throttled so we write at
    # most once every ~2 min per user, not on every request.
    try:
        from datetime import datetime, timedelta
        now = datetime.utcnow()
        if user.last_seen_at is None or (now - user.last_seen_at) > timedelta(minutes=2):
            user.last_seen_at = now
            db.commit()
    except Exception:
        db.rollback()

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency for admin-only endpoints. 403s any non-admin user."""
    if getattr(current_user, "role", "user") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.post("/signup", response_model=dict, status_code=201)
async def signup(payload: UserCreate, db: Session = Depends(get_db)):
    try:
        user = auth_service.create_user(
            db,
            email=payload.email,
            password=payload.password,
            full_name=payload.full_name,
            role=payload.role,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    tokens = auth_service.generate_tokens(str(user.id))
    logger.info(f"New user registered: {user.email}")
    return {
        "user": UserResponse.model_validate(user).model_dump(mode="json"),
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "token_type": "bearer",
    }


@router.post("/login", response_model=dict)
async def login(payload: UserLogin, response: Response, db: Session = Depends(get_db)):
    user = auth_service.authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.account_active:
        raise HTTPException(status_code=403, detail="Account deactivated")

    tokens = auth_service.generate_tokens(str(user.id))
    _set_refresh_cookie(response, tokens["refresh_token"])
    logger.info(f"User logged in: {user.email}")
    return {
        "user": UserResponse.model_validate(user).model_dump(mode="json"),
        "access_token": tokens["access_token"],
        "token_type": "bearer",
    }


@router.post("/google", response_model=dict)
async def google_signin(payload: GoogleSignIn, response: Response, db: Session = Depends(get_db)):
    try:
        user = auth_service.signin_with_google(db, payload.access_token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    tokens = auth_service.generate_tokens(str(user.id))
    _set_refresh_cookie(response, tokens["refresh_token"])
    logger.info(f"Google sign-in: {user.email}")
    return {
        "user": UserResponse.model_validate(user).model_dump(mode="json"),
        "access_token": tokens["access_token"],
        "token_type": "bearer",
    }


@router.post("/refresh", response_model=dict)
async def refresh_token(
    response: Response,
    refresh_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
):
    """Rotating refresh: the old refresh token is revoked (one-time use) and a
    fresh access+refresh pair is issued. Reusing a rotated token fails — which
    also blocks replay of a stolen refresh token."""
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token required")
    rotated = auth_service.rotate_refresh_token(db, refresh_token)
    if not rotated:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    _set_refresh_cookie(response, rotated["refresh_token"])
    return {"access_token": rotated["access_token"], "token_type": "bearer"}


@router.post("/logout")
async def logout(response: Response, refresh_token: Optional[str] = Cookie(default=None), db: Session = Depends(get_db)):
    # Revoke server-side so the refresh token can't be reused after logout.
    if refresh_token:
        auth_service.revoke_refresh_token(db, refresh_token)
    response.delete_cookie(REFRESH_COOKIE, path="/")
    return {"message": "Logged out successfully"}


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Start a password reset. Always returns a generic success so the endpoint
    can't be used to discover which emails are registered."""
    generic = {"message": "If an account exists for that email, a reset link has been sent."}
    user = auth_service.get_user_by_email(db, payload.email)
    # Only password accounts can reset (Google-only accounts have no password).
    if user and user.password_hash:
        token = auth_service.create_password_reset_token(str(user.id))
        try:
            from services.notification_service import notification_service
            notification_service.send_password_reset(user.email, token)  # no-op until email keys set
        except Exception as e:
            logger.warning(f"reset email send failed (non-fatal): {e}")
        from config import settings as _s
        if _s.ENVIRONMENT != "production":
            logger.info(f"[dev] password reset token for {user.email}: {token}")
    return generic


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    user_id = auth_service.consume_password_reset_token(db, payload.token)
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    pw_errors = auth_service.validate_password_strength(payload.new_password)
    if pw_errors:
        raise HTTPException(status_code=400, detail=f"Password must contain: {', '.join(pw_errors)}")
    user = auth_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    auth_service.set_password(db, user, payload.new_password)
    logger.info(f"Password reset for: {user.email}")
    return {"message": "Password updated. Please sign in."}


# ── Data rights (Stage 8) ─────────────────────────────────────────────────────


@router.get("/export")
async def export_my_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download everything we hold for the signed-in user (NDPR/GDPR access)."""
    from services.privacy_service import export_user_data
    return {
        "exported_at": datetime.utcnow().isoformat(),
        "user_id": str(current_user.id),
        "data": export_user_data(db, current_user.id),
    }


class DeleteAccountRequest(BaseModel):
    confirm: bool = False
    password: Optional[str] = None


@router.post("/account/delete")
async def delete_my_account(
    payload: DeleteAccountRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    refresh_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
):
    """Erase the signed-in user's account (anonymise + deactivate). Requires the
    account password when the user has one."""
    if not payload.confirm:
        raise HTTPException(status_code=400, detail="Confirmation required")
    if current_user.password_hash:
        from services.auth_service import verify_password
        if not payload.password or not verify_password(payload.password, current_user.password_hash):
            raise HTTPException(status_code=403, detail="Password is incorrect")

    from services.privacy_service import delete_user_account
    delete_user_account(db, current_user)
    if refresh_token:
        auth_service.revoke_refresh_token(db, refresh_token)
    response.delete_cookie(REFRESH_COOKIE, path="/")
    logger.info("Account deletion completed")
    return {"message": "Your account has been deleted."}


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        from models import UserProfile
        profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
        current_user.onboarding_completed = bool(profile.onboarding_completed) if profile else False
    except Exception:
        # user_profiles table may not exist on this deploy yet — default to False
        current_user.onboarding_completed = False
    return current_user


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    country: Optional[str] = None
    age: Optional[int] = None
    bio: Optional[str] = None


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the authenticated user's editable profile fields."""
    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip() or None
    if payload.country is not None:
        current_user.country = payload.country.strip() or None
    if payload.age is not None:
        current_user.age = payload.age
    if payload.bio is not None:
        current_user.bio = payload.bio.strip() or None
    db.commit()
    db.refresh(current_user)
    return current_user
