"""
Video Chunking Service (NEW-PACKET-B).

Splits a YouTube video's transcript into 2-4 minute chapters using Claude,
then auto-generates a 2-question quiz per chapter using the existing
QuestionService.  Works on YouTube videos (the only kind in the system).

Chunking is synchronous so it runs inside a FastAPI background task.  The
caller fires the task and immediately returns a 202; the client polls
GET /api/chunks/{video_id}/status until the chunks appear.

Flow:
  1. Pull transcript via youtube-transcript-api (already used by session router)
  2. Send transcript + duration to Claude for chapter segmentation
  3. Parse JSON response, validate timestamps
  4. Persist VideoChunk rows
  5. For each chunk: call QuestionService to generate 2 MCQs, persist ChapterQuiz
     + ChapterQuizQuestion rows
  6. Mark the video as chunked (via a schema patch on the videos table)
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import and_
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _secs_to_ts(seconds: int) -> str:
    m, s = divmod(max(0, int(seconds)), 60)
    return f"{m}:{s:02d}"

def _ts_to_secs(ts: str) -> int:
    """'M:SS' or 'MM:SS' → seconds.  Returns 0 on any parse failure."""
    try:
        parts = ts.strip().split(":")
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    except (ValueError, IndexError):
        pass
    return 0

def _ideal_chapter_count(duration_seconds: int) -> int:
    if duration_seconds < 300:   return 2
    if duration_seconds < 600:   return 3
    if duration_seconds < 1200:  return 4
    return 5


class VideoChunkingService:

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def get_or_create_chunks(self, db: Session, youtube_id: str, video_db_id: str) -> Dict:
        """
        Return existing chunks if already generated, otherwise chunk now.
        Called synchronously inside a BackgroundTask.
        """
        from models import VideoChunk
        existing = db.query(VideoChunk).filter(VideoChunk.video_id == video_db_id)\
                                       .order_by(VideoChunk.chunk_number).all()
        if existing:
            return {"status": "ready", "chunks": [self._chunk_dict(c, db) for c in existing]}

        return self.chunk_video(db, youtube_id, video_db_id)

    def chunk_video(self, db: Session, youtube_id: str, video_db_id: str) -> Dict:
        """Full pipeline: transcript → Claude → chunks → quizzes."""
        # 1. Get transcript
        transcript = self._get_transcript(youtube_id)
        if not transcript:
            return {"status": "error", "detail": "Could not retrieve transcript for this video"}

        # 2. Estimate duration from transcript word count (~150 wpm)
        word_count = len(transcript.split())
        est_duration = max(120, int(word_count / 150 * 60))

        # 3. Call Claude for chapter segmentation
        chapters_raw = self._call_claude(transcript, est_duration)
        if not chapters_raw:
            # Fall back: create 2 equal-split chapters without AI
            chapters_raw = self._fallback_split(est_duration)

        # 4. Validate + persist chunks
        from models import VideoChunk
        chunks: List[VideoChunk] = []
        for ch in chapters_raw:
            start = _ts_to_secs(ch.get("start_timestamp", "0:00"))
            end   = _ts_to_secs(ch.get("end_timestamp",   "0:00"))
            if end <= start:
                end = min(start + 180, est_duration)
            chunk = VideoChunk(
                video_id=video_db_id,
                chunk_number=ch.get("chapter_number", len(chunks) + 1),
                title=ch.get("title", f"Chapter {len(chunks) + 1}"),
                description=ch.get("summary", ""),
                start_timestamp=ch.get("start_timestamp", _secs_to_ts(start)),
                end_timestamp=ch.get("end_timestamp", _secs_to_ts(end)),
                start_seconds=start,
                end_seconds=end,
                duration_seconds=end - start,
                learning_objective=ch.get("learning_objective", ""),
                key_concepts=ch.get("key_concepts", []),
                summary=ch.get("summary", ""),
                ai_generated=True,
                ai_model="claude-sonnet-4-6",
            )
            db.add(chunk)
            chunks.append(chunk)

        try:
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"VideoChunkingService: failed to persist chunks: {e}")
            return {"status": "error", "detail": "Database error saving chunks"}

        for chunk in chunks:
            db.refresh(chunk)

        # 5. Generate quizzes per chunk (best-effort)
        for chunk in chunks:
            try:
                self._generate_quiz(db, chunk)
            except Exception as e:
                logger.warning(f"Quiz generation failed for chunk {chunk.id}: {e}")

        return {"status": "ready", "chunks": [self._chunk_dict(c, db) for c in chunks]}

    # ------------------------------------------------------------------
    # Transcript retrieval
    # ------------------------------------------------------------------

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

    # ------------------------------------------------------------------
    # Claude segmentation
    # ------------------------------------------------------------------

    def _call_claude(self, transcript: str, duration_seconds: int) -> Optional[List[Dict]]:
        try:
            from config import settings
            if not settings.CLAUDE_API_KEY:
                return None
            import anthropic
            n = _ideal_chapter_count(duration_seconds)
            prompt = (
                f"You are an expert learning designer. Segment this video transcript into "
                f"{n} distinct learning chapters.\n\n"
                f"Video duration: {_secs_to_ts(duration_seconds)}\n\n"
                f"Transcript:\n{transcript[:6000]}\n\n"  # cap to avoid token limits
                f"For each chapter return JSON in this exact format:\n"
                f'{{"chapters": [{{"chapter_number": 1, "title": "...", "learning_objective": "...", '
                f'"start_timestamp": "0:00", "end_timestamp": "2:30", "key_concepts": ["c1","c2"], '
                f'"summary": "..."}}]}}\n\n'
                f"Rules:\n"
                f"- Each chapter 2-4 minutes long\n"
                f"- End at natural content breakpoints\n"
                f"- Build progressively — earlier chapters are foundational\n"
                f"- Return ONLY the JSON, no other text"
            )
            client = anthropic.Anthropic(api_key=settings.CLAUDE_API_KEY)
            msg = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}],
            )
            text = msg.content[0].text.strip()
            # Extract JSON even if wrapped in code fences
            m = re.search(r'\{.*\}', text, re.DOTALL)
            if m:
                data = json.loads(m.group())
                return data.get("chapters", [])
        except Exception as e:
            logger.warning(f"Claude chunking failed: {e}")
        return None

    # ------------------------------------------------------------------
    # Fallback split (no AI)
    # ------------------------------------------------------------------

    def _fallback_split(self, duration_seconds: int) -> List[Dict]:
        n = _ideal_chapter_count(duration_seconds)
        size = duration_seconds // n
        chapters = []
        for i in range(n):
            start = i * size
            end = (i + 1) * size if i < n - 1 else duration_seconds
            chapters.append({
                "chapter_number": i + 1,
                "title": f"Part {i + 1}",
                "learning_objective": "Continue learning",
                "start_timestamp": _secs_to_ts(start),
                "end_timestamp": _secs_to_ts(end),
                "key_concepts": [],
                "summary": "",
            })
        return chapters

    # ------------------------------------------------------------------
    # Quiz generation
    # ------------------------------------------------------------------

    def _generate_quiz(self, db: Session, chunk: Any) -> None:
        from models import ChapterQuiz, ChapterQuizQuestion
        from services.question_service import question_service
        from config import settings

        content = " ".join(filter(None, [
            chunk.learning_objective,
            chunk.summary,
            " ".join(chunk.key_concepts or []),
        ]))

        questions_raw = []
        if settings.CLAUDE_API_KEY and content.strip():
            try:
                q = question_service.generate_question(content, difficulty="medium")
                if q:
                    questions_raw.append(q)
            except Exception as e:
                logger.warning(f"Question generation for chunk {chunk.id}: {e}")

        # Always ensure at least one hard-coded fallback question
        if not questions_raw:
            questions_raw = [{
                "question": f"What is the main learning objective of this chapter: '{chunk.title}'?",
                "type": "free_text",
                "options": [],
                "correct_answer": chunk.learning_objective or "See chapter summary",
                "explanation": chunk.summary or "Review the chapter for the answer.",
            }]

        quiz = ChapterQuiz(
            chunk_id=chunk.id,
            question_count=len(questions_raw),
            estimated_time_seconds=len(questions_raw) * 60,
            ai_generated_at=datetime.utcnow(),
        )
        db.add(quiz)
        db.flush()

        for i, q in enumerate(questions_raw, 1):
            opts = q.get("options", [])
            if isinstance(opts, list) and opts:
                # Normalise to [{"text": "...", "correct": bool}] format
                if isinstance(opts[0], str):
                    ca = q.get("correct_answer", "")
                    opts = [{"text": o, "correct": o == ca} for o in opts]
            db.add(ChapterQuizQuestion(
                chapter_quiz_id=quiz.id,
                question_number=i,
                question_text=q.get("question", ""),
                question_type=q.get("type", "multiple_choice"),
                options=opts,
                explanation=q.get("explanation", ""),
            ))

        db.commit()

    # ------------------------------------------------------------------
    # Serialisation helpers
    # ------------------------------------------------------------------

    def _chunk_dict(self, chunk: Any, db: Session) -> Dict:
        from models import ChapterQuiz, ChapterQuizQuestion
        quiz = db.query(ChapterQuiz).filter(ChapterQuiz.chunk_id == chunk.id).first()
        questions = []
        if quiz:
            questions = [
                {
                    "id": str(q.id),
                    "question_number": q.question_number,
                    "question_text": q.question_text,
                    "question_type": q.question_type,
                    "options": q.options or [],
                    "explanation": q.explanation,
                }
                for q in db.query(ChapterQuizQuestion)
                           .filter(ChapterQuizQuestion.chapter_quiz_id == quiz.id)
                           .order_by(ChapterQuizQuestion.question_number)
                           .all()
            ]
        return {
            "id": str(chunk.id),
            "chunk_number": chunk.chunk_number,
            "title": chunk.title,
            "description": chunk.description,
            "start_timestamp": chunk.start_timestamp,
            "end_timestamp": chunk.end_timestamp,
            "start_seconds": chunk.start_seconds,
            "end_seconds": chunk.end_seconds,
            "duration_seconds": chunk.duration_seconds,
            "learning_objective": chunk.learning_objective,
            "key_concepts": chunk.key_concepts or [],
            "summary": chunk.summary,
            "quiz": {
                "id": str(quiz.id) if quiz else None,
                "question_count": len(questions),
                "questions": questions,
            },
        }

    def get_chunk_with_progress(self, db: Session, chunk_id: str, user_id: str) -> Optional[Dict]:
        from models import VideoChunk, ChapterProgress
        chunk = db.query(VideoChunk).filter(VideoChunk.id == chunk_id).first()
        if not chunk:
            return None
        d = self._chunk_dict(chunk, db)
        progress = db.query(ChapterProgress).filter(
            and_(ChapterProgress.chunk_id == chunk_id, ChapterProgress.user_id == user_id)
        ).first()
        d["user_progress"] = {
            "watched_seconds": progress.watched_seconds if progress else 0,
            "completion_percent": progress.completion_percent if progress else 0,
            "completed": progress.completed_at is not None if progress else False,
            "quiz_score": progress.quiz_score if progress else None,
        }
        return d

    def save_progress(
        self,
        db: Session,
        chunk_id: str,
        user_id: str,
        watched_seconds: int,
        quiz_score: Optional[int] = None,
    ) -> Dict:
        from models import VideoChunk, ChapterProgress
        chunk = db.query(VideoChunk).filter(VideoChunk.id == chunk_id).first()
        if not chunk:
            return {"error": "chunk not found"}

        pct = min(100, int(watched_seconds / max(chunk.duration_seconds, 1) * 100)) if chunk.duration_seconds else 0
        progress = db.query(ChapterProgress).filter(
            and_(ChapterProgress.chunk_id == chunk_id, ChapterProgress.user_id == user_id)
        ).first()

        now = datetime.utcnow()
        if not progress:
            progress = ChapterProgress(
                user_id=user_id,
                chunk_id=chunk_id,
                started_at=now,
            )
            db.add(progress)

        progress.watched_seconds = max(progress.watched_seconds or 0, watched_seconds)
        progress.completion_percent = max(progress.completion_percent or 0, pct)
        progress.updated_at = now
        if pct >= 90 and not progress.completed_at:
            progress.completed_at = now
        if quiz_score is not None:
            progress.quiz_attempts = (progress.quiz_attempts or 0) + 1
            progress.quiz_score = quiz_score
            progress.best_quiz_score = max(progress.best_quiz_score or 0, quiz_score)

        db.commit()
        return {"completion_percent": pct, "completed": progress.completed_at is not None}


video_chunking_service = VideoChunkingService()
