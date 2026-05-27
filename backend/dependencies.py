from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db


def get_current_user(db: Session = Depends(get_db)):
    """
    Placeholder for JWT authentication dependency.
    Implemented in Stage 2.

    Usage:
        @router.get("/profile")
        async def get_profile(user = Depends(get_current_user)):
            ...
    """
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication not yet implemented (Stage 2)",
        headers={"WWW-Authenticate": "Bearer"},
    )
