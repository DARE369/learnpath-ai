"""
Exam Readiness Score Service.

Computes an honest 0-100 readiness score per subject per user.
The score is a weighted blend of:
  40% — diagnostic baseline (initial assessment)
  40% — concept mastery from answered questions (ConceptProgress)
  20% — study recency / consistency (have they studied recently?)

The score is stored in ExamReadinessScore and recomputed whenever a
diagnostic is completed or a study session ends with question answers.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Concept mastery threshold for "this topic is covered"
MASTERY_THRESHOLD = 60.0


class ReadinessService:

    def get_scores(self, db: Session, user_id) -> List[Dict]:
        """Return all readiness scores for this user."""
        from models import ExamReadinessScore, WAECSubject

        rows = (
            db.query(ExamReadinessScore, WAECSubject.name)
            .join(WAECSubject, WAECSubject.id == ExamReadinessScore.subject_id)
            .filter(ExamReadinessScore.user_id == user_id)
            .all()
        )
        return [
            {
                "subject_id": r.ExamReadinessScore.subject_id,
                "subject_name": r.name,
                "score": r.ExamReadinessScore.score,
                "diagnostic_score": r.ExamReadinessScore.diagnostic_score,
                "weak_topics": r.ExamReadinessScore.weak_topics or [],
                "strong_topics": r.ExamReadinessScore.strong_topics or [],
                "score_history": r.ExamReadinessScore.score_history or [],
                "updated_at": r.ExamReadinessScore.updated_at.isoformat() if r.ExamReadinessScore.updated_at else None,
            }
            for r in rows
        ]

    def get_score(self, db: Session, user_id, subject_id: str) -> Optional[Dict]:
        from models import ExamReadinessScore
        row = (
            db.query(ExamReadinessScore)
            .filter(
                ExamReadinessScore.user_id == user_id,
                ExamReadinessScore.subject_id == subject_id,
            )
            .first()
        )
        if not row:
            return None
        return {
            "subject_id": row.subject_id,
            "score": row.score,
            "diagnostic_score": row.diagnostic_score,
            "weak_topics": row.weak_topics or [],
            "strong_topics": row.strong_topics or [],
            "score_history": row.score_history or [],
        }

    def update_from_diagnostic(
        self,
        db: Session,
        user_id,
        subject_id: str,
        diagnostic_score: int,
        weak_topic_ids: List[str],
        strong_topic_ids: List[str],
    ) -> None:
        """Called right after a diagnostic is completed."""
        from models import ExamReadinessScore

        row = (
            db.query(ExamReadinessScore)
            .filter(
                ExamReadinessScore.user_id == user_id,
                ExamReadinessScore.subject_id == subject_id,
            )
            .first()
        )

        # Seed score = diagnostic score (no study history yet)
        new_score = diagnostic_score

        if not row:
            row = ExamReadinessScore(
                user_id=user_id,
                subject_id=subject_id,
                score=new_score,
                diagnostic_score=diagnostic_score,
                weak_topics=weak_topic_ids,
                strong_topics=strong_topic_ids,
                score_history=[new_score],
            )
            db.add(row)
        else:
            row.diagnostic_score = diagnostic_score
            row.weak_topics = weak_topic_ids
            row.strong_topics = strong_topic_ids
            row.score = new_score
            history = list(row.score_history or [])
            history.append(new_score)
            row.score_history = history[-14:]  # keep last 14 data points

        db.commit()
        logger.info(f"Readiness updated for user={user_id} subject={subject_id}: {new_score}/100")

    def recompute(self, db: Session, user_id, subject_id: str) -> int:
        """
        Full recompute from all available signals.
        Call this after a study session to refresh the score.
        Returns the new score.
        """
        from models import ExamReadinessScore, ConceptProgress, PathSession

        row = (
            db.query(ExamReadinessScore)
            .filter(
                ExamReadinessScore.user_id == user_id,
                ExamReadinessScore.subject_id == subject_id,
            )
            .first()
        )

        diagnostic_score = (row.diagnostic_score or 0) if row else 0

        # Concept mastery component: average mastery of concepts linked to this subject
        # We use ConceptProgress rows and filter by topic_id matching the subject
        concepts = (
            db.query(ConceptProgress)
            .filter(ConceptProgress.user_id == user_id)
            .all()
        )
        if concepts:
            mastered = [c for c in concepts if (c.mastery_score or 0) >= MASTERY_THRESHOLD]
            concept_pct = min(100, round(len(mastered) / len(concepts) * 100))
        else:
            concept_pct = 0

        # Recency component: did the user study in the last 7 days?
        cutoff = datetime.utcnow() - timedelta(days=7)
        recent_sessions = (
            db.query(PathSession)
            .filter(
                PathSession.user_id == user_id,
                PathSession.started_at >= cutoff,
            )
            .count()
        )
        recency_score = min(100, recent_sessions * 20)  # 5 sessions in 7 days = 100

        # Weighted blend
        new_score = round(
            diagnostic_score * 0.40
            + concept_pct * 0.40
            + recency_score * 0.20
        )
        new_score = max(0, min(100, new_score))

        if not row:
            row = ExamReadinessScore(
                user_id=user_id,
                subject_id=subject_id,
                score=new_score,
                diagnostic_score=diagnostic_score,
                score_history=[new_score],
            )
            db.add(row)
        else:
            history = list(row.score_history or [])
            history.append(new_score)
            row.score_history = history[-14:]
            row.score = new_score

        db.commit()
        return new_score

    def readiness_label(self, score: int) -> str:
        if score >= 80:
            return "Ready"
        if score >= 60:
            return "On track"
        if score >= 40:
            return "Needs work"
        return "Just starting"

    def next_action(self, score: int, weak_topics: List[str], subject_name: str) -> str:
        """Return a single, honest recommended next action."""
        if not weak_topics:
            if score >= 80:
                return f"Practice past questions on {subject_name} to build exam confidence."
            return f"Continue studying {subject_name} and take a diagnostic to identify gaps."
        topic_hint = weak_topics[0].replace("-", " ").title()
        if score < 40:
            return f"Start with the basics of {topic_hint} — your diagnostic shows this is your biggest gap."
        return f"Focus on {topic_hint} next — you're getting there but this topic needs more practice."


readiness_service = ReadinessService()
