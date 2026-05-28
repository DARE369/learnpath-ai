"""
Learning path endpoints — assemble and validate optimal video sequences.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from services.path_service import path_service

logger = logging.getLogger(__name__)
router = APIRouter()


class VideoItem(BaseModel):
    video_id: str
    eqs_score: float = 0.0
    concepts: List[str] = []


class AssemblePathRequest(BaseModel):
    topic_id: str
    videos: List[VideoItem]
    concept_graph: Optional[Dict[str, Any]] = None


class PathData(BaseModel):
    video_sequence: List[str]
    video_count: int
    average_score: float


@router.post("/assemble")
async def assemble_path(request: AssemblePathRequest):
    """
    Assemble an optimal learning path from a list of scored videos.

    Ranks by EQS score, orders by prerequisites (if concept graph provided),
    trims to max length, validates quality, and returns the ordered sequence.
    """
    try:
        video_dicts = [v.model_dump() for v in request.videos]
        path = path_service.assemble_path(
            topic_id=request.topic_id,
            videos=video_dicts,
            concept_graph=request.concept_graph,
        )

        validation = path_service.validate_path(path)
        path["validation"] = validation

        if validation["is_valid"]:
            path["path_id"] = path_service.save_path_to_db(path)

        return path

    except Exception as e:
        logger.error(f"Error assembling path: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error assembling path",
        )


@router.post("/validate")
async def validate_path(path: PathData):
    """
    Validate a previously assembled path.
    Checks length, average EQS quality, and duplicate videos.
    """
    try:
        return path_service.validate_path(path.model_dump())
    except Exception as e:
        logger.error(f"Error validating path: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error validating path",
        )
