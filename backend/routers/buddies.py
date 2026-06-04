"""Study-buddy endpoints (Phase 2)."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user
from services.buddy_service import buddy_service as svc

router = APIRouter(prefix="/api/buddies", tags=["study-buddies"])


class RequestBody(BaseModel):
    user_id: str


class RespondBody(BaseModel):
    connection_id: str
    accept: bool


@router.get("/")
def list_buddies(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.list_for_user(db, current_user.id)


@router.get("/search")
def search(
    q: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"results": svc.search_users(db, current_user.id, q)}


@router.post("/request")
def send_request(
    body: RequestBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return svc.send_request(db, current_user.id, body.user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/respond")
def respond(
    body: RespondBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return svc.respond(db, current_user.id, body.connection_id, body.accept)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{connection_id}")
def remove(
    connection_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return svc.remove(db, current_user.id, connection_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
