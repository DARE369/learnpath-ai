"""
YouTube API integration service
Handles: search, metadata fetching, transcript extraction
"""

import logging
import re
from typing import List, Optional, Dict

import httpx
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound, VideoUnavailable

from config import settings

logger = logging.getLogger(__name__)


class YouTubeService:
    """Service for YouTube API operations"""

    BASE_URL = "https://www.googleapis.com/youtube/v3"

    def __init__(self):
        self.api_key = settings.YOUTUBE_API_KEY
        if not self.api_key:
            logger.warning("YOUTUBE_API_KEY not configured - YouTube search disabled")

    async def search_videos(self, query: str, max_results: int = 20) -> List[Dict]:
        """
        Search YouTube for videos matching query.

        Args:
            query: Search query (e.g., "photosynthesis")
            max_results: Maximum videos to return (1-50)

        Returns:
            List of video metadata dicts

        Raises:
            ValueError: If API key not configured
            httpx.HTTPError: If API call fails
        """
        if not self.api_key:
            raise ValueError("YOUTUBE_API_KEY not configured")

        logger.info(f"Searching YouTube for: {query}")

        params = {
            "key": self.api_key,
            "q": query,
            "part": "snippet",
            "type": "video",
            "maxResults": min(max_results, 50),
            "order": "relevance",
            "regionCode": "NG",
            "videoCaption": "closedCaption",
            "safeSearch": "strict",
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.BASE_URL}/search",
                    params=params,
                    timeout=10.0,
                )
                response.raise_for_status()
                data = response.json()

            if "items" not in data:
                logger.warning(f"No results for query: {query}")
                return []

            videos = []
            for item in data["items"]:
                if item["id"]["kind"] != "youtube#video":
                    continue
                snippet = item["snippet"]
                videos.append({
                    "youtube_id": item["id"]["videoId"],
                    "title": snippet["title"],
                    "description": snippet["description"],
                    "channel_id": snippet["channelId"],
                    "channel_name": snippet["channelTitle"],
                    "published_at": snippet["publishedAt"],
                    "thumbnail_url": snippet["thumbnails"]["default"]["url"],
                })

            logger.info(f"Found {len(videos)} videos for: {query}")
            return videos

        except httpx.HTTPError as e:
            logger.error(f"YouTube API error: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error searching YouTube: {e}")
            raise

    async def get_video_details(self, youtube_id: str) -> Dict:
        """
        Get detailed metadata for a single video.

        Args:
            youtube_id: YouTube video ID

        Returns:
            Video metadata dict with duration, view count, etc.
        """
        if not self.api_key:
            raise ValueError("YOUTUBE_API_KEY not configured")

        logger.info(f"Getting details for video: {youtube_id}")

        params = {
            "key": self.api_key,
            "id": youtube_id,
            "part": "contentDetails,statistics",
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.BASE_URL}/videos",
                    params=params,
                    timeout=10.0,
                )
                response.raise_for_status()
                data = response.json()

            if not data.get("items"):
                logger.warning(f"No details found for: {youtube_id}")
                return {}

            item = data["items"][0]
            duration_seconds = self._parse_duration(
                item["contentDetails"]["duration"]
            )
            details = {
                "youtube_id": youtube_id,
                "duration_seconds": duration_seconds,
                "view_count": int(item["statistics"].get("viewCount", 0)),
                "like_count": int(item["statistics"].get("likeCount", 0)),
                "comment_count": int(item["statistics"].get("commentCount", 0)),
            }

            logger.info(f"Got details: {duration_seconds}s, {details['view_count']} views")
            return details

        except httpx.HTTPError as e:
            logger.error(f"YouTube API error getting details: {e}")
            raise

    async def get_transcript(
        self, youtube_id: str, languages: List[str] = None
    ) -> Optional[str]:
        """
        Extract transcript from YouTube video.

        Args:
            youtube_id: YouTube video ID
            languages: Preferred languages (e.g., ['en', 'en-US'])

        Returns:
            Full transcript as string, or None if not available
        """
        if languages is None:
            languages = ["en", "en-US"]

        logger.info(f"Fetching transcript for: {youtube_id}")

        try:
            # 1.x API: instantiate first, then call list()
            ytt = YouTubeTranscriptApi()
            transcript_list = ytt.list(youtube_id)

            transcript = None
            for lang in languages:
                try:
                    transcript = transcript_list.find_transcript([lang])
                    logger.info(f"Found transcript in {lang}")
                    break
                except Exception:
                    pass

            # Fall back to any available transcript (auto-generated included)
            if transcript is None:
                for t in transcript_list:
                    transcript = t
                    logger.info(f"Using transcript in: {t.language}")
                    break

            if transcript is None:
                return None

            # 1.x: fetch() returns FetchedTranscript (iterable of FetchedTranscriptSnippet)
            # Snippets use .text attribute, not ["text"] dict access
            transcript_data = transcript.fetch()
            transcript_text = "\n".join(item.text for item in transcript_data)
            logger.info(f"Transcript fetched: {len(transcript_text)} characters")
            return transcript_text

        except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable) as e:
            logger.warning(f"Transcript not available for {youtube_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error fetching transcript: {e}")
            return None

    async def get_videos_details_batch(self, youtube_ids: List[str]) -> Dict[str, Dict]:
        """
        Fetch contentDetails + statistics for up to 50 videos in one API call.
        Returns a dict keyed by youtube_id. Missing IDs are silently omitted.
        """
        if not self.api_key or not youtube_ids:
            return {}

        params = {
            "key": self.api_key,
            "id": ",".join(youtube_ids[:50]),
            "part": "contentDetails,statistics",
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.BASE_URL}/videos",
                    params=params,
                    timeout=10.0,
                )
                response.raise_for_status()
                data = response.json()
        except Exception as e:
            logger.warning(f"Batch video details fetch failed: {e}")
            return {}

        result: Dict[str, Dict] = {}
        for item in data.get("items", []):
            vid = item.get("id", "")
            if not vid:
                continue
            duration_seconds = self._parse_duration(
                item.get("contentDetails", {}).get("duration", "PT0S")
            )
            stats = item.get("statistics", {})
            result[vid] = {
                "duration_seconds": duration_seconds,
                "view_count": int(stats.get("viewCount", 0)),
                "like_count": int(stats.get("likeCount", 0)),
                "comment_count": int(stats.get("commentCount", 0)),
            }

        logger.info(f"Batch details fetched for {len(result)}/{len(youtube_ids)} videos")
        return result

    async def available_youtube_ids(self, youtube_ids: List[str]) -> set:
        """Return the subset of ids still live & public on YouTube (Stage 12/D14).
        videos.list omits removed/private/region-blocked videos, so anything not
        returned is unavailable. Fails OPEN (returns all ids) when the API key is
        missing or the call errors, so we never wrongly prune on an outage."""
        ids = [i for i in (youtube_ids or []) if i]
        if not self.api_key or not ids:
            return set(ids)
        details = await self.get_videos_details_batch(ids)
        if not details:
            return set(ids)  # fail-open
        return set(details.keys())

    @staticmethod
    def _parse_duration(duration_str: str) -> int:
        """Parse ISO 8601 duration to seconds. Example: PT1H23M45S -> 5025"""
        match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duration_str)
        if not match:
            return 0
        hours = int(match.group(1) or 0)
        minutes = int(match.group(2) or 0)
        seconds = int(match.group(3) or 0)
        return hours * 3600 + minutes * 60 + seconds

    @staticmethod
    def extract_youtube_id(url: str) -> Optional[str]:
        """
        Extract YouTube video ID from URL.
        Handles: youtube.com, youtu.be, youtube-nocookie.com, bare IDs
        """
        patterns = [
            r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube-nocookie\.com/embed/)"
            r"([0-9A-Za-z_-]{11})",
            r"^([0-9A-Za-z_-]{11})$",
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None


# Module-level singleton
youtube_service = YouTubeService()
