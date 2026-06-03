import logging
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
    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=7 * 24 * 60 * 60,
    )
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
    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=7 * 24 * 60 * 60,
    )
    logger.info(f"Google sign-in: {user.email}")
    return {
        "user": UserResponse.model_validate(user).model_dump(mode="json"),
        "access_token": tokens["access_token"],
        "token_type": "bearer",
    }


@router.post("/refresh", response_model=dict)
async def refresh_token(refresh_token: Optional[str] = Cookie(default=None)):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token required")
    new_access_token = auth_service.refresh_access_token(refresh_token)
    if not new_access_token:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    return {"access_token": new_access_token, "token_type": "bearer"}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("refresh_token")
    return {"message": "Logged out successfully"}


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
