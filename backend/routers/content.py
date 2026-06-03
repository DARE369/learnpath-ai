"""User Note Upload + Transformation endpoints (NEW-PACKET-E)."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, UserUpload, ContentTransformation
from routers.auth import get_current_user
from services.content_transformation_service import (
    content_transformation_service as svc,
    TRANSFORM_TYPES,
)

router = APIRouter(prefix="/api/content", tags=["content-upload"])


class UrlBody(BaseModel):
    url: str


def _upload_summary(u: UserUpload, db: Session) -> dict:
    done = [
        t.transform_type
        for t in db.query(ContentTransformation).filter(ContentTransformation.upload_id == u.id).all()
    ]
    return {
        "id": str(u.id),
        "title": u.source_title or u.original_filename,
        "file_type": u.file_type,
        "detected_subject": u.detected_subject,
        "status": u.extraction_status,
        "source_url": u.source_url,
        "transformations_ready": done,
        "all_transformations": TRANSFORM_TYPES,
    }


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a document (pdf/docx/txt/image) for transformation."""
    data = await file.read()
    try:
        upload = svc.create_file_upload(db, current_user.id, file.filename or "upload", data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {"content_id": str(upload.id), "status": upload.extraction_status,
            "detected_subject": upload.detected_subject}


@router.post("/upload-url")
def upload_url(
    body: UrlBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Ingest a web URL for transformation."""
    try:
        upload = svc.create_url_upload(db, current_user.id, body.url)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {"content_id": str(upload.id), "status": upload.extraction_status,
            "detected_subject": upload.detected_subject}


@router.get("/")
def list_content(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List the current user's uploads."""
    return {"uploads": svc.list_uploads(db, current_user.id)}


def _require_owned_upload(content_id: str, current_user: User, db: Session) -> UserUpload:
    upload = db.query(UserUpload).filter(UserUpload.id == content_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    if str(upload.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your upload")
    return upload


@router.get("/{content_id}")
def get_content(
    content_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload metadata + which transformations have been generated."""
    upload = _require_owned_upload(content_id, current_user, db)
    return _upload_summary(upload, db)


@router.get("/{content_id}/transform/{ttype}")
async def get_transformation(
    content_id: str,
    ttype: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get (or lazily generate + cache) one transformation for an upload."""
    if ttype not in TRANSFORM_TYPES:
        raise HTTPException(status_code=400, detail=f"Valid types: {TRANSFORM_TYPES}")
    upload = _require_owned_upload(content_id, current_user, db)
    try:
        return await svc.get_or_generate(db, upload, ttype)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{content_id}/flashcards/add-to-review")
async def add_flashcards_to_review(
    content_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Enroll this upload's flashcards in the spaced-repetition review deck (Packet C)."""
    upload = _require_owned_upload(content_id, current_user, db)
    try:
        # Ensure the flashcards transform (and its rows) exist first.
        await svc.get_or_generate(db, upload, "flashcards")
        added = svc.add_flashcards_to_review(db, current_user.id, upload)
        return {"added": added}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
