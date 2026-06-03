"""
Exam-specific tracks (NEW-PACKET-I).

A catalogue of exam-prep tracks (IELTS / SAT / WAEC) that users enroll in with a
target score and exam date. Score prediction is derived from REAL performance —
recent QuizSession scores blended with ConceptMastery — mapped onto each exam's
scale, with a readiness/on-track signal vs the user's target. Mock-exam results
can be logged to track the trend.

Built from the master-roadmap scope (the detailed I spec wasn't provided); the
score-scale mappings are transparent heuristics, easy to swap for official
conversion tables later.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from models import (
    ExamTrack, ExamEnrollment, MockExamAttempt, QuizSession, ConceptMastery,
)

logger = logging.getLogger(__name__)

# Static catalogue — lazily seeded on first list so tracks always exist.
_CATALOG = [
    {
        "exam_type": "ielts",
        "name": "IELTS Academic",
        "description": "Listening, Reading, Writing, and Speaking for IELTS Academic.",
        "score_scale": "Band 0-9",
        "sections": [{"name": "Listening"}, {"name": "Reading"}, {"name": "Writing"}, {"name": "Speaking"}],
    },
    {
        "exam_type": "sat",
        "name": "SAT",
        "description": "Reading & Writing and Math for the digital SAT.",
        "score_scale": "400-1600",
        "sections": [{"name": "Reading & Writing"}, {"name": "Math"}],
    },
    {
        "exam_type": "waec",
        "name": "WAEC / WASSCE",
        "description": "West African senior school certificate exam preparation.",
        "score_scale": "A1-F9",
        "sections": [{"name": "Objective"}, {"name": "Theory"}],
    },
]


def _map_score(exam_type: str, pct: float) -> str:
    pct = max(0.0, min(100.0, pct))
    if exam_type == "ielts":
        band = round((pct / 100 * 9) * 2) / 2
        return f"{min(9.0, band):.1f}"
    if exam_type == "sat":
        return str(int(round(400 + pct / 100 * 1200)))
    if exam_type == "waec":
        for thr, g in [(75, "A1"), (70, "B2"), (65, "B3"), (60, "C4"),
                       (55, "C5"), (50, "C6"), (45, "D7"), (40, "E8"), (0, "F9")]:
            if pct >= thr:
                return g
        return "F9"
    return f"{int(pct)}%"


class ExamTrackService:

    def ensure_catalog(self, db: Session) -> None:
        existing = {t.exam_type for t in db.query(ExamTrack.exam_type).all()}
        added = False
        for entry in _CATALOG:
            if entry["exam_type"] in existing:
                continue
            db.add(ExamTrack(**entry))
            added = True
        if added:
            db.commit()

    def list_tracks(self, db: Session) -> List[dict]:
        self.ensure_catalog(db)
        return [self._track(t) for t in db.query(ExamTrack).order_by(ExamTrack.name).all()]

    def _track(self, t: ExamTrack) -> dict:
        return {
            "id": str(t.id),
            "exam_type": t.exam_type,
            "name": t.name,
            "description": t.description,
            "score_scale": t.score_scale,
            "sections": t.sections or [],
        }

    def _require_track(self, db: Session, track_id: str) -> ExamTrack:
        t = db.query(ExamTrack).filter(ExamTrack.id == track_id).first()
        if not t:
            raise ValueError("Exam track not found")
        return t

    # ── enrollment ───────────────────────────────────────────────────────────

    def enroll(self, db: Session, user_id, track_id: str,
               target_score: str = "", exam_date: Optional[str] = None) -> dict:
        track = self._require_track(db, track_id)
        row = (
            db.query(ExamEnrollment)
            .filter(ExamEnrollment.user_id == user_id, ExamEnrollment.exam_track_id == track.id)
            .first()
        )
        parsed_date = None
        if exam_date:
            try:
                parsed_date = datetime.fromisoformat(exam_date).date()
            except (ValueError, TypeError):
                parsed_date = None
        if row:
            row.target_score = target_score or row.target_score
            row.exam_date = parsed_date or row.exam_date
        else:
            row = ExamEnrollment(
                user_id=user_id, exam_track_id=track.id,
                target_score=target_score, exam_date=parsed_date,
            )
            db.add(row)
        db.commit()
        db.refresh(row)
        return self.enrollment_detail(db, row, track)

    def my_enrollments(self, db: Session, user_id) -> List[dict]:
        rows = (
            db.query(ExamEnrollment)
            .filter(ExamEnrollment.user_id == user_id)
            .order_by(ExamEnrollment.created_at.desc())
            .all()
        )
        out = []
        for r in rows:
            track = db.query(ExamTrack).filter(ExamTrack.id == r.exam_track_id).first()
            if track:
                out.append(self.enrollment_detail(db, r, track))
        return out

    def enrollment_detail(self, db: Session, enr: ExamEnrollment, track: ExamTrack) -> dict:
        pred = self.predict(db, enr.user_id, track)
        days_left = None
        if enr.exam_date:
            days_left = (enr.exam_date - datetime.utcnow().date()).days
        return {
            "enrollment_id": str(enr.id),
            "track": self._track(track),
            "target_score": enr.target_score,
            "exam_date": enr.exam_date.isoformat() if enr.exam_date else None,
            "days_to_exam": days_left,
            "prediction": pred,
        }

    # ── prediction (from real performance) ─────────────────────────────────--

    def _readiness_pct(self, db: Session, user_id) -> Optional[float]:
        recent = (
            db.query(QuizSession.score_percent)
            .filter(QuizSession.user_id == user_id, QuizSession.score_percent.isnot(None))
            .order_by(QuizSession.created_at.desc())
            .limit(10)
            .all()
        )
        quiz_scores = [r[0] for r in recent if r[0] is not None]
        mastery = (
            db.query(ConceptMastery.accuracy_percent)
            .filter(ConceptMastery.user_id == user_id)
            .all()
        )
        mastery_scores = [m[0] for m in mastery if m[0] is not None]

        parts = []
        if quiz_scores:
            parts.append(sum(quiz_scores) / len(quiz_scores))
        if mastery_scores:
            parts.append(sum(mastery_scores) / len(mastery_scores))
        if not parts:
            return None
        return sum(parts) / len(parts)

    def predict(self, db: Session, user_id, track: ExamTrack) -> dict:
        pct = self._readiness_pct(db, user_id)
        if pct is None:
            return {
                "predicted_score": None,
                "readiness_percent": None,
                "note": "Take a few quizzes to unlock a score prediction.",
            }
        return {
            "predicted_score": _map_score(track.exam_type, pct),
            "readiness_percent": round(pct, 1),
            "note": None,
        }

    # ── mock exams ───────────────────────────────────────────────────────────

    def log_mock(self, db: Session, user_id, track_id: str,
                 overall_percent: int, section_scores: dict) -> dict:
        track = self._require_track(db, track_id)
        attempt = MockExamAttempt(
            user_id=user_id, exam_track_id=track.id,
            overall_percent=max(0, min(100, overall_percent)),
            section_scores=section_scores or {},
            predicted_score=_map_score(track.exam_type, overall_percent),
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        return self._attempt(attempt)

    def list_mocks(self, db: Session, user_id, track_id: str) -> List[dict]:
        rows = (
            db.query(MockExamAttempt)
            .filter(MockExamAttempt.user_id == user_id, MockExamAttempt.exam_track_id == track_id)
            .order_by(MockExamAttempt.taken_at.desc())
            .all()
        )
        return [self._attempt(a) for a in rows]

    def _attempt(self, a: MockExamAttempt) -> dict:
        return {
            "id": str(a.id),
            "overall_percent": a.overall_percent,
            "section_scores": a.section_scores or {},
            "predicted_score": a.predicted_score,
            "taken_at": a.taken_at.isoformat() if a.taken_at else None,
        }


exam_track_service = ExamTrackService()
