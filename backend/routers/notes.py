"""Study Notes endpoints (NEW-PACKET-D)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import User, StudyNote
from routers.auth import get_current_user
from services.study_notes_service import study_notes_service, STYLES

router = APIRouter(prefix="/api/notes", tags=["study-notes"])


@router.get("/")
def list_notes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List generated study notes (library)."""
    return {"notes": study_notes_service.list_notes(db)}


@router.get("/{youtube_id}")
async def get_or_generate_notes(
    youtube_id: str,
    style: str = "standard",
    title: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get study notes for a video in a given style. The note record and the
    requested style are generated (via Claude) on first request, then cached.
    """
    if style not in STYLES:
        raise HTTPException(status_code=400, detail=f"Unknown style. Valid: {STYLES}")
    try:
        note = study_notes_service.get_or_create_note(db, youtube_id, title, current_user.id)
        data = await study_notes_service.get_or_generate_style(db, note, style)
        data["all_styles"] = STYLES
        return data
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{youtube_id}/flashcards")
async def get_note_flashcards(
    youtube_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get (or generate) flashcards extracted from a video's notes."""
    note = db.query(StudyNote).filter(StudyNote.youtube_id == youtube_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Generate notes first")
    try:
        cards = await study_notes_service.get_or_generate_flashcards(db, note)
        return {"youtube_id": youtube_id, "flashcard_count": len(cards), "flashcards": cards}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{youtube_id}/flashcards/add-to-review")
async def add_flashcards_to_review(
    youtube_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add this note's flashcards to the spaced-repetition review deck (Packet C)."""
    note = db.query(StudyNote).filter(StudyNote.youtube_id == youtube_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Generate notes first")
    try:
        cards = await study_notes_service.get_or_generate_flashcards(db, note)
        added = study_notes_service.add_flashcards_to_review(db, current_user.id, note)
        return {"added": added, "total": len(cards)}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
