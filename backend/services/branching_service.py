"""
Concept branching — split a concept into 3-5 progressive learning branches.

Uses Claude Opus to generate branches, then validates that:
  - 3 ≤ count ≤ 5
  - difficulty_level is strictly monotonic (1..5)
  - each branch's prerequisites are subset of earlier branch titles

Branches are cached in the concept_branches table (30-day TTL via created_at).
Cost-controlled via cost_tracker — every Opus call charges 'branching'.
"""

import json
import logging
import re
import uuid
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import anthropic
from sqlalchemy.orm import Session

from config import settings
from services.cost_tracker import cost_tracker, BudgetExceeded

logger = logging.getLogger(__name__)

CACHE_TTL_DAYS = 30
OPUS_CHARGE_NGN = 0.15  # rough per-call estimate; ~3 calls/day fit in ₦0.50
ALGORITHM_VERSION = "v1"


@dataclass
class Branch:
    branch_id: str
    concept_name: str
    branch_title: str
    description: str
    difficulty_level: int
    prerequisites: List[str] = field(default_factory=list)
    estimated_duration_minutes: int = 30
    branch_order: int = 0

    def to_dict(self) -> Dict:
        return asdict(self)


class InvalidBranchSet(ValueError):
    """Branches returned by Claude failed validation."""


class ConceptBranchingService:
    def __init__(self):
        self.api_key = settings.CLAUDE_API_KEY
        self.model = "claude-opus-4-7"

    def _build_prompt(self, concept_name: str, base_concept_summary: str) -> str:
        return f"""You are an expert curriculum designer.

CONCEPT: {concept_name}

CONTEXT:
{base_concept_summary}

Split this concept into 3-5 progressive learning branches. Each branch is a
narrower, more specialized version of the concept. Branches should build on
each other linearly: branch N's prerequisites should only be branch titles
from positions 1..N-1.

Requirements:
1. Generate 3 to 5 branches (no more, no less)
2. difficulty_level is an integer 1-5, STRICTLY increasing across branches
3. branch_title is a short noun phrase (e.g. "Two-digit addition")
4. description is one sentence explaining what the learner will master
5. prerequisites is a list of earlier branch titles (or empty for branch 1)
6. estimated_duration_minutes is realistic (10-60)

Respond in this EXACT JSON format, with NO commentary before or after:
{{
  "branches": [
    {{
      "branch_title": "...",
      "description": "...",
      "difficulty_level": 1,
      "prerequisites": [],
      "estimated_duration_minutes": 20
    }}
  ]
}}"""

    async def _call_claude(self, concept_name: str, base_concept_summary: str) -> List[Dict]:
        if not self.api_key:
            raise ValueError("CLAUDE_API_KEY not configured")

        cost_tracker.charge("branching", OPUS_CHARGE_NGN)

        prompt = self._build_prompt(concept_name, base_concept_summary)
        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        message = await client.messages.create(
            model=self.model,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        response_text = message.content[0].text

        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if not json_match:
            raise InvalidBranchSet("No JSON object found in Claude response")

        parsed = json.loads(json_match.group())
        branches_raw = parsed.get("branches")
        if not isinstance(branches_raw, list):
            raise InvalidBranchSet("Response missing 'branches' list")
        return branches_raw

    def _hydrate(self, concept_name: str, branches_raw: List[Dict]) -> List[Branch]:
        branches: List[Branch] = []
        for idx, raw in enumerate(branches_raw):
            branches.append(Branch(
                branch_id=str(uuid.uuid4()),
                concept_name=concept_name,
                branch_title=str(raw.get("branch_title", "")).strip(),
                description=str(raw.get("description", "")).strip(),
                difficulty_level=int(raw.get("difficulty_level", idx + 1)),
                prerequisites=[str(p).strip() for p in raw.get("prerequisites", []) if p],
                estimated_duration_minutes=int(raw.get("estimated_duration_minutes", 30)),
                branch_order=idx,
            ))
        branches.sort(key=lambda b: b.difficulty_level)
        for i, b in enumerate(branches):
            b.branch_order = i
        return branches

    def validate_linear_progression(self, branches: List[Branch]) -> bool:
        """3-5 branches, strictly increasing difficulty, prereqs subset of earlier titles."""
        if not (3 <= len(branches) <= 5):
            logger.warning(f"Branch count out of range: {len(branches)}")
            return False

        difficulties = [b.difficulty_level for b in branches]
        if any(difficulties[i] >= difficulties[i + 1] for i in range(len(difficulties) - 1)):
            logger.warning(f"Difficulty not strictly increasing: {difficulties}")
            return False

        seen_titles: set = set()
        for b in branches:
            if not b.branch_title:
                logger.warning("Branch has empty title")
                return False
            for prereq in b.prerequisites:
                if prereq not in seen_titles:
                    logger.warning(
                        f"Branch '{b.branch_title}' has unknown prerequisite '{prereq}'"
                    )
                    return False
            seen_titles.add(b.branch_title)

        return True

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def generate_branches(
        self,
        concept_name: str,
        base_concept_summary: str,
        db: Optional[Session] = None,
        force_regenerate: bool = False,
    ) -> List[Branch]:
        """
        Generate branches for a concept. Returns cached rows if a fresh set
        exists in the DB and force_regenerate is False.
        """
        concept_key = concept_name.strip().lower()
        if not concept_key:
            raise ValueError("concept_name required")

        if db is not None and not force_regenerate:
            cached = self._get_cached(db, concept_key)
            if cached:
                logger.info(f"Branch cache HIT: {concept_key} ({len(cached)} branches)")
                return cached

        logger.info(f"Branch cache MISS: {concept_key} — calling Opus")
        try:
            raw = await self._call_claude(concept_name, base_concept_summary)
        except BudgetExceeded:
            raise  # caller (router) turns this into 429

        branches = self._hydrate(concept_name, raw)
        if not self.validate_linear_progression(branches):
            raise InvalidBranchSet(
                "Claude returned branches that failed linear-progression validation"
            )

        if db is not None:
            self._persist(db, concept_key, branches)

        return branches

    def get_branches_for_concept(
        self,
        concept_name: str,
        db: Session,
    ) -> List[Branch]:
        """Return cached branches for a concept (empty list if none)."""
        return self._get_cached(db, concept_name.strip().lower()) or []

    def create_branch_learning_path(self, branch: Branch) -> Dict:
        """
        Stub — real path building reuses SearchService. Wired in a follow-up
        once we decide how branch context shapes the search query.
        """
        return {
            "branch_id": branch.branch_id,
            "branch_title": branch.branch_title,
            "status": "not_yet_implemented",
            "message": "Branch-scoped path assembly arrives in a follow-up packet.",
        }

    # ------------------------------------------------------------------
    # DB helpers — import models lazily to avoid circular imports
    # ------------------------------------------------------------------

    def _get_cached(self, db: Session, concept_key: str) -> Optional[List[Branch]]:
        from models import ConceptBranch  # lazy import
        cutoff = datetime.utcnow() - timedelta(days=CACHE_TTL_DAYS)
        rows = (
            db.query(ConceptBranch)
            .filter(
                ConceptBranch.concept_key == concept_key,
                ConceptBranch.is_active.is_(True),
                ConceptBranch.created_at >= cutoff,
            )
            .order_by(ConceptBranch.branch_order.asc())
            .all()
        )
        if not rows:
            return None
        return [
            Branch(
                branch_id=str(r.id),
                concept_name=r.concept_name,
                branch_title=r.branch_title,
                description=r.description or "",
                difficulty_level=r.difficulty_level or 0,
                prerequisites=list(r.prerequisites or []),
                estimated_duration_minutes=r.estimated_duration_minutes or 30,
                branch_order=r.branch_order or 0,
            )
            for r in rows
        ]

    def _persist(self, db: Session, concept_key: str, branches: List[Branch]) -> None:
        from models import ConceptBranch  # lazy import
        # Deactivate any prior active rows for this concept so the new set wins
        db.query(ConceptBranch).filter(
            ConceptBranch.concept_key == concept_key,
            ConceptBranch.is_active.is_(True),
        ).update({"is_active": False}, synchronize_session=False)

        for b in branches:
            row = ConceptBranch(
                id=uuid.UUID(b.branch_id),
                concept_key=concept_key,
                concept_name=b.concept_name,
                branch_title=b.branch_title,
                description=b.description,
                difficulty_level=b.difficulty_level,
                prerequisites=b.prerequisites,
                estimated_duration_minutes=b.estimated_duration_minutes,
                branch_order=b.branch_order,
                algorithm_version=ALGORITHM_VERSION,
                is_active=True,
            )
            db.add(row)
        db.commit()
        logger.info(f"Persisted {len(branches)} branches for '{concept_key}'")


branching_service = ConceptBranchingService()
