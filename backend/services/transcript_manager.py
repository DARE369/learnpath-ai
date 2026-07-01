"""
TranscriptManager — single source of truth for video transcripts.

Fetch order:
  1. DB cache hit (instant)
  2. YouTube Transcript API (free, fast, no audio download)
  3. Whisper fallback via yt-dlp (requires OPENAI_API_KEY; ~60-120s for a 10-min video)

All services (chunking, notes, summaries) import this instead of calling
YouTubeTranscriptApi directly.  Stores per-line timestamps so downstream
chunking can produce frame-accurate chapter boundaries.

SQL migration (run once in Supabase):
    ALTER TABLE videos ADD COLUMN IF NOT EXISTS transcript_timestamps JSONB;
    ALTER TABLE videos ADD COLUMN IF NOT EXISTS transcript_unavailable BOOLEAN DEFAULT FALSE;
    ALTER TABLE videos ADD COLUMN IF NOT EXISTS transcript_fetched_at TIMESTAMPTZ;
"""

from __future__ import annotations

import glob
import logging
import os
import tempfile
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
    source: str                    # "cache" | "youtube" | "whisper"


class TranscriptManager:
    """
    Centralised transcript fetching with SQLAlchemy caching.

    Usage:
        result = transcript_manager.get_transcript(db, "dQw4w9WgXcQ")
        if result:
            result.text              # full joined text
            result.timestamped_lines # [{text, start, duration}, ...]
            result.source            # "cache" | "youtube" | "whisper"
    """

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_transcript(self, db: Session, youtube_id: str) -> Optional[TranscriptResult]:
        """Return cached transcript or fetch from YouTube → Whisper fallback."""
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

        # 2. Previously marked unavailable — try Whisper once more in case
        #    it was marked before the Whisper fallback existed, then honour
        #    the retry window if Whisper also fails.
        if video and video.transcript_unavailable and video.transcript_fetched_at:
            age = datetime.utcnow() - video.transcript_fetched_at
            if age < timedelta(days=RETRY_AFTER_DAYS):
                result = self._fetch_via_whisper(youtube_id)
                if result:
                    self._cache(db, youtube_id, result)
                    return result
                logger.info(f"Whisper also failed for unavailable video {youtube_id}")
                # Refresh the retry timer so we don't hammer Whisper on every request
                self._mark_unavailable(db, youtube_id)
                return None

        # 3. Try YouTube captions
        result = self._fetch_from_youtube(youtube_id)

        # 4. Whisper fallback when YouTube has no captions
        if not result:
            logger.info(f"No YouTube captions for {youtube_id} — trying Whisper fallback")
            result = self._fetch_via_whisper(youtube_id)

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
    # Fetch strategies
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

            lines = None
            try:
                fetched = ytt.fetch(youtube_id, languages=PREFERRED_LANGUAGES)
                lines = list(fetched)
            except Exception:
                pass

            if not lines:
                try:
                    transcript_list = ytt.list(youtube_id)
                    for t in transcript_list:
                        lines = list(t.fetch())
                        break
                except Exception:
                    pass

            if not lines:
                logger.warning(f"No YouTube captions found for {youtube_id}")
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
                f"YouTube transcript for {youtube_id}: "
                f"{len(timestamped_lines)} lines, {len(full_text)} chars"
            )
            return TranscriptResult(
                text=full_text,
                timestamped_lines=timestamped_lines,
                source="youtube",
            )

        except Exception as e:
            logger.error(f"YouTube transcript fetch error for {youtube_id}: {e}")
            return None

    def _fetch_via_whisper(self, youtube_id: str) -> Optional[TranscriptResult]:
        """
        Download audio with yt-dlp and transcribe with OpenAI Whisper.

        Requires:
          - OPENAI_API_KEY env var
          - yt-dlp and openai packages
          - ffmpeg system binary (for audio conversion; added to nixpacks.toml)

        Cost: free tier via Groq (generous rate limits; no credit card required).
        Time: ~60-120 s for a 10-minute video (dominated by audio download).
        """
        from config import settings

        if not settings.GROQ_API_KEY:
            logger.warning(
                "GROQ_API_KEY not set — Whisper fallback unavailable for %s", youtube_id
            )
            return None

        try:
            import yt_dlp
            from groq import Groq
        except ImportError as e:
            logger.error(f"Whisper fallback: missing package ({e}). Add yt-dlp and groq to requirements.txt.")
            return None

        logger.info(f"Whisper: starting audio download for {youtube_id}")

        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                # Download best audio track; prefer m4a (widely compatible with Whisper).
                # ffmpeg converts to mp3 at 64 kbps (~4.6 MB / 10 min, well under the 25 MB limit).
                ydl_opts = {
                    "format": (
                        "bestaudio[ext=m4a][filesize<24M]"
                        "/bestaudio[ext=webm][filesize<24M]"
                        "/bestaudio[filesize<24M]"
                        "/bestaudio"
                    ),
                    "outtmpl": os.path.join(tmpdir, f"{youtube_id}.%(ext)s"),
                    "postprocessors": [
                        {
                            "key": "FFmpegExtractAudio",
                            "preferredcodec": "mp3",
                            "preferredquality": "64",
                        }
                    ],
                    "quiet": True,
                    "no_warnings": True,
                }

                try:
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        ydl.download([f"https://www.youtube.com/watch?v={youtube_id}"])
                except Exception:
                    # ffmpeg not available — retry without the postprocessor (native format)
                    ydl_opts_no_ffmpeg = {
                        "format": (
                            "bestaudio[ext=m4a][filesize<24M]"
                            "/bestaudio[ext=webm][filesize<24M]"
                            "/bestaudio[filesize<24M]"
                            "/bestaudio"
                        ),
                        "outtmpl": os.path.join(tmpdir, f"{youtube_id}.%(ext)s"),
                        "quiet": True,
                        "no_warnings": True,
                    }
                    with yt_dlp.YoutubeDL(ydl_opts_no_ffmpeg) as ydl:
                        ydl.download([f"https://www.youtube.com/watch?v={youtube_id}"])

                # Find whichever file yt-dlp produced
                candidates = glob.glob(os.path.join(tmpdir, f"{youtube_id}.*"))
                if not candidates:
                    logger.error(f"Whisper: no audio file produced for {youtube_id}")
                    return None

                audio_path = candidates[0]
                file_size_mb = os.path.getsize(audio_path) / (1024 * 1024)
                logger.info(
                    f"Whisper: downloaded {os.path.basename(audio_path)} "
                    f"({file_size_mb:.1f} MB) for {youtube_id}"
                )

                if file_size_mb > 24.5:
                    logger.warning(
                        f"Whisper: audio too large ({file_size_mb:.1f} MB) for {youtube_id} — skipping"
                    )
                    return None

                client = Groq(api_key=settings.GROQ_API_KEY)
                with open(audio_path, "rb") as f:
                    response = client.audio.transcriptions.create(
                        model="whisper-large-v3-turbo",
                        file=f,
                        response_format="verbose_json",
                        timestamp_granularities=["segment"],
                    )

                segments = getattr(response, "segments", None) or []
                timestamped_lines: List[Dict] = []
                for seg in segments:
                    text = seg.get("text", "") if isinstance(seg, dict) else getattr(seg, "text", "")
                    start = seg.get("start", 0.0) if isinstance(seg, dict) else getattr(seg, "start", 0.0)
                    end = seg.get("end", start) if isinstance(seg, dict) else getattr(seg, "end", start)
                    text = text.strip()
                    if text:
                        timestamped_lines.append({
                            "text": text,
                            "start": round(float(start), 2),
                            "duration": round(float(end) - float(start), 2),
                        })

                # Fall back to plain text if no segments were returned
                if not timestamped_lines:
                    full_text = (getattr(response, "text", "") or "").strip()
                    if full_text:
                        timestamped_lines = [{"text": full_text, "start": 0.0, "duration": 0.0}]

                if not timestamped_lines:
                    logger.warning(f"Whisper: empty transcript for {youtube_id}")
                    return None

                full_text = " ".join(ln["text"] for ln in timestamped_lines)
                logger.info(
                    f"Whisper: transcribed {youtube_id}: "
                    f"{len(timestamped_lines)} segments, {len(full_text)} chars"
                )
                return TranscriptResult(
                    text=full_text,
                    timestamped_lines=timestamped_lines,
                    source="whisper",
                )

        except Exception as e:
            logger.error(f"Whisper fallback failed for {youtube_id}: {e}")
            return None

    # ------------------------------------------------------------------
    # DB helpers
    # ------------------------------------------------------------------

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
