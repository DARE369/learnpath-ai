"""
YouTube API endpoints
"""

import logging
from typing import List

from fastapi import APIRouter, HTTPException, Query, status

from schemas import VideoSearchResult
from services.youtube_service import youtube_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/search", response_model=List[VideoSearchResult])
async def search_videos(
    query: str = Query(..., min_length=2, max_length=200, description="Search query"),
    max_results: int = Query(10, ge=1, le=50, description="Max videos to return"),
):
    """
    Search YouTube for videos matching query.

    - **query**: Topic to search (e.g., "photosynthesis") — min 2 chars
    - **max_results**: Number of results to return (1-50, default 10)

    Returns a list of video metadata. Requires YOUTUBE_API_KEY to be configured.
    """
    try:
        videos = await youtube_service.search_videos(
            query=query.strip(),
            max_results=max_results,
        )

        if not videos:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No videos found for: {query}",
            )

        return videos

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error searching YouTube",
        )


@router.get("/details/{youtube_id}")
async def get_video_details(youtube_id: str):
    """
    Get detailed metadata for a video (duration, view count, likes).

    - **youtube_id**: 11-character YouTube video ID
    """
    try:
        details = await youtube_service.get_video_details(youtube_id)

        if not details:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Video not found: {youtube_id}",
            )

        return details

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Details error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching video details",
        )


@router.get("/transcript/{youtube_id}")
async def get_transcript(youtube_id: str):
    """
    Get transcript for a YouTube video.

    - **youtube_id**: 11-character YouTube video ID

    Returns the transcript as plain text. Returns 404 if no transcript is available.
    """
    try:
        transcript = await youtube_service.get_transcript(youtube_id)

        if transcript is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Transcript not available for: {youtube_id}",
            )

        return {"youtube_id": youtube_id, "transcript": transcript}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcript error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching transcript",
        )
