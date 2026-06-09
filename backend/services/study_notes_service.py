"""
Study Notes AI generation (NEW-PACKET-D).

The spec calls for NotebookLM, but there is no public NotebookLM REST API — and
this codebase already has Claude wired (same pattern as SummaryService). So we
generate notes with Claude in five styles. Notes are keyed by youtube_id and
each style is generated lazily on first request, then cached on its own row.
"""

import json
import logging
import re
from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from config import settings
from models import StudyNote, NoteStyle, NoteFlashcard

logger = logging.getLogger(__name__)

STYLES = ["standard", "simple", "technical", "bullet_points", "mindmap"]

_STYLE_PROMPTS = {
    "standard": (
        "Create a clear, well-structured study guide from this content. Use Markdown "
        "with sections like Key Concepts, Explanations, Examples, and Vocabulary."
    ),
    "simple": (
        "Create a simple, easy-to-understand study guide. Explain everything as if "
        "teaching a 12-year-old: simple words, short sentences, lots of examples, no "
        "jargon. Format as Markdown with clear sections."
    ),
    "technical": (
        "Create comprehensive, detailed study notes for an advanced learner. Include "
        "detailed explanations, proper terminology, real-world applications, "
        "relationships between concepts, and common misconceptions. Markdown with a "
        "clear hierarchy."
    ),
    "bullet_points": (
        "Convert this content into a quick-scan bullet-point outline. Use nested "
        "Markdown bullets under short headers. Keep it concise and scannable."
    ),
    "mindmap": (
        "Create a hierarchical mind-map outline of this content using indented "
        "tree branches (├─, │, └─) under a central topic. Keep it visual."
    ),
}


def _word_count(text: str) -> int:
    return len(text.split()) if text else 0


class StudyNotesService:
    def __init__(self):
        self.api_key = settings.CLAUDE_API_KEY
        self.model = "claude-sonnet-4-6"

    # ── transcript ────────────────────────────────────────────────────────────

    def _get_transcript(self, youtube_id: str) -> Optional[str]:
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            # 1.x API: instantiate, then fetch() — class-method get_transcript() was removed
            ytt = YouTubeTranscriptApi()
            transcript = ytt.fetch(youtube_id, languages=["en", "en-US"])
            return " ".join(e.text for e in transcript)
        except Exception:
            # Retry with any available language via list()
            try:
                from youtube_transcript_api import YouTubeTranscriptApi
                ytt = YouTubeTranscriptApi()
                tl = ytt.list(youtube_id)
                for t in tl:
                    data = t.fetch()
                    return " ".join(e.text for e in data)
            except Exception as e:
                logger.warning(f"Transcript fetch failed for {youtube_id}: {e}")
            return None

    async def _call_claude(self, prompt: str, max_tokens: int = 1800) -> Optional[str]:
        if not self.api_key:
            return None
        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=self.api_key)
            message = await client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
            return message.content[0].text
        except Exception as e:
            logger.error(f"Claude notes generation failed: {e}")
            return None

    # ── note record ─────────────────────────────────────────────────────────--

    def get_or_create_note(
        self, db: Session, youtube_id: str, title: str = "", user_id=None
    ) -> StudyNote:
        note = db.query(StudyNote).filter(StudyNote.youtube_id == youtube_id).first()
        if note:
            return note

        transcript = self._get_transcript(youtube_id)
        if not transcript:
            raise ValueError("No transcript available for this video")

        wc = _word_count(transcript)
        note = StudyNote(
            youtube_id=youtube_id,
            source_title=title or youtube_id,
            transcript_preview=transcript[:500],
            word_count=wc,
            estimated_read_time_minutes=max(1, wc // 200),
            generated_by_user_id=user_id,
        )
        db.add(note)
        db.commit()
        db.refresh(note)
        return note

    # ── styles ────────────────────────────────────────────────────────────────

    async def get_or_generate_style(
        self, db: Session, note: StudyNote, style: str
    ) -> dict:
        if style not in STYLES:
            raise ValueError(f"Unknown style: {style}")

        existing = (
            db.query(NoteStyle)
            .filter(NoteStyle.study_note_id == note.id, NoteStyle.style_name == style)
            .first()
        )
        if existing:
            return self._style_dict(note, existing)

        transcript = self._get_transcript(note.youtube_id)
        if not transcript:
            raise ValueError("No transcript available for this video")

        instruction = _STYLE_PROMPTS[style]
        from services.prompt_safety import wrap_untrusted
        prompt = (
            f"{instruction}\n\nTitle: {note.source_title}\n\n"
            f"Content:\n{wrap_untrusted(transcript, max_chars=6000)}\n\nReturn only the Markdown notes."
        )
        content = await self._call_claude(prompt)
        if not content:
            raise ValueError("Notes generation failed (Claude unavailable)")

        row = NoteStyle(
            study_note_id=note.id,
            style_name=style,
            content=content,
            word_count=_word_count(content),
            generated_by="claude",
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return self._style_dict(note, row)

    def _style_dict(self, note: StudyNote, row: NoteStyle) -> dict:
        return {
            "note_id": str(note.id),
            "youtube_id": note.youtube_id,
            "title": note.source_title,
            "style": row.style_name,
            "content": row.content,
            "word_count": row.word_count,
            "read_time_minutes": max(1, (row.word_count or 0) // 200),
        }

    def list_notes(self, db: Session, limit: int = 100) -> List[dict]:
        notes = (
            db.query(StudyNote).order_by(StudyNote.created_at.desc()).limit(limit).all()
        )
        out = []
        for n in notes:
            styles = [
                s.style_name
                for s in db.query(NoteStyle).filter(NoteStyle.study_note_id == n.id).all()
            ]
            out.append({
                "note_id": str(n.id),
                "youtube_id": n.youtube_id,
                "title": n.source_title,
                "word_count": n.word_count,
                "read_time_minutes": n.estimated_read_time_minutes,
                "available_styles": styles,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            })
        return out

    # ── flashcards ──────────────────────────────────────────────────────────--

    async def get_or_generate_flashcards(self, db: Session, note: StudyNote) -> List[dict]:
        existing = (
            db.query(NoteFlashcard).filter(NoteFlashcard.study_note_id == note.id).all()
        )
        if existing:
            return [self._card_dict(c) for c in existing]

        # Use the standard style as the basis (generate it if needed).
        standard = await self.get_or_generate_style(db, note, "standard")
        prompt = (
            "Extract the 10-15 most important concepts as flashcards. Return JSON: "
            '{"flashcards":[{"front":"...","back":"...","concept":"..."}]}\n\n'
            f"Content:\n{standard['content'][:4000]}\n\nReturn only the JSON."
        )
        text = await self._call_claude(prompt, max_tokens=1500)
        if not text:
            return []

        cards: List[dict] = []
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group())
                for c in data.get("flashcards", []):
                    front = (c.get("front") or "").strip()
                    back = (c.get("back") or "").strip()
                    if not front or not back:
                        continue
                    row = NoteFlashcard(
                        study_note_id=note.id,
                        front_text=front,
                        back_text=back,
                        source_concept=c.get("concept", ""),
                    )
                    db.add(row)
                    cards.append(row)
                db.commit()
            except json.JSONDecodeError:
                return []
        return [self._card_dict(c) for c in cards]

    def _card_dict(self, c: NoteFlashcard) -> dict:
        return {
            "id": str(c.id),
            "front": c.front_text,
            "back": c.back_text,
            "concept": c.source_concept,
        }

    def add_flashcards_to_review(self, db: Session, user_id, note: StudyNote) -> int:
        """
        Create FSRS review cards (source_type='flashcard') from this note's
        flashcards so they resurface in the Packet-C spaced-repetition review.
        Idempotent: skips flashcards the user already has a card for.
        """
        from models import FSRSCard

        flashcards = (
            db.query(NoteFlashcard).filter(NoteFlashcard.study_note_id == note.id).all()
        )
        if not flashcards:
            return 0

        existing = {
            str(r.source_id)
            for r in db.query(FSRSCard).filter(
                FSRSCard.user_id == user_id, FSRSCard.source_type == "flashcard"
            ).all()
        }

        now = datetime.utcnow()
        added = 0
        for fc in flashcards:
            if str(fc.id) in existing:
                continue
            db.add(FSRSCard(
                user_id=user_id,
                source_type="flashcard",
                source_id=fc.id,
                state="new",
                due_date=now,
                difficulty=5.0,
                stability=1.0,
            ))
            added += 1
        db.commit()
        return added


study_notes_service = StudyNotesService()
