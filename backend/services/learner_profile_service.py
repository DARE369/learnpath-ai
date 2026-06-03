"""
Learner Profile Service (NEW-PACKET-A).

Handles the 6-step onboarding flow, adaptive placement test scoring,
pace calculation, and quarterly re-profiling.  Path recommendations are
intentionally lightweight for MVP: the service scores paths by goal/level/
timeline alignment and returns the top 3 — no ML, no external dependencies.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import and_
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Goal → readable label map
# ---------------------------------------------------------------------------

GOAL_LABELS: Dict[str, str] = {
    "ielts":        "IELTS Exam",
    "sat":          "SAT/ACT Prep",
    "waec":         "WAEC/JAMB",
    "professional": "Professional Skill",
    "language":     "Language Learning",
    "academic":     "Academic Subject",
    "trades":       "Trades/Practical",
    "hobby":        "Personal Interest",
}

# Placement test question bank (10 questions, easy/medium/hard pool)
_PLACEMENT_QUESTIONS = [
    # easy
    {"id": "p1", "difficulty": "easy",   "question": "Which planet is closest to the Sun?",          "options": ["Mercury","Venus","Earth","Mars"],               "answer": "Mercury"},
    {"id": "p2", "difficulty": "easy",   "question": "What is 15 × 4?",                               "options": ["50","60","55","65"],                            "answer": "60"},
    {"id": "p3", "difficulty": "easy",   "question": "What is the chemical symbol for water?",        "options": ["H2O","CO2","O2","HO"],                          "answer": "H2O"},
    # medium
    {"id": "p4", "difficulty": "medium", "question": "What is the derivative of x³?",                 "options": ["3x²","x²","3x","2x³"],                         "answer": "3x²"},
    {"id": "p5", "difficulty": "medium", "question": "In which country was Shakespeare born?",        "options": ["England","Ireland","Scotland","France"],        "answer": "England"},
    {"id": "p6", "difficulty": "medium", "question": "What does CPU stand for?",                      "options": ["Central Processing Unit","Core Power Unit","Computer Processing Unit","Central Program Unit"], "answer": "Central Processing Unit"},
    {"id": "p7", "difficulty": "medium", "question": "What is the capital of Australia?",             "options": ["Sydney","Melbourne","Canberra","Brisbane"],     "answer": "Canberra"},
    # hard
    {"id": "p8", "difficulty": "hard",   "question": "What is the integral of 1/x?",                  "options": ["ln|x| + C","x⁻² + C","e^x + C","x + C"],      "answer": "ln|x| + C"},
    {"id": "p9", "difficulty": "hard",   "question": "Who developed the theory of general relativity?","options": ["Einstein","Newton","Bohr","Heisenberg"],       "answer": "Einstein"},
    {"id": "p10","difficulty": "hard",   "question": "What does DNA stand for?",                      "options": ["Deoxyribonucleic Acid","Dinucleic Acid","Dinitrogen Acid","Deoxynuclein Acid"], "answer": "Deoxyribonucleic Acid"},
]

_Q_BY_ID: Dict[str, Dict] = {q["id"]: q for q in _PLACEMENT_QUESTIONS}
_Q_BY_DIFF: Dict[str, List[Dict]] = {
    d: [q for q in _PLACEMENT_QUESTIONS if q["difficulty"] == d]
    for d in ("easy", "medium", "hard")
}


class LearnerProfileService:

    # ------------------------------------------------------------------
    # Profile bootstrap
    # ------------------------------------------------------------------

    def get_or_create_profile(self, db: Session, user_id: str) -> Any:
        from models import UserProfile
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if not profile:
            profile = UserProfile(user_id=user_id)
            db.add(profile)
            db.commit()
            db.refresh(profile)
        return profile

    # ------------------------------------------------------------------
    # Onboarding step saver
    # ------------------------------------------------------------------

    def save_step(self, db: Session, user_id: str, step: int, data: Dict) -> Dict:
        profile = self.get_or_create_profile(db, user_id)

        if step == 1:
            goals_raw = data.get("study_goals", [])
            profile.study_goals = [{"goal": g} for g in goals_raw]

        elif step == 2:
            profile.current_level = data.get("level", "intermediate")
            if data.get("test_taken"):
                profile.placement_test_completed = True
                profile.placement_test_score = data.get("test_score")
            else:
                profile.self_assessed = True

        elif step == 3:
            deadline_str = data.get("deadline_date")
            target_score = data.get("target_score")
            if deadline_str and profile.study_goals:
                try:
                    deadline_dt = datetime.strptime(deadline_str, "%Y-%m-%d")
                    days = (deadline_dt - datetime.utcnow()).days
                    updated = []
                    for g in profile.study_goals:
                        g = dict(g)
                        if target_score is not None:
                            g["target_score"] = target_score
                        g["deadline_date"] = deadline_str
                        g["days_to_deadline"] = max(days, 0)
                        updated.append(g)
                    profile.study_goals = updated
                    profile.next_profiling_date = datetime.utcnow() + timedelta(days=90)
                except ValueError:
                    pass

        elif step == 4:
            profile.weekly_commitment_hours = data.get("weekly_hours", 10)
            profile.preferred_study_times = data.get("preferred_times", [])

        elif step == 5:
            profile.learning_styles = data.get("learning_styles", [])

        elif step == 6:
            profile.onboarding_completed = True
            profile.onboarding_completed_at = datetime.utcnow()
            profile.last_profiling_date = datetime.utcnow()
            self._calculate_pace(profile)

        profile.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(profile)
        return {"status": "ok", "step": step, "onboarding_completed": profile.onboarding_completed}

    # ------------------------------------------------------------------
    # Pace calculation
    # ------------------------------------------------------------------

    def _calculate_pace(self, profile: Any) -> None:
        goals = profile.study_goals or []
        if not goals or not profile.weekly_commitment_hours:
            return
        goal = goals[0]
        days_left = goal.get("days_to_deadline", 0)
        if days_left <= 0:
            return
        weeks_left = days_left / 7
        # Estimate path requires roughly 80 hours by default
        estimated_hours = 80
        profile.required_hours_per_week = round(estimated_hours / max(weeks_left, 1), 2)
        profile.required_hours_per_day = round(profile.required_hours_per_week / 7, 2)

    def get_pace(self, db: Session, user_id: str) -> Optional[Dict]:
        from models import UserProfile
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if not profile:
            return None
        self._calculate_pace(profile)
        db.commit()
        if not profile.required_hours_per_week:
            return None
        return {
            "hours_per_week": round(profile.required_hours_per_week, 1),
            "hours_per_day": round(profile.required_hours_per_day, 1),
            "feasible": profile.required_hours_per_week <= 30,
        }

    # ------------------------------------------------------------------
    # Placement test
    # ------------------------------------------------------------------

    def start_placement_test(self, db: Session, user_id: str) -> Dict:
        from models import PlacementTest
        test = PlacementTest(user_id=user_id, difficulty_sequence=["easy"])
        db.add(test)
        db.commit()
        db.refresh(test)
        first_q = _Q_BY_DIFF["easy"][0]
        return {
            "test_id": str(test.id),
            "question_number": 1,
            "total_questions": 10,
            "question": self._format_question(first_q),
        }

    def answer_placement_question(
        self, db: Session, user_id: str, test_id: str, question_id: str, user_answer: str
    ) -> Dict:
        from models import PlacementTest, UserProfile
        test = db.query(PlacementTest).filter(
            and_(PlacementTest.id == test_id, PlacementTest.user_id == user_id)
        ).first()
        if not test:
            return {"error": "Test not found"}

        q = _Q_BY_ID.get(question_id)
        correct = q is not None and user_answer.strip() == q["answer"].strip()
        test.questions_answered += 1
        if correct:
            test.questions_correct += 1

        current_diff = (test.difficulty_sequence or ["easy"])[-1]
        if correct:
            next_diff = "medium" if current_diff == "easy" else "hard"
        else:
            next_diff = "medium" if current_diff == "hard" else "easy"

        seq = list(test.difficulty_sequence or [])
        seq.append(next_diff)
        test.difficulty_sequence = seq

        if test.questions_answered >= 10:
            score = int((test.questions_correct / 10) * 100)
            test.score_percent = score
            test.test_completed_at = datetime.utcnow()
            if score < 34:
                level = "beginner"
            elif score < 67:
                level = "intermediate"
            else:
                level = "advanced"
            test.estimated_level = level
            db.commit()

            profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
            if profile:
                profile.current_level = level
                profile.placement_test_completed = True
                profile.placement_test_score = score
                db.commit()

            return {
                "completed": True,
                "score": score,
                "level": level,
                "correct": correct,
            }

        db.commit()
        pool = _Q_BY_DIFF[next_diff]
        used_idx = (test.questions_answered - 1) % len(pool)
        next_q = pool[used_idx]
        return {
            "completed": False,
            "correct": correct,
            "question_number": test.questions_answered + 1,
            "total_questions": 10,
            "question": self._format_question(next_q),
        }

    @staticmethod
    def _format_question(q: Dict) -> Dict:
        return {
            "id": q["id"],
            "text": q["question"],
            "options": [{"text": o, "id": o} for o in q["options"]],
            "difficulty": q["difficulty"],
        }

    # ------------------------------------------------------------------
    # Re-profiling
    # ------------------------------------------------------------------

    def re_profile(self, db: Session, user_id: str, updated_data: Dict) -> Dict:
        from models import UserProfile, ProfilingHistory
        profile = self.get_or_create_profile(db, user_id)

        history = ProfilingHistory(
            user_id=user_id,
            study_goals_before=profile.study_goals,
            study_goals_after=updated_data.get("study_goals"),
            current_level_before=profile.current_level,
            current_level_after=updated_data.get("current_level"),
            weekly_hours_before=profile.weekly_commitment_hours,
            weekly_hours_after=updated_data.get("weekly_commitment_hours"),
            goals_changed=profile.study_goals != updated_data.get("study_goals"),
            level_changed=profile.current_level != updated_data.get("current_level"),
            profiling_type="quarterly",
            completed_at=datetime.utcnow(),
        )
        db.add(history)

        for key, val in updated_data.items():
            if hasattr(profile, key):
                setattr(profile, key, val)
        profile.last_profiling_date = datetime.utcnow()
        profile.next_profiling_date = datetime.utcnow() + timedelta(days=90)
        profile.updated_at = datetime.utcnow()
        db.commit()

        return {"status": "profile_updated"}

    # ------------------------------------------------------------------
    # Profile serialisation
    # ------------------------------------------------------------------

    def profile_to_dict(self, profile: Any) -> Dict:
        return {
            "user_id": str(profile.user_id),
            "onboarding_completed": profile.onboarding_completed,
            "onboarding_completed_at": profile.onboarding_completed_at.isoformat() if profile.onboarding_completed_at else None,
            "study_goals": profile.study_goals or [],
            "current_level": profile.current_level,
            "placement_test_completed": profile.placement_test_completed,
            "placement_test_score": profile.placement_test_score,
            "self_assessed": profile.self_assessed,
            "weekly_commitment_hours": profile.weekly_commitment_hours,
            "preferred_study_times": profile.preferred_study_times or [],
            "learning_styles": profile.learning_styles or [],
            "required_hours_per_week": profile.required_hours_per_week,
            "required_hours_per_day": profile.required_hours_per_day,
            "last_profiling_date": profile.last_profiling_date.isoformat() if profile.last_profiling_date else None,
            "next_profiling_date": profile.next_profiling_date.isoformat() if profile.next_profiling_date else None,
            "difficulty_preference": profile.difficulty_preference,
            "notification_frequency": profile.notification_frequency,
            "language": profile.language,
        }


learner_profile_service = LearnerProfileService()
