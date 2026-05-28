"""
Concept graph endpoints — extract, build, and order learning concepts.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from services.concept_graph_service import concept_graph_service

logger = logging.getLogger(__name__)
router = APIRouter()


class ConceptExtractionRequest(BaseModel):
    summary: str
    video_title: str


class Concept(BaseModel):
    name: str
    definition: str = ""
    prerequisites: List[str] = []


class ConceptsData(BaseModel):
    concepts: List[Concept]
    topic: Optional[str] = None
    complexity: Optional[str] = None
    algorithm_version: Optional[str] = None


class GraphData(BaseModel):
    graph: Dict[str, Any]
    concepts: Optional[List[str]] = None
    topic: Optional[str] = None


@router.post("/extract")
async def extract_concepts(request: ConceptExtractionRequest):
    """
    Extract concepts and prerequisites from a video summary.
    Uses Claude Opus for high-quality concept mapping.
    """
    try:
        return await concept_graph_service.extract_concepts(
            summary=request.summary,
            video_title=request.video_title,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error extracting concepts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error extracting concepts",
        )


@router.post("/build")
async def build_graph(concepts_data: ConceptsData):
    """
    Build a concept graph, detect cycles, and return topologically sorted concepts.
    """
    try:
        raw = concepts_data.model_dump()
        graph = concept_graph_service.build_concept_graph(raw)
        has_cycles, cycles = concept_graph_service.detect_cycles(graph)

        if has_cycles:
            logger.warning(f"Cycles detected: {cycles}")
            graph = concept_graph_service.break_cycles(graph, cycles)

        sorted_concepts, is_valid = concept_graph_service.topological_sort(graph)

        return {
            "graph": graph,
            "ordered_concepts": sorted_concepts,
            "cycles_detected": has_cycles,
            "is_valid": is_valid,
        }
    except Exception as e:
        logger.error(f"Error building graph: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error building concept graph",
        )


@router.post("/sort")
async def sort_concepts(graph_data: GraphData):
    """
    Topologically sort an existing concept graph (prerequisites first).
    """
    try:
        raw = graph_data.model_dump()
        sorted_concepts, is_valid = concept_graph_service.topological_sort(raw)

        return {
            "ordered_concepts": sorted_concepts,
            "is_valid": is_valid,
            "total_concepts": len(sorted_concepts),
        }
    except Exception as e:
        logger.error(f"Error sorting concepts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error sorting concepts",
        )
