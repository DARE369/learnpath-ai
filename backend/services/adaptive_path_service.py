"""
Adaptive learning paths (NEW-PACKET-H).

Generates a personalized path from the concept knowledge graph (NEW-PACKET-G):
the goal concept plus its prerequisite chain, ordered easy->hard, skipping
concepts the user has already mastered (ConceptMastery). The path then adapts
from real performance (ModulePerformance): difficulty up/down toward the ~65-70%
optimal band, pacing signals, and prerequisite-gap detection. Forecast is a
simple pace projection. (The spec's sklearn model is decorative and omitted.)
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from models import (
    Concept, ConceptRelationship, ConceptMastery,
    AdaptivePath, PathModule, ModulePerformance, PathAdaptation,
)

logger = logging.getLogger(__name__)

_DIFF_ORDER = ["easy", "medium", "hard"]


def _difficulty_label(level: Optional[int]) -> str:
    lvl = level or 5
    return "easy" if lvl <= 3 else ("medium" if lvl <= 7 else "hard")


class AdaptivePathService:

    # ── prerequisite chain (no recursion explosion; visited set) ─────────────

    def _prereq_chain(self, db: Session, goal_id: str) -> List[Concept]:
        ordered: List[Concept] = []
        seen = set()
        stack = [goal_id]
        while stack:
            cid = stack.pop()
            rels = (
                db.query(ConceptRelationship)
                .filter(
                    ConceptRelationship.source_concept_id == cid,
                    ConceptRelationship.relationship_type == "prerequisite",
                )
                .all()
            )
            for r in rels:
                tid = str(r.target_concept_id)
                if tid in seen:
                    continue
                seen.add(tid)
                pre = db.query(Concept).filter(Concept.id == tid).first()
                if pre:
                    ordered.append(pre)
                    stack.append(tid)
        return ordered

    # ── create ───────────────────────────────────────────────────────────────

    def create_path(self, db: Session, user_id, goal_concept_id: str,
                    target_weeks: int = 12) -> Dict:
        goal = db.query(Concept).filter(Concept.id == goal_concept_id).first()
        if not goal:
            raise ValueError("Goal concept not found")

        # Mastered concept names for this user (skip those).
        mastered = {
            m.concept_id
            for m in db.query(ConceptMastery).filter(
                ConceptMastery.user_id == user_id, ConceptMastery.is_mastered.is_(True)
            ).all()
        }

        chain = self._prereq_chain(db, goal_concept_id)
        # Prerequisites easy->hard, then the goal last.
        chain_sorted = sorted(chain, key=lambda c: c.difficulty_level or 5)
        concepts = [c for c in chain_sorted if c.concept_name not in mastered]
        concepts.append(goal)

        path = AdaptivePath(
            user_id=user_id,
            path_name=f"{goal.display_name or goal.concept_name} Path",
            goal_concept_id=goal.id,
            target_completion_weeks=target_weeks,
            original_end_date=(datetime.utcnow() + timedelta(weeks=target_weeks)).date(),
        )
        db.add(path)
        db.flush()

        n = 0
        for c in concepts:
            diff = _difficulty_label(c.difficulty_level)
            # lesson + quiz per concept
            n += 1
            db.add(PathModule(
                adaptive_path_id=path.id, module_number=n,
                module_title=f"Learn: {c.display_name or c.concept_name}",
                module_type="lesson", content_concept_id=c.id,
                estimated_duration_minutes=40, recommended_difficulty=diff,
            ))
            n += 1
            db.add(PathModule(
                adaptive_path_id=path.id, module_number=n,
                module_title=f"Practice: {c.display_name or c.concept_name}",
                module_type="quiz", content_concept_id=c.id,
                estimated_duration_minutes=20, recommended_difficulty=diff,
            ))

        path.total_modules = n
        db.commit()
        db.refresh(path)
        return self.get_path(db, str(path.id), user_id)

    # ── read ───────────────────────────────────────────────────────────────--

    def list_paths(self, db: Session, user_id) -> List[dict]:
        rows = (
            db.query(AdaptivePath)
            .filter(AdaptivePath.user_id == user_id)
            .order_by(AdaptivePath.created_at.desc())
            .all()
        )
        return [{
            "id": str(p.id),
            "path_name": p.path_name,
            "completed_modules": p.completed_modules,
            "total_modules": p.total_modules,
            "progress_percent": int(p.completed_modules / p.total_modules * 100) if p.total_modules else 0,
            "is_active": p.is_active,
        } for p in rows]

    def _require_path(self, db: Session, path_id: str, user_id) -> AdaptivePath:
        p = db.query(AdaptivePath).filter(AdaptivePath.id == path_id).first()
        if not p or str(p.user_id) != str(user_id):
            raise ValueError("Path not found")
        return p

    def get_path(self, db: Session, path_id: str, user_id) -> Dict:
        p = self._require_path(db, path_id, user_id)
        mods = (
            db.query(PathModule)
            .filter(PathModule.adaptive_path_id == p.id)
            .order_by(PathModule.module_number)
            .all()
        )
        # Resolve concept_name per module so the UI can deep-link lessons to the
        # learning page (/learning/<concept>) and scope quizzes to the concept.
        concept_ids = {str(m.content_concept_id) for m in mods if m.content_concept_id}
        names = {}
        if concept_ids:
            for c in db.query(Concept).filter(Concept.id.in_(concept_ids)).all():
                names[str(c.id)] = c.concept_name
        return {
            "id": str(p.id),
            "path_name": p.path_name,
            "completed_modules": p.completed_modules,
            "total_modules": p.total_modules,
            "progress_percent": int(p.completed_modules / p.total_modules * 100) if p.total_modules else 0,
            "times_adapted": p.times_adapted,
            "is_active": p.is_active,
            "modules": [{
                "id": str(m.id),
                "module_number": m.module_number,
                "title": m.module_title,
                "type": m.module_type,
                "difficulty": m.recommended_difficulty,
                "duration_minutes": m.estimated_duration_minutes,
                "status": m.module_status,
                "concept_name": names.get(str(m.content_concept_id)) if m.content_concept_id else None,
            } for m in mods],
            "forecast": self._forecast(db, p),
        }

    # ── progress ─────────────────────────────────────────────────────────────

    def complete_module(self, db: Session, path_id: str, module_id: str,
                        user_id, score: Optional[int]) -> Dict:
        p = self._require_path(db, path_id, user_id)
        m = (
            db.query(PathModule)
            .filter(PathModule.id == module_id, PathModule.adaptive_path_id == p.id)
            .first()
        )
        if not m:
            raise ValueError("Module not found")

        already_done = m.module_status == "completed"
        m.module_status = "completed"
        m.user_end_date = datetime.utcnow()
        db.add(ModulePerformance(
            user_id=user_id, path_module_id=m.id,
            quiz_score_percent=score, completion_percent=100,
        ))
        if not already_done:
            p.completed_modules = (p.completed_modules or 0) + 1
            p.current_module_number = min((p.current_module_number or 1) + 1, p.total_modules or 1)
        db.commit()
        return self.get_path(db, path_id, user_id)

    # ── adaptation ────────────────────────────────────────────────────────--

    def _avg_score(self, db: Session, path_id: str) -> Optional[float]:
        rows = (
            db.query(ModulePerformance.quiz_score_percent)
            .join(PathModule, ModulePerformance.path_module_id == PathModule.id)
            .filter(PathModule.adaptive_path_id == path_id,
                    ModulePerformance.quiz_score_percent.isnot(None))
            .all()
        )
        scores = [r[0] for r in rows if r[0] is not None]
        return sum(scores) / len(scores) if scores else None

    def _shift_difficulty(self, db: Session, path_id: str, direction: int):
        pending = (
            db.query(PathModule)
            .filter(PathModule.adaptive_path_id == path_id, PathModule.module_status == "pending")
            .order_by(PathModule.module_number)
            .limit(3)
            .all()
        )
        for m in pending:
            try:
                idx = _DIFF_ORDER.index(m.recommended_difficulty or "medium")
            except ValueError:
                idx = 1
            idx = max(0, min(len(_DIFF_ORDER) - 1, idx + direction))
            m.recommended_difficulty = _DIFF_ORDER[idx]
            m.difficulty_multiplier = 1.2 if direction > 0 else 0.85

    def adapt_path(self, db: Session, path_id: str, user_id) -> Dict:
        p = self._require_path(db, path_id, user_id)
        adaptations: List[Dict] = []

        avg = self._avg_score(db, path_id)
        if avg is not None:
            if avg < 60:
                self._shift_difficulty(db, path_id, -1)
                adaptations.append({"type": "difficulty_down",
                                    "reason": f"Average score {avg:.0f}% is below the 65% comfort band."})
            elif avg > 80:
                self._shift_difficulty(db, path_id, +1)
                adaptations.append({"type": "difficulty_up",
                                    "reason": f"Average score {avg:.0f}% is above target — raising challenge."})

        # Pacing: expected ~2 modules/week.
        days = max(1, (datetime.utcnow() - (p.started_at or datetime.utcnow())).days)
        expected = days / 7 * 2
        if p.completed_modules > expected * 1.2:
            adaptations.append({"type": "pacing_increase",
                                "reason": f"Ahead of schedule ({p.completed_modules} done vs ~{expected:.0f} expected)."})
        elif p.completed_modules < expected * 0.8 and days >= 7:
            adaptations.append({"type": "pacing_decrease",
                                "reason": f"Behind schedule ({p.completed_modules} done vs ~{expected:.0f} expected)."})

        for a in adaptations:
            db.add(PathAdaptation(adaptive_path_id=p.id, adaptation_type=a["type"], reason=a["reason"]))
        p.last_adapted_at = datetime.utcnow()
        p.times_adapted = (p.times_adapted or 0) + len(adaptations)
        db.commit()
        return {"adaptations": adaptations, "count": len(adaptations)}

    # ── forecast ─────────────────────────────────────────────────────────────

    def _forecast(self, db: Session, p: AdaptivePath) -> Dict:
        remaining = max(0, (p.total_modules or 0) - (p.completed_modules or 0))
        days = max(1, (datetime.utcnow() - (p.started_at or datetime.utcnow())).days)
        per_day = (p.completed_modules or 0) / days
        if per_day > 0:
            est_days = int(remaining / per_day)
        else:
            est_days = remaining * 3  # assume ~2/week if no data yet
        est_date = (datetime.utcnow() + timedelta(days=est_days)).date()
        ahead_behind = None
        if p.original_end_date:
            ahead_behind = (p.original_end_date - est_date).days  # +ve = ahead
        return {
            "modules_remaining": remaining,
            "estimated_completion_date": est_date.isoformat(),
            "original_end_date": p.original_end_date.isoformat() if p.original_end_date else None,
            "days_ahead": ahead_behind,
            "pace_modules_per_week": round(per_day * 7, 1),
        }


adaptive_path_service = AdaptivePathService()
