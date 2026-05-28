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

    def create_user(
        self,
        db: Session,
        email: str,
        password: str,
        full_name: Optional[str] = None,
    ) -> User:
        errors = _validate_password(password)
        if errors:
            raise ValueError(f"Password must contain: {', '.join(errors)}")
        if self.get_user_by_email(db, email):
            raise ValueError("Email already registered")

        user = User(
            email=email.lower().strip(),
            password_hash=hash_password(password),
            full_name=full_name,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def authenticate_user(self, db: Session, email: str, password: str) -> Optional[User]:
        user = self.get_user_by_email(db, email)
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user

    def generate_tokens(self, user_id: str) -> Dict[str, str]:
        return {
            "access_token": create_access_token(user_id),
            "refresh_token": create_refresh_token(user_id),
            "token_type": "bearer",
        }

    def refresh_access_token(self, refresh_token: str) -> Optional[str]:
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            return None
        user_id = payload.get("sub")
        if not user_id:
            return None
        return create_access_token(user_id)

    def get_current_user_id(self, token: str) -> Optional[str]:
        payload = decode_token(token)
        if not payload or payload.get("type") != "access":
            return None
        return payload.get("sub")


auth_service = AuthService()
