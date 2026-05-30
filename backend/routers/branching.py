"""
Concept branching endpoints (Packet 3.1).

Each concept is split into 3-5 progressive learning branches via Claude Opus.
Generated branches are cached in the `concept_branches` table (30-day TTL).
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from services.branching_service import (
    branching_service,
    Branch,
    InvalidBranchSet,
)
from services.cost_tracker import cost_tracker, BudgetExceeded

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------- Request / response models ----------

class BranchOut(BaseModel):
    branch_id: str
    concept_name: str
    branch_title: str
    description: str
    difficulty_level: int
    prerequisites: List[str]
    estimated_duration_minutes: int
    branch_order: int


class BranchesResponse(BaseModel):
    concept_name: str
    branches: List[BranchOut]
    source: str  # "cache" | "generated"
    cost_remaining_ngn: float


class GenerateBranchesRequest(BaseModel):
    base_concept_summary: str = Field("", description="Optional context for Claude")
    force_regenerate: bool = False


class ValidateRequest(BaseModel):
    branches: List[BranchOut]


class ValidateResponse(BaseModel):
    is_valid: bool
    issues: List[str]


def _branch_to_out(b: Branch) -> BranchOut:
    return BranchOut(**b.to_dict())


# ---------- Endpoints ----------

@router.get("/{concept_name}", response_model=BranchesResponse)
async def get_or_generate_branches(
    concept_name: str,
    base_concept_summary: str = "",
    db: Session = Depends(get_db),
):
    """
    Return cached branches for a concept, or generate them on cache miss.

    Pass `base_concept_summary` as a query param for richer Opus context on
    first call. Subsequent calls within 30 days hit the DB cache.
    """
    cached = branching_service.get_branches_for_concept(concept_name, db)
    if cached:
        return BranchesResponse(
            concept_name=concept_name,
            branches=[_branch_to_out(b) for b in cached],
            source="cache",
            cost_remaining_ngn=cost_tracker.remaining("branching"),
        )

    if not base_concept_summary:
        base_concept_summary = (
            f"Generate 3-5 progressive learning branches for the concept '{concept_name}'."
        )

    try:
        branches = await branching_service.generate_branches(
            concept_name=concept_name,
            base_concept_summary=base_concept_summary,
            db=db,
        )
    except BudgetExceeded as e:
        raise HTTPException(status_code=429, detail=str(e))
    except InvalidBranchSet as e:
        raise HTTPException(status_code=502, detail=f"Invalid Claude response: {e}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Branch generation failed for '{concept_name}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Branch generation failed")

    return BranchesResponse(
        concept_name=concept_name,
        branches=[_branch_to_out(b) for b in branches],
        source="generated",
        cost_remaining_ngn=cost_tracker.remaining("branching"),
    )


@router.post("/{concept_name}/regenerate", response_model=BranchesResponse)
async def regenerate_branches(
    concept_name: str,
    payload: GenerateBranchesRequest,
    db: Session = Depends(get_db),
):
    """Admin: force-regenerate branches, bypassing the cache."""
    summary = payload.base_concept_summary or (
        f"Generate 3-5 progressive learning branches for the concept '{concept_name}'."
    )
    try:
        branches = await branching_service.generate_branches(
            concept_name=concept_name,
            base_concept_summary=summary,
            db=db,
            force_regenerate=True,
        )
    except BudgetExceeded as e:
        raise HTTPException(status_code=429, detail=str(e))
    except InvalidBranchSet as e:
        raise HTTPException(status_code=502, detail=f"Invalid Claude response: {e}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return BranchesResponse(
        concept_name=concept_name,
        branches=[_branch_to_out(b) for b in branches],
        source="generated",
        cost_remaining_ngn=cost_tracker.remaining("branching"),
    )


@router.post("/{concept_name}/branches/{branch_id}/learning-path")
async def create_branch_path(
    concept_name: str,
    branch_id: str,
    db: Session = Depends(get_db),
):
    """
    Create a learning path for a specific branch.
    Stub for Packet 3.1 — real path assembly arrives in a follow-up.
    """
    cached = branching_service.get_branches_for_concept(concept_name, db)
    branch = next((b for b in cached if b.branch_id == branch_id), None)
    if branch is None:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branching_service.create_branch_learning_path(branch)


@router.post("/validate", response_model=ValidateResponse)
async def validate_progression(payload: ValidateRequest):
    """Admin: validate that a branch set has correct linear progression."""
    branches = [
        Branch(**b.model_dump()) for b in payload.branches
    ]
    is_valid = branching_service.validate_linear_progression(branches)
    issues: List[str] = []
    if not is_valid:
        if not (3 <= len(branches) <= 5):
            issues.append(f"Branch count {len(branches)} not in [3, 5]")
        difficulties = [b.difficulty_level for b in branches]
        if any(difficulties[i] >= difficulties[i + 1] for i in range(len(difficulties) - 1)):
            issues.append(f"Difficulty not strictly increasing: {difficulties}")
        seen: set = set()
        for b in branches:
            for p in b.prerequisites:
                if p not in seen:
                    issues.append(f"Branch '{b.branch_title}' has unknown prereq '{p}'")
            seen.add(b.branch_title)
    return ValidateResponse(is_valid=is_valid, issues=issues)


@router.get("/admin/cost-stats")
async def cost_stats():
    """Daily cost tracker stats for all features."""
    return cost_tracker.stats()
