import re
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, List

from passlib.context import CryptContext
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from config import settings
from models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

_SPECIAL = r"[!@#$%^&*(),.?\":{}|<>_\-+=\[\]\\;'/`~]"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _validate_password(password: str) -> List[str]:
    errors: List[str] = []
    if len(password) < 8:
        errors.append("at least 8 characters")
    if not re.search(r"[A-Z]", password):
        errors.append("an uppercase letter")
    if not re.search(r"[a-z]", password):
        errors.append("a lowercase letter")
    if not re.search(r"\d", password):
        errors.append("a number")
    if not re.search(_SPECIAL, password):
        errors.append("a special character")
    return errors


def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire, "type": "access", "jti": str(uuid.uuid4())}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": user_id, "exp": expire, "type": "refresh", "jti": str(uuid.uuid4())}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_password_reset_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=1)
    payload = {"sub": str(user_id), "exp": expire, "type": "reset", "jti": str(uuid.uuid4())}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def _exp_dt(payload: Dict) -> datetime:
    exp = payload.get("exp")
    try:
        return datetime.utcfromtimestamp(int(exp)) if exp else datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    except (ValueError, TypeError, OverflowError):
        return datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)


def decode_token(token: str) -> Optional[Dict]:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None


class AuthService:
    def validate_password_strength(self, password: str) -> List[str]:
        return _validate_password(password)

    def get_user_by_email(self, db: Session, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email.lower().strip()).first()

    def get_user_by_id(self, db: Session, user_id: str) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    # Roles a user may self-select at signup. "admin" is intentionally excluded —
    # platform admins are promoted server-side (ADMIN_EMAILS / SQL), never via signup.
    SELF_SIGNUP_ROLES = {"student", "teacher", "school_admin"}

    def create_user(
        self,
        db: Session,
        email: str,
        password: str,
        full_name: Optional[str] = None,
        role: Optional[str] = None,
    ) -> User:
        errors = _validate_password(password)
        if errors:
            raise ValueError(f"Password must contain: {', '.join(errors)}")
        if self.get_user_by_email(db, email):
            raise ValueError("Email already registered")

        chosen_role = role if role in self.SELF_SIGNUP_ROLES else "student"
        user = User(
            email=email.lower().strip(),
            password_hash=hash_password(password),
            full_name=full_name,
            role=chosen_role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def authenticate_user(self, db: Session, email: str, password: str) -> Optional[User]:
        user = self.get_user_by_email(db, email)
        if not user:
            return None
        if not user.password_hash:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user

    def signin_with_google(self, db: Session, access_token: str) -> User:
        """Verify a Google OAuth2 access token via the userinfo endpoint
        and return (or create) the matching user."""
        import httpx

        if not settings.GOOGLE_CLIENT_ID:
            raise ValueError("Google sign-in is not configured")

        try:
            resp = httpx.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10.0,
            )
        except httpx.HTTPError as e:
            raise ValueError(f"Could not reach Google: {e}")

        if resp.status_code != 200:
            raise ValueError("Invalid Google access token")

        info = resp.json()
        email = (info.get("email") or "").lower().strip()
        if not email:
            raise ValueError("Google account has no email")
        if not info.get("email_verified"):
            raise ValueError("Google email not verified")

        google_id = info["sub"]
        full_name = info.get("name")
        picture = info.get("picture")

        user = db.query(User).filter(User.google_id == google_id).first()
        if not user:
            user = self.get_user_by_email(db, email)

        if user:
            updated = False
            if not user.google_id:
                user.google_id = google_id
                updated = True
            if user.auth_provider != "google":
                user.auth_provider = "google" if not user.password_hash else "hybrid"
                updated = True
            if not user.profile_image_url and picture:
                user.profile_image_url = picture
                updated = True
            if not user.email_verified:
                user.email_verified = True
                updated = True
            user.last_login = datetime.utcnow()
            if updated:
                db.commit()
                db.refresh(user)
            return user

        user = User(
            email=email,
            password_hash=None,
            full_name=full_name,
            google_id=google_id,
            auth_provider="google",
            email_verified=True,
            profile_image_url=picture,
            last_login=datetime.utcnow(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def generate_tokens(self, user_id: str) -> Dict[str, str]:
        return {
            "access_token": create_access_token(user_id),
            "refresh_token": create_refresh_token(user_id),
            "token_type": "bearer",
        }

    def refresh_access_token(self, refresh_token: str) -> Optional[str]:
        """Legacy non-rotating refresh (no revocation check). Prefer
        rotate_refresh_token, which is what the /refresh route now uses."""
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            return None
        user_id = payload.get("sub")
        if not user_id:
            return None
        return create_access_token(user_id)

    # ── token revocation / rotation (Stage 3) ────────────────────────────────

    def is_token_revoked(self, db: Session, jti: Optional[str]) -> bool:
        if not jti:
            return False
        from models import RevokedToken
        return db.query(RevokedToken).filter(RevokedToken.jti == jti).first() is not None

    def revoke_jti(self, db: Session, jti: Optional[str], user_id=None, expires_at=None) -> None:
        if not jti:
            return
        from models import RevokedToken
        try:
            if db.query(RevokedToken).filter(RevokedToken.jti == jti).first():
                return
            uid = None
            if user_id:
                try:
                    uid = uuid.UUID(str(user_id))
                except (ValueError, TypeError):
                    uid = None
            db.add(RevokedToken(
                jti=jti,
                user_id=uid,
                expires_at=expires_at or (datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)),
            ))
            db.commit()
        except Exception:
            db.rollback()

    def revoke_refresh_token(self, db: Session, refresh_token: str) -> None:
        """Revoke a refresh token (used on logout)."""
        payload = decode_token(refresh_token)
        if payload and payload.get("type") == "refresh":
            self.revoke_jti(db, payload.get("jti"), payload.get("sub"), _exp_dt(payload))

    def rotate_refresh_token(self, db: Session, refresh_token: str) -> Optional[Dict]:
        """Validate a refresh token, revoke its jti (one-time use), and mint a
        fresh access+refresh pair. Returns None if invalid/expired/revoked —
        which, after a token is reused, also blocks replay of a stolen token."""
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            return None
        user_id = payload.get("sub")
        jti = payload.get("jti")
        if not user_id or self.is_token_revoked(db, jti):
            return None
        self.revoke_jti(db, jti, user_id, _exp_dt(payload))
        return {
            "access_token": create_access_token(user_id),
            "refresh_token": create_refresh_token(user_id),
            "user_id": user_id,
        }

    # ── password reset (Stage 3) ─────────────────────────────────────────────

    def consume_password_reset_token(self, db: Session, token: str) -> Optional[str]:
        """Validate a one-time reset token and burn it (revoke jti). Returns the
        user_id or None."""
        payload = decode_token(token)
        if not payload or payload.get("type") != "reset":
            return None
        jti = payload.get("jti")
        if self.is_token_revoked(db, jti):
            return None
        self.revoke_jti(db, jti, payload.get("sub"), _exp_dt(payload))
        return payload.get("sub")

    def set_password(self, db: Session, user: User, new_password: str) -> None:
        user.password_hash = hash_password(new_password)
        db.commit()

    def get_current_user_id(self, token: str) -> Optional[str]:
        payload = decode_token(token)
        if not payload or payload.get("type") != "access":
            return None
        return payload.get("sub")


auth_service = AuthService()
