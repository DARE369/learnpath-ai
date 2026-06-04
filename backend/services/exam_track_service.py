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

    # ── build a study path toward this exam (I -> H) ─────────────────────────--

    def _ensure_concept(self, db, name: str, display: str, difficulty: int, subject: str):
        from models import Concept
        c = db.query(Concept).filter(Concept.concept_name == name).first()
        if not c:
            c = Concept(concept_name=name, display_name=display, subject=subject,
                        difficulty_level=difficulty, created_by="exam_track")
            db.add(c)
            db.flush()
        return c

    def ensure_exam_curriculum(self, db: Session, track: ExamTrack):
        """
        Build a real mini-curriculum for the exam: a goal Concept plus one Concept
        per section, wired as prerequisites of the goal (easy->hard by section
        order). Idempotent. Returns the goal Concept.
        """
        from models import ConceptRelationship

        goal = self._ensure_concept(db, track.exam_type, track.name, 8, track.exam_type)

        existing_edges = {
            str(r.target_concept_id)
            for r in db.query(ConceptRelationship.target_concept_id).filter(
                ConceptRelationship.source_concept_id == goal.id,
                ConceptRelationship.relationship_type == "prerequisite",
            ).all()
        }
        sections = track.sections or []
        for i, sec in enumerate(sections):
            sec_name = (sec.get("name") if isinstance(sec, dict) else str(sec)) or f"Section {i+1}"
            slug = f"{track.exam_type}_{sec_name.lower().replace(' ', '_').replace('&', 'and')}"
            difficulty = min(8, 4 + i)  # spread so the path orders sections progressively
            sec_concept = self._ensure_concept(db, slug, f"{track.name}: {sec_name}", difficulty, track.exam_type)
            if str(sec_concept.id) not in existing_edges:
                db.add(ConceptRelationship(
                    source_concept_id=goal.id, target_concept_id=sec_concept.id,
                    relationship_type="prerequisite", strength=0.9,
                ))
        db.commit()
        db.refresh(goal)
        return goal

    # ── timed mock exam ──────────────────────────────────────────────────────

    async def start_mock(self, db: Session, user_id, track_id: str, num_questions: int = 10) -> dict:
        """Assemble a timed, multi-section mock exam (answers omitted)."""
        from models import Concept, ConceptRelationship, QuizQuestion
        from services.quiz_engine_service import QuizEngineService

        track = self._require_track(db, track_id)
        goal = self.ensure_exam_curriculum(db, track)
        edges = (
            db.query(ConceptRelationship)
            .filter(
                ConceptRelationship.source_concept_id == goal.id,
                ConceptRelationship.relationship_type == "prerequisite",
            )
            .all()
        )
        sections = [db.query(Concept).filter(Concept.id == e.target_concept_id).first() for e in edges]
        sections = [c for c in sections if c] or [goal]

        qe = QuizEngineService()
        per = max(1, round(num_questions / len(sections)))
        questions = []
        for sc in sections:
            await qe.ensure_questions_for_concept(db, sc.concept_name, per + 1)
            qs = (
                db.query(QuizQuestion)
                .filter(QuizQuestion.concept_id == sc.concept_name)
                .limit(per)
                .all()
            )
            label = (sc.display_name or sc.concept_name).split(": ")[-1]
            for q in qs:
                questions.append({
                    "id": str(q.id),
                    "section": label,
                    "text": q.question_text,
                    "options": [{"id": o.get("id"), "text": o.get("text")} for o in (q.options or [])],
                })
        questions = questions[:num_questions]
        return {
            "track": self._track(track),
            "duration_minutes": max(5, len(questions) * 2),
            "question_count": len(questions),
            "questions": questions,
        }

    def submit_mock(self, db: Session, user_id, track_id: str, answers: dict) -> dict:
        """Auto-score a mock exam, record the attempt, return section breakdown."""
        from models import Concept, QuizQuestion

        track = self._require_track(db, track_id)
        qids = list((answers or {}).keys())
        qs = db.query(QuizQuestion).filter(QuizQuestion.id.in_(qids)).all() if qids else []

        cnames = {q.concept_id for q in qs if q.concept_id}
        concepts = (
            {c.concept_name: c for c in db.query(Concept).filter(Concept.concept_name.in_(cnames)).all()}
            if cnames else {}
        )

        section_totals: Dict[str, list] = {}
        correct = 0
        review = []
        for q in qs:
            c = concepts.get(q.concept_id)
            section = (c.display_name.split(": ")[-1] if c and c.display_name else (q.concept_id or "general"))
            is_correct = answers.get(str(q.id)) == q.correct_answer_id
            if is_correct:
                correct += 1
            st = section_totals.setdefault(section, [0, 0])
            st[1] += 1
            if is_correct:
                st[0] += 1
            review.append({
                "id": str(q.id),
                "is_correct": is_correct,
                "your_answer": answers.get(str(q.id)),
                "correct_answer_id": q.correct_answer_id,
                "explanation": q.explanation,
            })

        total = len(qs)
        overall = int(correct / total * 100) if total else 0
        section_scores = {s: int(v[0] / v[1] * 100) for s, v in section_totals.items()}
        predicted = _map_score(track.exam_type, overall)
        db.add(MockExamAttempt(
            user_id=user_id, exam_track_id=track.id,
            overall_percent=overall, section_scores=section_scores, predicted_score=predicted,
        ))
        db.commit()
        return {
            "overall_percent": overall,
            "correct": correct,
            "total": total,
            "section_scores": section_scores,
            "predicted_score": predicted,
            "review": review,
        }

    def build_study_path(self, db: Session, user_id, track_id: str) -> dict:
        """
        Create an adaptive learning path toward this exam. Builds a real
        curriculum first (goal concept + one prerequisite concept per exam
        section) so the generated path covers each section, then sequences it.
        """
        from services.adaptive_path_service import adaptive_path_service

        track = self._require_track(db, track_id)
        goal = self.ensure_exam_curriculum(db, track)
        return adaptive_path_service.create_path(db, user_id, str(goal.id), target_weeks=8)


exam_track_service = ExamTrackService()
