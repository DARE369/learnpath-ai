"""
Self-building expansion service (Packet 3.5).

Nightly job (or admin-triggered) that:
  1. Scans last-30-day search_events for distinct queries.
  2. Asks Claude Opus to semantically cluster them (one call, ₦0.20).
     Writes TopicAlias rows for non-canonical queries.
  3. Identifies popular topics (>10 searches/30d).
  4. Extracts 3-5 keywords per popular topic via Claude (₦0.03/topic).
  5. Auto-expands popular topics by delegating to branching_service.

Costs are split:
  - expansion budget: dedup clustering call + per-topic keyword calls
  - branching budget: branch generation (owned by branching_service)

The expansion budget short-circuits each step independently — if dedup
exhausts the budget, keyword extraction and expansion skip the LLM calls
but the job still completes with partial counts.

NOTE: alias mappings are stored but NOT applied — SearchService is unchanged
this packet. A human reviewer can validate aliases in the admin dashboard
before any auto-redirect behavior is wired in a follow-up.
"""

import asyncio
import json
import logging
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import anthropic
from sqlalchemy import func
from sqlalchemy.orm import Session

from config import settings
from services.cost_tracker import BudgetExceeded, cost_tracker

logger = logging.getLogger(__name__)

CLAUDE_MODEL = "claude-opus-4-7"
POPULAR_THRESHOLD = 10            # >10 searches in window = popular
LOOKBACK_DAYS = 30
DEDUP_CHARGE_NGN = 0.20
KEYWORD_CHARGE_NGN = 0.03
KEYWORDS_PER_TOPIC = 5
ALGORITHM_VERSION = "expansion_v1"


# ---------------------------------------------------------------------------
# Prompt builders
# ---------------------------------------------------------------------------

def _build_dedup_prompt(queries: List[str]) -> str:
    queries_list = "\n".join(f"- {q}" for q in queries)
    return f"""You are an expert at recognising when two search queries describe the
same educational topic — even when worded differently.

Below is a list of recent learner search queries. Group queries that refer
to the SAME underlying topic. Pick the most concise/canonical wording as
the group's canonical query.

Queries:
{queries_list}

Return EXACTLY this JSON, with NO commentary:
{{
  "groups": [
    {{
      "canonical": "photosynthesis",
      "aliases": ["how plants make food", "photosynthesis process"],
      "confidence": 0.95
    }}
  ]
}}

Rules:
- canonical and aliases all come from the input list verbatim (don't invent)
- a group with no aliases (single member) MUST be omitted
- confidence is your 0-1 sureness that these all describe the same topic
- if a query stands alone, leave it out of the response entirely"""


def _build_keywords_prompt(topic: str, count: int = KEYWORDS_PER_TOPIC) -> str:
    return f"""Extract {count} short keywords for the educational topic "{topic}".
Keywords should be single words or 2-word phrases — concepts a learner would
search to find related material.

Return EXACTLY this JSON, no commentary:
{{"keywords": ["keyword1", "keyword2", "keyword3"]}}"""


def _extract_json(text: str) -> Optional[Dict]:
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group())
    except json.JSONDecodeError:
        return None


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class ExpansionService:
    def __init__(self):
        self.api_key = settings.CLAUDE_API_KEY

    # ------------------------------------------------------------------
    # Step 1: scan search events for the lookback window
    # ------------------------------------------------------------------

    def distinct_queries_in_window(self, db: Session, days: int = LOOKBACK_DAYS) -> List[Tuple[str, int]]:
        """Return [(query_normalized, count)] within the lookback window."""
        from models import SearchEvent
        cutoff = datetime.utcnow() - timedelta(days=days)
        rows = (
            db.query(
                SearchEvent.query_normalized,
                func.count(SearchEvent.id).label("count"),
            )
            .filter(SearchEvent.created_at >= cutoff)
            .group_by(SearchEvent.query_normalized)
            .order_by(func.count(SearchEvent.id).desc())
            .all()
        )
        return [(r.query_normalized, int(r.count)) for r in rows]

    # ------------------------------------------------------------------
    # Step 2: dedupe via Claude semantic clustering
    # ------------------------------------------------------------------

    async def _cluster_queries(self, queries: List[str]) -> List[Dict]:
        if not self.api_key:
            raise ValueError("CLAUDE_API_KEY not configured")
        if len(queries) < 2:
            return []
        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        message = await client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": _build_dedup_prompt(queries)}],
        )
        data = _extract_json(message.content[0].text) or {}
        groups = data.get("groups") or []
        cleaned: List[Dict] = []
        for g in groups:
            canonical = str(g.get("canonical", "")).strip().lower()
            aliases = [str(a).strip().lower() for a in g.get("aliases") or [] if a]
            aliases = [a for a in aliases if a and a != canonical]
            try:
                confidence = float(g.get("confidence", 0.5))
            except (TypeError, ValueError):
                confidence = 0.5
            if canonical and aliases:
                cleaned.append({
                    "canonical": canonical,
                    "aliases": aliases,
                    "confidence": max(0.0, min(1.0, confidence)),
                })
        return cleaned

    async def deduplicate_topics(self, db: Session) -> Dict:
        """
        Run one dedup pass over the last LOOKBACK_DAYS. Writes TopicAlias rows.
        Returns {duplicates_found, merged, groups, distinct_scanned}.
        Idempotent: existing active aliases for the same alias_query are
        deactivated before the new ones are written.
        """
        from models import TopicAlias
        queries_with_counts = self.distinct_queries_in_window(db)
        distinct_scanned = len(queries_with_counts)
        if distinct_scanned < 2:
            return {
                "duplicates_found": 0,
                "merged": 0,
                "groups": 0,
                "distinct_scanned": distinct_scanned,
            }

        queries = [q for q, _ in queries_with_counts]

        cost_tracker.charge("expansion", DEDUP_CHARGE_NGN)
        groups = await self._cluster_queries(queries)
        if not groups:
            return {
                "duplicates_found": 0,
                "merged": 0,
                "groups": 0,
                "distinct_scanned": distinct_scanned,
            }

        # Deactivate any prior aliases for the alias_query values we're about
        # to (re-)write — keeps an audit trail without duplicating rows.
        new_alias_queries = {a for g in groups for a in g["aliases"]}
        if new_alias_queries:
            db.query(TopicAlias).filter(
                TopicAlias.alias_query.in_(new_alias_queries),
                TopicAlias.is_active.is_(True),
            ).update({"is_active": False}, synchronize_session=False)

        merged = 0
        for g in groups:
            for alias in g["aliases"]:
                db.add(TopicAlias(
                    alias_query=alias,
                    canonical_query=g["canonical"],
                    similarity_score=g["confidence"],
                    is_active=True,
                ))
                merged += 1
        db.commit()

        return {
            "duplicates_found": merged,
            "merged": merged,
            "groups": len(groups),
            "distinct_scanned": distinct_scanned,
        }

    # ------------------------------------------------------------------
    # Step 3: identify popular topics
    # ------------------------------------------------------------------

    def identify_popular_topics(
        self,
        db: Session,
        threshold: int = POPULAR_THRESHOLD,
        days: int = LOOKBACK_DAYS,
    ) -> List[Dict]:
        """Queries with > threshold searches in the lookback window."""
        rows = self.distinct_queries_in_window(db, days=days)
        return [{"query": q, "count": c} for q, c in rows if c > threshold]

    # ------------------------------------------------------------------
    # Step 4: keyword extraction
    # ------------------------------------------------------------------

    async def extract_keywords(self, topic: str) -> List[str]:
        """One Claude call → 3–5 keywords. Caller must charge the budget."""
        if not self.api_key:
            raise ValueError("CLAUDE_API_KEY not configured")
        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        message = await client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=400,
            messages=[{"role": "user", "content": _build_keywords_prompt(topic)}],
        )
        data = _extract_json(message.content[0].text) or {}
        raw = data.get("keywords", [])
        cleaned = []
        if isinstance(raw, list):
            for k in raw[:KEYWORDS_PER_TOPIC]:
                if isinstance(k, str) and k.strip():
                    cleaned.append(k.strip().lower())
        return cleaned

    def _persist_keywords(self, db: Session, topic: str, keywords: List[str]) -> int:
        from models import TopicKeyword
        topic_key = topic.lower().strip()
        # Replace any prior keyword index for this topic
        db.query(TopicKeyword).filter(TopicKeyword.topic_query == topic_key).delete(
            synchronize_session=False
        )
        for k in keywords:
            db.add(TopicKeyword(topic_query=topic_key, keyword=k))
        db.commit()
        return len(keywords)

    async def index_keywords_for_topics(
        self,
        db: Session,
        topics: List[str],
    ) -> Dict:
        """
        Extract + persist keywords for each topic. Stops early when the
        `expansion` budget exhausts; returns {indexed, skipped_budget, errors}.
        """
        indexed = 0
        skipped = 0
        errors: List[str] = []
        for topic in topics:
            try:
                cost_tracker.charge("expansion", KEYWORD_CHARGE_NGN)
            except BudgetExceeded:
                skipped = len(topics) - indexed
                break
            try:
                kws = await self.extract_keywords(topic)
                if kws:
                    self._persist_keywords(db, topic, kws)
                    indexed += 1
            except Exception as e:
                errors.append(f"{topic}: {e}")
                logger.warning(f"Keyword extraction failed for '{topic}': {e}")
        return {"indexed": indexed, "skipped_budget": skipped, "errors": errors}

    # ------------------------------------------------------------------
    # Step 5: auto-expand popular topics via branching_service
    # ------------------------------------------------------------------

    async def auto_expand_topic(self, db: Session, topic_name: str) -> Dict:
        """
        Generate concept branches for a single topic using branching_service.
        Charged against the branching budget (not expansion). Returns
        {topic, branch_count, error}.
        """
        from services.branching_service import branching_service, InvalidBranchSet

        try:
            branches = await branching_service.generate_branches(
                concept_name=topic_name,
                base_concept_summary=(
                    f"Auto-expansion: generate progressive learning branches "
                    f"for '{topic_name}'."
                ),
                db=db,
            )
            return {"topic": topic_name, "branch_count": len(branches), "error": None}
        except BudgetExceeded as e:
            return {"topic": topic_name, "branch_count": 0, "error": f"budget: {e}"}
        except InvalidBranchSet as e:
            return {"topic": topic_name, "branch_count": 0, "error": f"invalid: {e}"}
        except Exception as e:
            return {"topic": topic_name, "branch_count": 0, "error": str(e)}

    async def expand_topics(self, db: Session, topics: List[str]) -> Dict:
        results: List[Dict] = []
        for topic in topics:
            results.append(await self.auto_expand_topic(db, topic))
        return {
            "expanded": sum(1 for r in results if r["branch_count"] > 0),
            "attempted": len(results),
            "results": results,
        }

    # ------------------------------------------------------------------
    # Orchestrator
    # ------------------------------------------------------------------

    async def run_nightly_job(self, db: Session) -> Dict:
        """
        Full nightly pipeline. Writes a NightlyRun row covering start, end,
        per-step counts, costs charged, errors, and status (success / partial
        / failed). Each step degrades gracefully on its own budget / API
        failures — the job always finishes and always logs.
        """
        from models import NightlyRun

        # Snapshot starting balances so we can report what THIS run spent.
        expansion_start = cost_tracker.budget("expansion") - cost_tracker.remaining("expansion")
        branching_start = cost_tracker.budget("branching") - cost_tracker.remaining("branching")

        run = NightlyRun(status="running")
        db.add(run)
        db.commit()
        db.refresh(run)

        started = datetime.utcnow()
        errors: List[str] = []
        budget_skipped = False

        # ----- Step 1: dedup -----
        dedup_result = {
            "duplicates_found": 0, "merged": 0, "groups": 0, "distinct_scanned": 0,
        }
        try:
            dedup_result = await self.deduplicate_topics(db)
        except BudgetExceeded as e:
            budget_skipped = True
            errors.append(f"dedup: {e}")
        except Exception as e:
            errors.append(f"dedup: {e}")
            logger.exception("Dedup step failed")

        # ----- Step 2: popular topics -----
        try:
            popular = self.identify_popular_topics(db)
        except Exception as e:
            errors.append(f"popular: {e}")
            popular = []

        popular_queries = [p["query"] for p in popular]

        # ----- Step 3: keyword indexing -----
        kw_result = {"indexed": 0, "skipped_budget": 0, "errors": []}
        if popular_queries:
            try:
                kw_result = await self.index_keywords_for_topics(db, popular_queries)
                if kw_result["skipped_budget"]:
                    budget_skipped = True
                errors.extend(kw_result["errors"])
            except Exception as e:
                errors.append(f"keywords: {e}")
                logger.exception("Keyword step failed")

        # ----- Step 4: auto-expand -----
        exp_result = {"expanded": 0, "attempted": 0, "results": []}
        if popular_queries:
            try:
                exp_result = await self.expand_topics(db, popular_queries)
                for r in exp_result["results"]:
                    if r["error"] and "budget" in r["error"]:
                        budget_skipped = True
                    if r["error"]:
                        errors.append(f"expand[{r['topic']}]: {r['error']}")
            except Exception as e:
                errors.append(f"expand: {e}")
                logger.exception("Expansion step failed")

        # ----- Finalise the run record -----
        finished = datetime.utcnow()
        expansion_end = cost_tracker.budget("expansion") - cost_tracker.remaining("expansion")
        branching_end = cost_tracker.budget("branching") - cost_tracker.remaining("branching")

        run.finished_at = finished
        run.duration_seconds = round((finished - started).total_seconds(), 2)
        run.distinct_queries_scanned = dedup_result["distinct_scanned"]
        run.aliases_created = dedup_result["merged"]
        run.popular_topics_count = len(popular_queries)
        run.keywords_extracted = kw_result["indexed"]
        run.topics_expanded = exp_result["expanded"]
        run.expansion_cost_ngn = round(max(0.0, expansion_end - expansion_start), 4)
        run.branching_cost_ngn = round(max(0.0, branching_end - branching_start), 4)
        run.skipped_budget = budget_skipped
        run.errors = errors[:50]  # cap to avoid huge JSON blobs
        if errors and exp_result["expanded"] == 0 and kw_result["indexed"] == 0:
            run.status = "failed"
        elif errors or budget_skipped:
            run.status = "partial"
        else:
            run.status = "success"
        db.commit()
        db.refresh(run)

        return {
            "run_id": str(run.id),
            "status": run.status,
            "duration_seconds": run.duration_seconds,
            "distinct_queries_scanned": run.distinct_queries_scanned,
            "aliases_created": run.aliases_created,
            "popular_topics_count": run.popular_topics_count,
            "keywords_extracted": run.keywords_extracted,
            "topics_expanded": run.topics_expanded,
            "expansion_cost_ngn": run.expansion_cost_ngn,
            "branching_cost_ngn": run.branching_cost_ngn,
            "skipped_budget": run.skipped_budget,
            "errors": run.errors,
            "popular_queries": popular_queries,
        }

    # ------------------------------------------------------------------
    # Dashboard reads
    # ------------------------------------------------------------------

    def recent_runs(self, db: Session, limit: int = 10) -> List[Dict]:
        from models import NightlyRun
        rows = (
            db.query(NightlyRun)
            .order_by(NightlyRun.started_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": str(r.id),
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "finished_at": r.finished_at.isoformat() if r.finished_at else None,
                "duration_seconds": r.duration_seconds,
                "distinct_queries_scanned": r.distinct_queries_scanned,
                "aliases_created": r.aliases_created,
                "popular_topics_count": r.popular_topics_count,
                "keywords_extracted": r.keywords_extracted,
                "topics_expanded": r.topics_expanded,
                "expansion_cost_ngn": r.expansion_cost_ngn,
                "branching_cost_ngn": r.branching_cost_ngn,
                "skipped_budget": r.skipped_budget,
                "errors": r.errors or [],
                "status": r.status,
            }
            for r in rows
        ]

    def list_aliases(self, db: Session, limit: int = 100) -> List[Dict]:
        from models import TopicAlias
        rows = (
            db.query(TopicAlias)
            .filter(TopicAlias.is_active.is_(True))
            .order_by(TopicAlias.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": str(r.id),
                "alias_query": r.alias_query,
                "canonical_query": r.canonical_query,
                "similarity_score": r.similarity_score,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]

    def list_keywords(self, db: Session, topic: Optional[str] = None) -> Dict[str, List[str]]:
        from models import TopicKeyword
        q = db.query(TopicKeyword)
        if topic:
            q = q.filter(TopicKeyword.topic_query == topic.lower().strip())
        rows = q.order_by(TopicKeyword.topic_query).all()
        grouped: Dict[str, List[str]] = {}
        for r in rows:
            grouped.setdefault(r.topic_query, []).append(r.keyword)
        return grouped


expansion_service = ExpansionService()
