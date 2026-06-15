"""
TranscriptManager — single source of truth for video transcripts.

All services (chunking, notes, summaries) should import this instead of
calling YouTubeTranscriptApi directly.  Stores per-line timestamps so
downstream chunking can produce frame-accurate chapter boundaries.

SQL migration (run once in Supabase):
    ALTER TABLE videos ADD COLUMN IF NOT EXISTS transcript_timestamps JSONB;
    ALTER TABLE videos ADD COLUMN IF NOT EXISTS transcript_unavailable BOOLEAN DEFAULT FALSE;
    ALTER TABLE videos ADD COLUMN IF NOT EXISTS transcript_fetched_at TIMESTAMPTZ;
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

PREFERRED_LANGUAGES = ["en", "en-US", "en-GB"]
RETRY_AFTER_DAYS = 7


@dataclass
class TranscriptResult:
    text: str
    timestamped_lines: List[Dict]  # [{text, start, duration}, ...]
    source: str                    # "cache" or "youtube"


class TranscriptManager:
    """
    Centralised transcript fetching with SQLAlchemy caching.

    Usage (with db):
        result = transcript_manager.get_transcript(db, "dQw4w9WgXcQ")
        if result:
            result.text              # full joined text
            result.timestamped_lines # [{text, start, duration}, ...]
            result.source            # "cache" or "youtube"

    Usage (no db, text-only, no caching):
        text = transcript_manager.get_transcript_text("dQw4w9WgXcQ")
    """

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_transcript(self, db: Session, youtube_id: str) -> Optional[TranscriptResult]:
        """Return cached transcript or fetch from YouTube and cache it."""
        from models import Video

        video = db.query(Video).filter(Video.youtube_id == youtube_id).first()

        # 1. Cache hit
        if video and video.transcript and video.transcript_timestamps:
            logger.info(f"Transcript cache hit for {youtube_id}")
            return TranscriptResult(
                text=video.transcript,
                timestamped_lines=video.transcript_timestamps,
                source="cache",
            )

        # 2. Previously marked unavailable (within retry window)
        if video and video.transcript_unavailable and video.transcript_fetched_at:
            age = datetime.utcnow() - video.transcript_fetched_at
            if age < timedelta(days=RETRY_AFTER_DAYS):
                logger.info(f"Transcript marked unavailable for {youtube_id}, skipping")
                return None

        # 3. Fetch from YouTube
        result = self._fetch_from_youtube(youtube_id)
        if result:
            self._cache(db, youtube_id, result)
        else:
            self._mark_unavailable(db, youtube_id)
        return result

    def get_transcript_text(self, youtube_id: str) -> Optional[str]:
        """Fetch transcript text only, no caching. For services without db."""
        result = self._fetch_from_youtube(youtube_id)
        return result.text if result else None

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _fetch_from_youtube(self, youtube_id: str) -> Optional[TranscriptResult]:
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            from youtube_transcript_api._errors import (
                NoTranscriptFound,
                TranscriptsDisabled,
                VideoUnavailable,
            )

            ytt = YouTubeTranscriptApi()

            # Try preferred languages first
            lines = None
            try:
                fetched = ytt.fetch(youtube_id, languages=PREFERRED_LANGUAGES)
                lines = list(fetched)
            except Exception:
                pass

            # Fall back to any available language
            if not lines:
                try:
                    transcript_list = ytt.list(youtube_id)
                    for t in transcript_list:
                        lines = list(t.fetch())
                        break
                except Exception:
                    pass

            if not lines:
                logger.warning(f"No transcript found for {youtube_id}")
                return None

            timestamped_lines = [
                {
                    "text": item.text.strip(),
                    "start": round(float(item.start), 2),
                    "duration": round(float(item.duration), 2),
                }
                for item in lines
                if item.text.strip()
            ]

            full_text = " ".join(ln["text"] for ln in timestamped_lines)
            logger.info(
                f"Fetched transcript for {youtube_id}: "
                f"{len(timestamped_lines)} lines, {len(full_text)} chars"
            )
            return TranscriptResult(
                text=full_text,
                timestamped_lines=timestamped_lines,
                source="youtube",
            )

        except Exception as e:
            logger.error(f"Transcript fetch error for {youtube_id}: {e}")
            return None

    def _cache(self, db: Session, youtube_id: str, result: TranscriptResult) -> None:
        from models import Video

        try:
            video = db.query(Video).filter(Video.youtube_id == youtube_id).first()
            if video:
                video.transcript = result.text
                video.transcript_timestamps = result.timestamped_lines
                video.transcript_cached = True
                video.transcript_unavailable = False
                video.transcript_fetched_at = datetime.utcnow()
                db.commit()
        except Exception as e:
            logger.error(f"Failed to cache transcript for {youtube_id}: {e}")
            db.rollback()

    def _mark_unavailable(self, db: Session, youtube_id: str) -> None:
        from models import Video

        try:
            video = db.query(Video).filter(Video.youtube_id == youtube_id).first()
            if video:
                video.transcript_unavailable = True
                video.transcript_fetched_at = datetime.utcnow()
                db.commit()
        except Exception as e:
            logger.error(f"Failed to mark unavailable for {youtube_id}: {e}")
            db.rollback()


transcript_manager = TranscriptManager()
