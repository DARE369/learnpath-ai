from fastapi import APIRouter, HTTPException

from schemas import SummaryRequest, SummaryResponse
from services.summary_service import SummaryService

router = APIRouter()
_service = SummaryService()


@router.post("/generate", response_model=SummaryResponse)
async def generate_summary(request: SummaryRequest):
    """Generate a structured summary from a video transcript."""
    try:
        return await _service.generate_summary(
            youtube_id=request.youtube_id,
            transcript=request.transcript,
            title=request.title,
            max_length=request.max_length or 500,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summary generation failed: {str(e)}")
