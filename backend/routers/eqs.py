from fastapi import APIRouter, HTTPException

from schemas import VideoScoreRequest
from services.eqs_service import EQSService

router = APIRouter()
_service = EQSService()


@router.post("/score")
async def score_video(request: VideoScoreRequest):
    """Score a YouTube video on educational quality. Returns EQS 0-100 with tier breakdown."""
    try:
        return await _service.score_video(
            youtube_id=request.youtube_id,
            title=request.title,
            transcript=request.transcript,
            description=request.description,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"EQS scoring failed: {str(e)}")
