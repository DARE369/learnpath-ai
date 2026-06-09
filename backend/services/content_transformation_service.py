"""
User Note Upload + Transformation (NEW-PACKET-E).

Extracts text from uploaded documents/URLs and produces four transformations
via Claude (+ reused YouTube search): AI explanation, flashcards, a YouTube
match list, and an exam-style quiz.

Heavy/native OCR (Tesseract + poppler) is NOT a hard dependency — text-based
PDF (pypdf), Word (python-docx), plain text, and URLs (BeautifulSoup) work
everywhere; image / scanned-PDF OCR degrades gracefully with a clear message
when the binaries/libraries are absent. All third-party parsers are imported
lazily so the module imports cleanly even where they are not installed.
"""

import io
import json
import logging
import re
from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from config import settings
from models import UserUpload, ContentTransformation, UploadFlashcard

logger = logging.getLogger(__name__)

TRANSFORM_TYPES = ["ai_explanation", "flashcards", "youtube_match", "quiz"]
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB

_SUBJECT_KEYWORDS = {
    "ielts": ["ielts", "listening", "band", "speaking"],
    "sat": ["sat", "evidence", "reading comprehension"],
    "python": ["python", "def ", "import ", "__main__"],
    "chemistry": ["atom", "molecule", "reaction", "compound"],
    "biology": ["cell", "dna", "organism", "photosynthesis"],
    "math": ["equation", "algebra", "calculus", "derivative", "integral"],
    "english": ["grammar", "literature", "essay", "vocabulary"],
}


def _word_count(text: str) -> int:
    return len(text.split()) if text else 0


class ContentTransformationService:
    def __init__(self):
        self.api_key = settings.CLAUDE_API_KEY
        self.model = "claude-sonnet-4-6"

    # ── file type ───────────────────────────────────────────────────────────--

    @staticmethod
    def detect_file_type(filename: str) -> str:
        ext = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
        if ext == "pdf":
            return "pdf"
        if ext in ("jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp"):
            return "image"
        if ext in ("doc", "docx"):
            return "docx"
        if ext in ("txt", "md", "text"):
            return "txt"
        return "unknown"

    @staticmethod
    def _detect_subject(text: str) -> str:
        low = text.lower()
        for subject, kws in _SUBJECT_KEYWORDS.items():
            if sum(low.count(kw) for kw in kws) > 5:
                return subject
        return "general"

    # ── extraction ────────────────────────────────────────────────────────────

    def _extract_text(self, file_type: str, data: bytes, filename: str) -> str:
        if file_type == "txt":
            return data.decode("utf-8", errors="ignore")

        if file_type == "pdf":
            try:
                import pypdf
                reader = pypdf.PdfReader(io.BytesIO(data))
                parts = [(p.extract_text() or "") for p in reader.pages]
                text = "\n".join(p for p in parts if p.strip())
            except Exception as e:
                raise ValueError(f"Could not read PDF: {e}")
            if len(text.strip()) >= 30:
                return text
            # Looks like a scanned PDF — fall back to OCR if available.
            ocr = self._ocr_pdf(data)
            if ocr and len(ocr.strip()) >= 30:
                return ocr
            raise ValueError(
                "No selectable text found and OCR could not read this PDF. "
                "Try a text-based PDF, a Word doc, or paste the text."
            )

        if file_type == "docx":
            try:
                import docx
                document = docx.Document(io.BytesIO(data))
                return "\n".join(p.text for p in document.paragraphs if p.text.strip())
            except Exception as e:
                raise ValueError(f"Could not read Word document: {e}")

        if file_type == "image":
            try:
                import pytesseract
                from PIL import Image
            except Exception:
                raise ValueError(
                    "Image OCR is not available on this server. Upload a PDF, Word "
                    "doc, or text file instead."
                )
            try:
                return pytesseract.image_to_string(Image.open(io.BytesIO(data)))
            except Exception as e:
                raise ValueError(f"OCR failed: {e}")

        raise ValueError(f"Unsupported file type: {file_type}")

    def _ocr_pdf(self, data: bytes) -> Optional[str]:
        """OCR a scanned PDF via pdf2image + pytesseract. None if unavailable."""
        try:
            import pytesseract
            from pdf2image import convert_from_bytes
        except Exception:
            return None
        try:
            pages = convert_from_bytes(data, dpi=200)
            return "\n".join(pytesseract.image_to_string(p) for p in pages)
        except Exception as e:
            logger.warning(f"PDF OCR failed: {e}")
            return None

    def _extract_from_url(self, url: str) -> tuple:
        """Return (title, text) for a web URL."""
        try:
            import httpx
            from bs4 import BeautifulSoup
            with httpx.Client(follow_redirects=True, timeout=15.0) as client:
                resp = client.get(url, headers={"User-Agent": "Mozilla/5.0 LearnPath"})
                resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                tag.decompose()
            title = (soup.title.string.strip() if soup.title and soup.title.string else url)
            text = re.sub(r"\n{3,}", "\n\n", soup.get_text(separator="\n")).strip()
            return title, text
        except Exception as e:
            raise ValueError(f"Could not fetch URL: {e}")

    # ── create uploads ──────────────────────────────────────────────────────--

    def create_file_upload(
        self, db: Session, user_id, filename: str, data: bytes
    ) -> UserUpload:
        if len(data) > MAX_UPLOAD_BYTES:
            raise ValueError("File too large (max 50MB)")
        file_type = self.detect_file_type(filename)
        text = self._extract_text(file_type, data, filename)  # raises ValueError on failure

        upload = UserUpload(
            user_id=user_id,
            original_filename=filename,
            file_type=file_type,
            file_size_bytes=len(data),
            source_title=filename,
            extraction_status="complete",
            extracted_text=text,
            detected_subject=self._detect_subject(text),
        )
        db.add(upload)
        db.commit()
        db.refresh(upload)
        return upload

    def create_url_upload(self, db: Session, user_id, url: str) -> UserUpload:
        title, text = self._extract_from_url(url)
        if len(text.strip()) < 30:
            raise ValueError("That URL did not yield readable text.")
        upload = UserUpload(
            user_id=user_id,
            original_filename=title,
            file_type="url",
            source_url=url,
            source_title=title,
            file_size_bytes=len(text.encode()),
            extraction_status="complete",
            extracted_text=text,
            detected_subject=self._detect_subject(text),
        )
        db.add(upload)
        db.commit()
        db.refresh(upload)
        return upload

    # ── Claude ────────────────────────────────────────────────────────────────

    async def _call_claude(self, prompt: str, max_tokens: int = 1800) -> Optional[str]:
        if not self.api_key:
            return None
        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=self.api_key)
            msg = await client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
            return msg.content[0].text
        except Exception as e:
            logger.error(f"Claude call failed: {e}")
            return None

    @staticmethod
    def _extract_json(text: str, array: bool = False):
        if not text:
            return None
        pattern = r"\[.*\]" if array else r"\{.*\}"
        m = re.search(pattern, text, re.DOTALL)
        if not m:
            return None
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            return None

    # ── transformations (lazy + cached) ─────────────────────────────────────--

    async def get_or_generate(self, db: Session, upload: UserUpload, ttype: str) -> dict:
        if ttype not in TRANSFORM_TYPES:
            raise ValueError(f"Unknown transformation: {ttype}")

        existing = (
            db.query(ContentTransformation)
            .filter(
                ContentTransformation.upload_id == upload.id,
                ContentTransformation.transform_type == ttype,
            )
            .first()
        )
        if existing:
            return self._transform_dict(existing)

        raw_text = (upload.extracted_text or "")
        if not raw_text.strip():
            raise ValueError("No extracted text to transform")
        # Wrap the uploaded content as untrusted DATA so a malicious document can't
        # hijack the prompt (Stage 7). Downstream _gen_* embed this guarded block.
        from services.prompt_safety import wrap_untrusted
        text = wrap_untrusted(raw_text, max_chars=6000)

        if ttype == "ai_explanation":
            content, fmt, count = await self._gen_explanation(text), "markdown", 0
        elif ttype == "flashcards":
            content, fmt, count = await self._gen_flashcards(text)
        elif ttype == "quiz":
            content, fmt, count = await self._gen_quiz(text, upload.detected_subject or "general")
        else:  # youtube_match
            content, fmt, count = await self._gen_youtube(text)

        if content is None:
            raise ValueError("Generation failed (Claude unavailable)")

        row = ContentTransformation(
            upload_id=upload.id,
            transform_type=ttype,
            result_content=content,
            result_format=fmt,
            item_count=count,
        )
        db.add(row)

        # Persist individual flashcard rows so they can be enrolled in FSRS review.
        if ttype == "flashcards":
            try:
                cards = (json.loads(content) or {}).get("flashcards", [])
            except (json.JSONDecodeError, TypeError):
                cards = []
            for c in cards:
                db.add(UploadFlashcard(
                    upload_id=upload.id,
                    front_text=c.get("front", ""),
                    back_text=c.get("back", ""),
                    source_concept=c.get("concept", ""),
                ))

        db.commit()
        db.refresh(row)
        return self._transform_dict(row)

    def add_flashcards_to_review(self, db: Session, user_id, upload: UserUpload) -> int:
        """
        Enroll this upload's flashcards in the Packet-C FSRS review deck.
        Idempotent: skips flashcards the user already has a card for.
        """
        from models import FSRSCard

        flashcards = (
            db.query(UploadFlashcard).filter(UploadFlashcard.upload_id == upload.id).all()
        )
        if not flashcards:
            return 0

        existing = {
            str(r.source_id)
            for r in db.query(FSRSCard).filter(
                FSRSCard.user_id == user_id, FSRSCard.source_type == "upload_flashcard"
            ).all()
        }

        now = datetime.utcnow()
        added = 0
        for fc in flashcards:
            if str(fc.id) in existing:
                continue
            db.add(FSRSCard(
                user_id=user_id,
                source_type="upload_flashcard",
                source_id=fc.id,
                state="new",
                due_date=now,
                difficulty=5.0,
                stability=1.0,
            ))
            added += 1
        db.commit()
        return added

    def _transform_dict(self, row: ContentTransformation) -> dict:
        out = {
            "type": row.transform_type,
            "format": row.result_format,
            "item_count": row.item_count,
        }
        if row.result_format == "json":
            try:
                out["data"] = json.loads(row.result_content)
            except (json.JSONDecodeError, TypeError):
                out["data"] = None
        else:
            out["content"] = row.result_content
        return out

    async def _gen_explanation(self, text: str) -> Optional[str]:
        prompt = (
            "Rewrite these notes to be clearer and easier to understand: simpler "
            "vocabulary, shorter sentences, helpful examples, clear Markdown structure. "
            "Keep all important information.\n\nNotes:\n" + text + "\n\nReturn only the Markdown."
        )
        return await self._call_claude(prompt)

    async def _gen_flashcards(self, text: str):
        prompt = (
            "Extract 15-20 key concepts as flashcards. Return JSON: "
            '{"flashcards":[{"front":"Q?","back":"A.","concept":"name"}]}\n\n'
            "Notes:\n" + text + "\n\nReturn only the JSON."
        )
        data = self._extract_json(await self._call_claude(prompt))
        cards = (data or {}).get("flashcards", []) if isinstance(data, dict) else []
        cards = [c for c in cards if c.get("front") and c.get("back")]
        return json.dumps({"flashcards": cards}), "json", len(cards)

    async def _gen_quiz(self, text: str, subject: str):
        style = (
            "IELTS-style" if "ielts" in subject else
            "SAT-style" if "sat" in subject else "multiple-choice"
        )
        prompt = (
            f"Create 10 {style} practice questions from these notes. Return JSON: "
            '{"questions":[{"question":"...","options":["A","B","C","D"],'
            '"correct_answer":"A","explanation":"..."}]}\n\nNotes:\n'
            + text + "\n\nReturn only the JSON."
        )
        data = self._extract_json(await self._call_claude(prompt, max_tokens=2200))
        qs = (data or {}).get("questions", []) if isinstance(data, dict) else []
        return json.dumps({"questions": qs, "style": style}), "json", len(qs)

    async def _gen_youtube(self, text: str):
        concepts = await self._extract_concepts(text)
        matches: List[dict] = []
        try:
            from services.youtube_service import youtube_service
            if settings.YOUTUBE_API_KEY:
                for concept in concepts[:5]:
                    try:
                        vids = await youtube_service.search_videos(f"{concept} tutorial", max_results=3)
                    except Exception:
                        vids = []
                    for v in vids[:3]:
                        matches.append({
                            "concept": concept,
                            "youtube_id": v.get("youtube_id"),
                            "title": v.get("title"),
                            "channel": v.get("channel_name"),
                            "thumbnail": v.get("thumbnail_url"),
                        })
        except Exception as e:
            logger.warning(f"YouTube matching unavailable: {e}")
        return json.dumps({"videos": matches, "concepts": concepts}), "json", len(matches)

    async def _extract_concepts(self, text: str) -> List[str]:
        prompt = (
            "Extract 5-10 key concepts/topics from this text. Return a JSON array of "
            'strings, e.g. ["concept1","concept2"].\n\nText:\n' + text[:2000]
        )
        data = self._extract_json(await self._call_claude(prompt, max_tokens=400), array=True)
        return [str(c) for c in data][:10] if isinstance(data, list) else []

    # ── listing ─────────────────────────────────────────────────────────────--

    def list_uploads(self, db: Session, user_id, limit: int = 100) -> List[dict]:
        rows = (
            db.query(UserUpload)
            .filter(UserUpload.user_id == user_id)
            .order_by(UserUpload.created_at.desc())
            .limit(limit)
            .all()
        )
        return [{
            "id": str(u.id),
            "title": u.source_title or u.original_filename,
            "file_type": u.file_type,
            "detected_subject": u.detected_subject,
            "status": u.extraction_status,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        } for u in rows]


content_transformation_service = ContentTransformationService()
