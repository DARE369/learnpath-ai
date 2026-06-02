"""
Expanded EQS scoring (Packet 3.3).

11 weighted criteria, 0-170 total points. Coexists with the legacy
EQSService (0-100 binary rubric) — old service still drives the search
pipeline and blacklist auto-trigger; this one feeds the confidence
dashboard and any future migration.

Score breakdown:
  Base (100 pts):
    pedagogy            40   structure, objectives, examples, summary
    clarity             30   narration, visuals, pacing, aids
    credibility         20   creator credentials, accuracy
    length              10   4-10 min sweet spot
  Bonus (70 pts):
    engagement          15   animations, interactions
    production          12   resolution, audio quality
    recency              8   recently updated
    accessibility       10   captions, descriptions
    student_feedback    10   high ratings
    curriculum_align     8   matches standards
    diversity            7   inclusive content

Confidence ladder (per spec):
  131+    outstanding   60-day cache
  101-130 excellent     30-60 day cache
   71-100 good          14-30 day cache
   51-70  acceptable     7-day cache
    0-50  poor          no cache (immediate re-eval)
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Dict, List, Optional

import anthropic
from sqlalchemy.orm import Session

from config import settings
from services.cost_tracker import cost_tracker, BudgetExceeded

if TYPE_CHECKING:
    from models import ExpandedVideoScore

logger = logging.getLogger(__name__)

ALGORITHM_VERSION = "expanded_v1"
OPUS_CHARGE_NGN = 0.20  # ~2-3 scores/day under default ₦0.50 cap

BASE_MAX = {
    "pedagogy": 40,
    "clarity": 30,
    "credibility": 20,
    "length": 10,
}

BONUS_MAX = {
    "engagement": 15,
    "production": 12,
    "recency": 8,
    "accessibility": 10,
    "student_feedback": 10,
    "curriculum_align": 8,
    "diversity": 7,
}

# Order matters for the prompt — keep it consistent so Claude's JSON keys
# always line up with our parser.
BASE_KEYS = list(BASE_MAX.keys())
BONUS_KEYS = list(BONUS_MAX.keys())

CONFIDENCE_LEVELS = [
    (131, "outstanding"),
    (101, "excellent"),
    (71, "good"),
    (51, "acceptable"),
    (0, "poor"),
]


def compute_confidence(total: int) -> str:
    for floor, level in CONFIDENCE_LEVELS:
        if total >= floor:
            return level
    return "poor"


def compute_cache_ttl(total: int) -> int:
    """Score-dependent TTL in days. 0 means 'do not cache, re-evaluate immediately.'"""
    if total >= 120:
        return 60
    if total >= 100:
        return 30
    if total >= 80:
        return 14
    if total >= 60:
        return 7
    return 0


class InvalidScoreResponse(ValueError):
    """Claude returned a malformed expanded-score JSON."""


@dataclass
class ExpandedScoreResult:
    youtube_id: str
    base_scores: Dict[str, int]
    bonus_scores: Dict[str, int]
    base_score: int        # 0-100
    bonus_total: int       # 0-70
    total_score: int       # 0-170
    confidence_level: str
    cache_ttl_days: int
    reasoning: str

    def to_dict(self) -> Dict:
        return {
            "youtube_id": self.youtube_id,
            "base_scores": self.base_scores,
            "bonus_scores": self.bonus_scores,
            "base_score": self.base_score,
            "bonus_total": self.bonus_total,
            "total_score": self.total_score,
            "confidence_level": self.confidence_level,
            "cache_ttl_days": self.cache_ttl_days,
            "reasoning": self.reasoning,
        }


class EQSExpandedService:
    def __init__(self):
        self.api_key = settings.CLAUDE_API_KEY
        self.model = "claude-opus-4-7"

    # ------------------------------------------------------------------
    # Prompt + parse
    # ------------------------------------------------------------------

    def _build_prompt(
        self,
        video_summary: str,
        title: str,
        transcript_excerpt: str = "",
    ) -> str:
        base_lines = "\n".join(
            f"  - {k} (0-{v})" for k, v in BASE_MAX.items()
        )
        bonus_lines = "\n".join(
            f"  - {k} (0-{v})" for k, v in BONUS_MAX.items()
        )
        excerpt_block = (
            f"\nTranscript excerpt:\n{transcript_excerpt[:2000]}\n"
            if transcript_excerpt
            else ""
        )
        return f"""You are an expert educational content evaluator.

Score this YouTube video on 11 weighted criteria. Every score is an integer
from 0 to its listed maximum. Be honest — most videos score well below the cap
on bonus criteria.

VIDEO TITLE: {title}

CONTENT SUMMARY:
{video_summary}
{excerpt_block}

Base criteria (max 100 total):
{base_lines}

Bonus criteria (max 70 total):
{bonus_lines}

Return EXACTLY this JSON shape, with NO commentary before or after:
{{
  "base_scores": {{
    "pedagogy": int,
    "clarity": int,
    "credibility": int,
    "length": int
  }},
  "bonus_scores": {{
    "engagement": int,
    "production": int,
    "recency": int,
    "accessibility": int,
    "student_feedback": int,
    "curriculum_align": int,
    "diversity": int
  }},
  "reasoning": "2-3 sentence justification"
}}"""

    def _parse(self, response_text: str) -> tuple[Dict[str, int], Dict[str, int], str]:
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if not json_match:
            raise InvalidScoreResponse("No JSON object found in Claude response")
        try:
            data = json.loads(json_match.group())
        except json.JSONDecodeError as e:
            raise InvalidScoreResponse(f"JSON parse failed: {e}")

        if "base_scores" not in data and "bonus_scores" not in data:
            raise InvalidScoreResponse(
                "Response is missing both base_scores and bonus_scores"
            )

        base = data.get("base_scores") or {}
        bonus = data.get("bonus_scores") or {}
        if not isinstance(base, dict) or not isinstance(bonus, dict):
            raise InvalidScoreResponse("base_scores/bonus_scores must be objects")

        # Coerce + clamp each sub-score to its declared max
        base_out: Dict[str, int] = {}
        for k, max_val in BASE_MAX.items():
            v = base.get(k, 0)
            try:
                base_out[k] = max(0, min(int(v), max_val))
            except (TypeError, ValueError):
                raise InvalidScoreResponse(f"base_scores.{k} not an integer: {v!r}")

        bonus_out: Dict[str, int] = {}
        for k, max_val in BONUS_MAX.items():
            v = bonus.get(k, 0)
            try:
                bonus_out[k] = max(0, min(int(v), max_val))
            except (TypeError, ValueError):
                raise InvalidScoreResponse(f"bonus_scores.{k} not an integer: {v!r}")

        reasoning = str(data.get("reasoning", "")).strip()
        return base_out, bonus_out, reasoning

    # ------------------------------------------------------------------
    # Scoring
    # ------------------------------------------------------------------

    async def evaluate_video_expanded(
        self,
        youtube_id: str,
        video_summary: str,
        title: str = "",
        transcript_excerpt: str = "",
    ) -> ExpandedScoreResult:
        """
        Score one video on the 11-criterion rubric. Budget-gated through
        cost_tracker — raises BudgetExceeded if the day's budget is spent.
        Raises InvalidScoreResponse if Claude returns malformed JSON.
        """
        if not self.api_key:
            raise ValueError("CLAUDE_API_KEY not configured")
        if not video_summary or len(video_summary.strip()) < 10:
            raise ValueError("video_summary too short to score reliably")

        cost_tracker.charge("eqs_expanded", OPUS_CHARGE_NGN)

        prompt = self._build_prompt(video_summary, title, transcript_excerpt)
        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        message = await client.messages.create(
            model=self.model,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        response_text = message.content[0].text

        base, bonus, reasoning = self._parse(response_text)
        base_total = sum(base.values())
        bonus_total = sum(bonus.values())
        total = base_total + bonus_total

        result = ExpandedScoreResult(
            youtube_id=youtube_id,
            base_scores=base,
            bonus_scores=bonus,
            base_score=base_total,
            bonus_total=bonus_total,
            total_score=total,
            confidence_level=compute_confidence(total),
            cache_ttl_days=compute_cache_ttl(total),
            reasoning=reasoning,
        )
        logger.info(
            f"Expanded EQS for {youtube_id}: total={total} "
            f"(base {base_total}/100, bonus {bonus_total}/70) — {result.confidence_level}"
        )
        return result

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def persist(self, db: Session, result: ExpandedScoreResult) -> "ExpandedVideoScore":
        """
        Write the score to expanded_video_scores. Invalidates any prior active
        row for the same youtube_id (audit trail kept via is_valid=False).
        """
        from models import ExpandedVideoScore

        db.query(ExpandedVideoScore).filter(
            ExpandedVideoScore.youtube_id == result.youtube_id,
            ExpandedVideoScore.is_valid.is_(True),
        ).update({"is_valid": False}, synchronize_session=False)

        now = datetime.utcnow()
        next_eval = (
            now + timedelta(days=result.cache_ttl_days)
            if result.cache_ttl_days > 0
            else None
        )
        row = ExpandedVideoScore(
            youtube_id=result.youtube_id,
            base_scores=result.base_scores,
            bonus_scores=result.bonus_scores,
            base_score=result.base_score,
            total_score=result.total_score,
            confidence_level=result.confidence_level,
            cache_ttl_days=result.cache_ttl_days,
            reasoning=result.reasoning,
            algorithm_version=ALGORITHM_VERSION,
            is_valid=True,
            evaluated_at=now,
            next_reevaluation_at=next_eval,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    # ------------------------------------------------------------------
    # Reads (dashboard)
    # ------------------------------------------------------------------

    def list_scores(
        self,
        db: Session,
        confidence_level: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict]:
        from models import ExpandedVideoScore
        q = db.query(ExpandedVideoScore).filter(ExpandedVideoScore.is_valid.is_(True))
        if confidence_level:
            q = q.filter(ExpandedVideoScore.confidence_level == confidence_level)
        rows = (
            q.order_by(ExpandedVideoScore.total_score.desc())
            .limit(limit)
            .offset(offset)
            .all()
        )
        return [
            {
                "id": str(r.id),
                "youtube_id": r.youtube_id,
                "base_scores": r.base_scores or {},
                "bonus_scores": r.bonus_scores or {},
                "base_score": r.base_score,
                "bonus_total": sum((r.bonus_scores or {}).values()),
                "total_score": r.total_score,
                "confidence_level": r.confidence_level,
                "cache_ttl_days": r.cache_ttl_days,
                "reasoning": r.reasoning,
                "evaluated_at": r.evaluated_at.isoformat() if r.evaluated_at else None,
                "next_reevaluation_at": (
                    r.next_reevaluation_at.isoformat() if r.next_reevaluation_at else None
                ),
            }
            for r in rows
        ]

    def stats(self, db: Session) -> Dict:
        from models import ExpandedVideoScore
        q = db.query(ExpandedVideoScore).filter(ExpandedVideoScore.is_valid.is_(True))
        rows = q.all()
        total = len(rows)
        if not total:
            return {
                "total_scored": 0,
                "average_score": None,
                "median_score": None,
                "distribution": {k: 0 for _, k in CONFIDENCE_LEVELS},
                "criteria_averages": {},
                "cache_distribution": {},
            }

        scores = sorted(r.total_score for r in rows)
        avg = sum(scores) / total
        median = (
            scores[total // 2]
            if total % 2
            else (scores[total // 2 - 1] + scores[total // 2]) / 2
        )

        distribution: Dict[str, int] = {k: 0 for _, k in CONFIDENCE_LEVELS}
        cache_distribution: Dict[str, int] = {}
        criteria_sums: Dict[str, int] = {k: 0 for k in BASE_KEYS + BONUS_KEYS}
        criteria_counts: Dict[str, int] = {k: 0 for k in BASE_KEYS + BONUS_KEYS}

        for r in rows:
            distribution[r.confidence_level] = distribution.get(r.confidence_level, 0) + 1
            ttl_key = f"{r.cache_ttl_days}d"
            cache_distribution[ttl_key] = cache_distribution.get(ttl_key, 0) + 1

            base = r.base_scores or {}
            bonus = r.bonus_scores or {}
            for k in BASE_KEYS:
                if k in base:
                    criteria_sums[k] += int(base[k])
                    criteria_counts[k] += 1
            for k in BONUS_KEYS:
                if k in bonus:
                    criteria_sums[k] += int(bonus[k])
                    criteria_counts[k] += 1

        criteria_averages = {
            k: round(criteria_sums[k] / criteria_counts[k], 2)
            for k in BASE_KEYS + BONUS_KEYS
            if criteria_counts[k] > 0
        }

        return {
            "total_scored": total,
            "average_score": round(avg, 2),
            "median_score": median,
            "distribution": distribution,
            "criteria_averages": criteria_averages,
            "cache_distribution": cache_distribution,
        }


eqs_expanded_service = EQSExpandedService()
