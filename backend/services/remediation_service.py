"""
Auto-remediation service (Packet 3.4).

When a path's average EQS score is below 60 (low confidence), the user can
opt into a remediation pass that tries up to three tiers of alternatives:

  Tier 1 — Claude Opus suggests 2-3 alternate query phrasings; each runs
           through the existing SearchService; pick the highest-scoring path.
  Tier 2 — Gemini suggests 2-3 alternate query phrasings; same shape as
           Tier 1 but uses a different model for diversity. Lazy-imports
           google.generativeai so CI without the SDK still loads.
  Tier 3 — No improvement available. Return the original path with a
           "best we have" flag so the UI can degrade gracefully.

Each tier charges cost_tracker.charge("remediation", ...) before its LLM call.
If the day's budget exhausts, the tier is skipped and we fall through.

Every attempt writes a RemediationEvent row for the stats endpoint.
"""

import asyncio
import json
import logging
import re
import time
from typing import Dict, List, Optional, Tuple

import anthropic
from sqlalchemy import func
from sqlalchemy.orm import Session

from config import settings
from services.cost_tracker import BudgetExceeded, cost_tracker

logger = logging.getLogger(__name__)

LOW_CONFIDENCE_THRESHOLD = 60
VARIANT_COUNT = 3
TIER_1_CHARGE_NGN = 0.10      # per variant
TIER_2_CHARGE_NGN = 0.15      # per variant
MAX_VARIANT_TIMEOUT_SEC = 30  # bound per variant search

CLAUDE_MODEL = "claude-opus-4-7"
GEMINI_MODEL = "gemini-1.5-pro"


class _NoImprovement(Exception):
    """A tier ran but couldn't improve on the original score."""


# ---------------------------------------------------------------------------
# Variant prompt — small, structured JSON
# ---------------------------------------------------------------------------

def _build_variant_prompt(query: str, count: int = VARIANT_COUNT) -> str:
    return f"""You are an educational content search expert.

The query "{query}" returned low-quality videos. Suggest {count} alternate
phrasings that might surface better educational content. Each variant should
be a distinct rewording — different angle, different specificity, different
target audience — not a synonym dance.

Return EXACTLY this JSON, with no commentary:
{{"variants": ["variant 1", "variant 2", "variant 3"]}}"""


def _parse_variants(text: str, max_count: int = VARIANT_COUNT) -> List[str]:
    json_match = re.search(r'\{.*\}', text, re.DOTALL)
    if not json_match:
        return []
    try:
        data = json.loads(json_match.group())
    except json.JSONDecodeError:
        return []
    variants = data.get("variants", [])
    if not isinstance(variants, list):
        return []
    cleaned = []
    for v in variants[:max_count]:
        if isinstance(v, str) and v.strip():
            cleaned.append(v.strip())
    return cleaned


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class RemediationService:
    def __init__(self):
        self.claude_api_key = settings.CLAUDE_API_KEY
        self.gemini_api_key = settings.GOOGLE_GEMINI_API_KEY

    # ------------------------------------------------------------------
    # Detection
    # ------------------------------------------------------------------

    def detect_low_confidence(self, score: float, threshold: int = LOW_CONFIDENCE_THRESHOLD) -> bool:
        """True if the path's average score is below the remediation threshold."""
        try:
            return float(score) < threshold
        except (TypeError, ValueError):
            return False

    # ------------------------------------------------------------------
    # Tier 1 — Claude
    # ------------------------------------------------------------------

    async def _claude_variants(self, query: str) -> List[str]:
        if not self.claude_api_key:
            return []
        client = anthropic.AsyncAnthropic(api_key=self.claude_api_key)
        message = await client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=400,
            messages=[{"role": "user", "content": _build_variant_prompt(query)}],
        )
        return _parse_variants(message.content[0].text)

    # ------------------------------------------------------------------
    # Tier 2 — Gemini (lazy-imported)
    # ------------------------------------------------------------------

    async def _gemini_variants(self, query: str) -> List[str]:
        if not self.gemini_api_key:
            logger.info("Gemini API key not set — skipping Tier 2 variant generation")
            return []
        try:
            import google.generativeai as genai  # type: ignore  # lazy import
        except ImportError:
            logger.info("google-generativeai SDK not installed — skipping Tier 2")
            return []

        genai.configure(api_key=self.gemini_api_key)
        model = genai.GenerativeModel(GEMINI_MODEL)
        prompt = _build_variant_prompt(query)

        # google-generativeai's generate_content is sync; offload to a thread so
        # we don't block the FastAPI event loop.
        def _sync_call() -> str:
            response = model.generate_content(prompt)
            return getattr(response, "text", "") or ""

        try:
            text = await asyncio.to_thread(_sync_call)
        except Exception as e:
            logger.warning(f"Gemini variant call failed: {e}")
            return []
        return _parse_variants(text)

    # ------------------------------------------------------------------
    # Variant -> path
    # ------------------------------------------------------------------

    async def _score_one_variant(self, search_service, variant: str, user_id: Optional[str], db: Session) -> Optional[Dict]:
        """Run a single variant through SearchService with a hard timeout."""
        try:
            result = await asyncio.wait_for(
                search_service.search_and_build_path(
                    query=variant,
                    use_cache=False,
                    user_id=user_id,
                    db=db,
                ),
                timeout=MAX_VARIANT_TIMEOUT_SEC,
            )
        except asyncio.TimeoutError:
            logger.info(f"Variant search timed out: '{variant}'")
            return None
        except ValueError as e:
            logger.info(f"Variant search rejected '{variant}': {e}")
            return None
        except Exception as e:
            logger.warning(f"Variant search failed '{variant}': {e}")
            return None

        path = result.get("path") or {}
        return {
            "variant_query": variant,
            "path": path,
            "score": float(path.get("average_score") or 0),
            "source": result.get("source", "generated"),
        }

    async def _try_variant_tier(
        self,
        search_service,
        variants: List[str],
        original_score: float,
        user_id: Optional[str],
        db: Session,
    ) -> Optional[Dict]:
        """Score each variant, return the best one that beats the original."""
        if not variants:
            return None
        attempts: List[Dict] = []
        for variant in variants:
            scored = await self._score_one_variant(search_service, variant, user_id, db)
            if scored is not None:
                attempts.append(scored)
        if not attempts:
            return None
        best = max(attempts, key=lambda a: a["score"])
        if best["score"] <= original_score:
            return None
        return best

    # ------------------------------------------------------------------
    # Top-level orchestrator
    # ------------------------------------------------------------------

    async def auto_remediate(
        self,
        query: str,
        original_score: float,
        original_path: Dict,
        db: Session,
        search_service,
        user_id: Optional[str] = None,
    ) -> Dict:
        """
        Run the three-tier fallback. Returns a dict the router serialises:
          {
            success: bool,
            tier_used: "tier_1" | "tier_2" | "tier_3",
            path: <path dict>,
            original_score, remediated_score,
            variant_query?: str,
            notification: {state, message},
            duration_seconds,
          }
        Always writes a RemediationEvent row.
        """
        start = time.perf_counter()
        tier_used = "tier_3"
        success = False
        chosen_path = original_path
        chosen_score = float(original_score)
        variant_query: Optional[str] = None
        notes: List[str] = []

        # ----------------- Tier 1 — Claude variants -----------------
        try:
            cost_tracker.charge("remediation", TIER_1_CHARGE_NGN * VARIANT_COUNT)
            variants = await self._claude_variants(query)
            if variants:
                logger.info(f"Tier 1 variants: {variants}")
                best = await self._try_variant_tier(
                    search_service, variants, original_score, user_id, db
                )
                if best:
                    chosen_path = best["path"]
                    chosen_score = best["score"]
                    variant_query = best["variant_query"]
                    tier_used = "tier_1"
                    success = True
            else:
                notes.append("Tier 1 returned no variants")
        except BudgetExceeded:
            notes.append("Tier 1 skipped: budget exhausted")
            logger.warning("Tier 1 skipped — remediation budget exhausted")
        except Exception as e:
            notes.append(f"Tier 1 error: {e}")
            logger.warning(f"Tier 1 failed: {e}")

        # ----------------- Tier 2 — Gemini variants -----------------
        if not success:
            try:
                cost_tracker.charge("remediation", TIER_2_CHARGE_NGN * VARIANT_COUNT)
                variants = await self._gemini_variants(query)
                if variants:
                    logger.info(f"Tier 2 variants: {variants}")
                    best = await self._try_variant_tier(
                        search_service, variants, original_score, user_id, db
                    )
                    if best:
                        chosen_path = best["path"]
                        chosen_score = best["score"]
                        variant_query = best["variant_query"]
                        tier_used = "tier_2"
                        success = True
                else:
                    notes.append("Tier 2 returned no variants")
            except BudgetExceeded:
                notes.append("Tier 2 skipped: budget exhausted")
                logger.warning("Tier 2 skipped — remediation budget exhausted")
            except Exception as e:
                notes.append(f"Tier 2 error: {e}")
                logger.warning(f"Tier 2 failed: {e}")

        # ----------------- Tier 3 — original is our best -----------------
        # tier_used is already "tier_3" from initialisation.

        duration_ms = int((time.perf_counter() - start) * 1000)

        # Build notification payload — the client uses this to render copy.
        notification = self._build_notification(tier_used, success, chosen_score, original_score)

        # Persist the event (best-effort)
        try:
            self._record_event(
                db,
                query_normalized=query.lower().strip(),
                user_id=user_id,
                original_score=int(original_score),
                remediated_score=int(chosen_score),
                tier_used=tier_used,
                success=success,
                duration_ms=duration_ms,
                notes="; ".join(notes) if notes else None,
            )
        except Exception as e:
            logger.error(f"Failed to record remediation event: {e}")

        return {
            "success": success,
            "tier_used": tier_used,
            "path": chosen_path,
            "original_score": int(original_score),
            "remediated_score": int(chosen_score),
            "variant_query": variant_query,
            "notification": notification,
            "duration_seconds": round(duration_ms / 1000, 2),
        }

    # ------------------------------------------------------------------
    # Notification payload (spec's notify_user shim)
    # ------------------------------------------------------------------

    def _build_notification(
        self,
        tier_used: str,
        success: bool,
        new_score: float,
        original_score: float,
    ) -> Dict[str, str]:
        if success and tier_used == "tier_1":
            return {
                "state": "success",
                "message": (
                    f"Found better videos via alternate Claude query. "
                    f"Score lifted from {int(original_score)} to {int(new_score)}."
                ),
            }
        if success and tier_used == "tier_2":
            return {
                "state": "success",
                "message": (
                    f"Found better videos via Gemini-suggested query. "
                    f"Score lifted from {int(original_score)} to {int(new_score)}."
                ),
            }
        return {
            "state": "fallback",
            "message": (
                "No better content available — using the original path. "
                "Try a different topic phrasing or check back later."
            ),
        }

    # ------------------------------------------------------------------
    # Persistence + stats
    # ------------------------------------------------------------------

    def _record_event(
        self,
        db: Session,
        *,
        query_normalized: str,
        user_id: Optional[str],
        original_score: int,
        remediated_score: int,
        tier_used: str,
        success: bool,
        duration_ms: int,
        notes: Optional[str],
    ) -> None:
        from models import RemediationEvent
        import uuid as _uuid

        user_uuid = None
        if user_id:
            try:
                user_uuid = _uuid.UUID(str(user_id))
            except (ValueError, TypeError):
                user_uuid = None

        db.add(RemediationEvent(
            query_normalized=query_normalized,
            user_id=user_uuid,
            original_score=original_score,
            remediated_score=remediated_score,
            tier_used=tier_used,
            success=success,
            duration_ms=duration_ms,
            notes=notes,
        ))
        db.commit()

    def get_remediation_stats(self, db: Session) -> Dict:
        from models import RemediationEvent

        total = db.query(RemediationEvent).count()
        if total == 0:
            return {
                "total": 0,
                "success_rate": None,
                "avg_duration_seconds": None,
                "by_tier": {},
                "top_remediated_queries": [],
            }

        successful = db.query(RemediationEvent).filter(RemediationEvent.success.is_(True)).count()
        avg_ms = db.query(func.avg(RemediationEvent.duration_ms)).scalar() or 0

        # Per-tier breakdown — two queries instead of a CAST(bool AS int) which
        # behaves differently across PostgreSQL and SQLite.
        tier_rows = (
            db.query(
                RemediationEvent.tier_used,
                func.count(RemediationEvent.id).label("count"),
            )
            .group_by(RemediationEvent.tier_used)
            .all()
        )
        success_rows = (
            db.query(
                RemediationEvent.tier_used,
                func.count(RemediationEvent.id).label("successes"),
            )
            .filter(RemediationEvent.success.is_(True))
            .group_by(RemediationEvent.tier_used)
            .all()
        )
        successes_by_tier = {r.tier_used: int(r.successes) for r in success_rows}
        by_tier = {
            r.tier_used: {
                "count": int(r.count),
                "successes": successes_by_tier.get(r.tier_used, 0),
                "success_rate": (
                    round(successes_by_tier.get(r.tier_used, 0) / r.count, 3)
                    if r.count else 0
                ),
            }
            for r in tier_rows
        }

        # Top queries by remediation count
        top_rows = (
            db.query(
                RemediationEvent.query_normalized,
                func.count(RemediationEvent.id).label("count"),
            )
            .group_by(RemediationEvent.query_normalized)
            .order_by(func.count(RemediationEvent.id).desc())
            .limit(10)
            .all()
        )
        top = [{"query": r.query_normalized, "count": int(r.count)} for r in top_rows]

        return {
            "total": total,
            "success_rate": round(successful / total, 3),
            "avg_duration_seconds": round(float(avg_ms) / 1000, 2),
            "by_tier": by_tier,
            "top_remediated_queries": top,
        }


remediation_service = RemediationService()
