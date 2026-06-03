"""
School-like dashboard aggregation (NEW-PACKET-F).

Aggregates real data — streaks (from PathSession activity), today's goal,
weekly activity, performance by concept (ConceptMastery), milestones (from the
learner profile's study goals), and auto-unlocked achievements — into a single
payload. Real-time WebSocket sync from the spec is deferred; the client refetches.
Study-buddy data is omitted (no buddy system exists yet) so the UI shows a
graceful "coming soon" state.
"""

import logging
from datetime import datetime, timedelta, date
from typing import Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import (
    PathSession, QuizSession, ConceptMastery, UserProfile,
    UserStreak, UserAchievement,
)

logger = logging.getLogger(__name__)

# Achievement catalogue (id -> name/icon/description + rule).
_ACHIEVEMENTS = [
    ("getting_started", "Getting Started", "🌱", "Completed your first study session"),
    ("consistent_learner", "Consistent Learner", "🏆", "Reached a 7-day learning streak"),
    ("quick_learner", "Quick Learner", "⚡", "Studied 3+ hours in a single day"),
    ("consistency_master", "Consistency Master", "🌟", "Reached a 30-day learning streak"),
    ("sharp_shooter", "Sharp Shooter", "🎯", "Mastered a concept (80%+ accuracy)"),
]


class DashboardService:

    # ── streak ─────────────────────────────────────────────────────────────--

    @staticmethod
    def _activity_dates(db: Session, user_id, since_days: int = 120) -> List[date]:
        cutoff = datetime.utcnow() - timedelta(days=since_days)
        rows = (
            db.query(func.date(PathSession.started_at))
            .filter(PathSession.user_id == user_id, PathSession.started_at >= cutoff)
            .distinct()
            .all()
        )
        days = set()
        for (d,) in rows:
            if d is None:
                continue
            days.add(d if isinstance(d, date) else datetime.fromisoformat(str(d)).date())
        return sorted(days)

    @staticmethod
    def _current_streak(active_days: List[date]) -> int:
        if not active_days:
            return 0
        s = set(active_days)
        today = datetime.utcnow().date()
        # Streak counts only if active today or yesterday.
        anchor = today if today in s else (today - timedelta(days=1))
        if anchor not in s:
            return 0
        streak = 0
        cur = anchor
        while cur in s:
            streak += 1
            cur -= timedelta(days=1)
        return streak

    def _update_streak(self, db: Session, user_id) -> Dict:
        active = self._activity_dates(db, user_id)
        current = self._current_streak(active)

        row = db.query(UserStreak).filter(UserStreak.user_id == user_id).first()
        if not row:
            row = UserStreak(user_id=user_id)
            db.add(row)
        row.current_streak_days = current
        row.longest_streak_days = max(row.longest_streak_days or 0, current)
        row.last_activity_date = active[-1] if active else None
        db.commit()
        return {"current": current, "longest": row.longest_streak_days, "active_days": active}

    # ── sections ─────────────────────────────────────────────────────────────

    def _today(self, db: Session, user_id, profile: Optional[UserProfile]) -> Dict:
        start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        secs = (
            db.query(func.coalesce(func.sum(PathSession.total_watch_time_seconds), 0))
            .filter(PathSession.user_id == user_id, PathSession.started_at >= start)
            .scalar()
            or 0
        )
        minutes = int(secs // 60)
        weekly_hours = (profile.weekly_commitment_hours if profile and profile.weekly_commitment_hours else 7)
        daily_goal = max(15, int(weekly_hours * 60 / 7))
        return {
            "daily_goal_minutes": daily_goal,
            "time_spent_minutes": minutes,
            "progress_percent": min(100, int(minutes / daily_goal * 100)) if daily_goal else 0,
        }

    def _weekly(self, db: Session, user_id, profile: Optional[UserProfile]) -> Dict:
        names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        today = datetime.utcnow().date()
        breakdown = []
        for i in range(6, -1, -1):
            d = today - timedelta(days=i)
            start = datetime.combine(d, datetime.min.time())
            end = datetime.combine(d, datetime.max.time())
            secs = (
                db.query(func.coalesce(func.sum(PathSession.total_watch_time_seconds), 0))
                .filter(
                    PathSession.user_id == user_id,
                    PathSession.started_at >= start,
                    PathSession.started_at <= end,
                )
                .scalar()
                or 0
            )
            breakdown.append({"day": names[d.weekday()], "date": d.isoformat(),
                              "hours": round(secs / 3600, 2)})
        weekly_goal = (profile.weekly_commitment_hours if profile and profile.weekly_commitment_hours else 7)
        total = round(sum(b["hours"] for b in breakdown), 1)
        return {
            "daily_breakdown": breakdown,
            "weekly_goal_hours": weekly_goal,
            "total_this_week": total,
            "goal_percent": min(100, int(total / weekly_goal * 100)) if weekly_goal else 0,
        }

    def _performance(self, db: Session, user_id) -> Dict:
        rows = (
            db.query(ConceptMastery)
            .filter(ConceptMastery.user_id == user_id)
            .order_by(ConceptMastery.last_attempted.desc().nullslast())
            .limit(4)
            .all()
        )
        skills = [{
            "name": (r.concept_id or "concept").replace("_", " ").title(),
            "score": int(r.accuracy_percent or 0),
            "trend": "up" if r.is_mastered else "stable",
        } for r in rows]

        # Recent overall quiz average (last 10 completed sessions).
        recent = (
            db.query(QuizSession)
            .filter(QuizSession.user_id == user_id, QuizSession.score_percent.isnot(None))
            .order_by(QuizSession.created_at.desc())
            .limit(10)
            .all()
        )
        avg = int(sum(s.score_percent for s in recent) / len(recent)) if recent else 0
        return {"skills": skills, "recent_quiz_avg": avg}

    def _milestones(self, db: Session, user_id, profile: Optional[UserProfile]) -> Dict:
        out: List[Dict] = []
        goals = (profile.study_goals if profile and isinstance(profile.study_goals, list) else []) or []
        now = datetime.utcnow()
        for g in goals:
            if not isinstance(g, dict):
                continue
            label = g.get("goal") or g.get("label") or "your goal"
            days_away = None
            deadline = g.get("deadline_date")
            if deadline:
                try:
                    days_away = max(0, (datetime.fromisoformat(str(deadline)) - now).days)
                except (ValueError, TypeError):
                    days_away = None
            out.append({
                "title": f"Reach {label}",
                "days_away": days_away,
                "status": "urgent" if (days_away is not None and days_away <= 7) else "in_progress",
            })
        mastered = (
            db.query(func.count(ConceptMastery.id))
            .filter(ConceptMastery.user_id == user_id, ConceptMastery.is_mastered.is_(True))
            .scalar()
            or 0
        )
        out.append({"title": f"Master 5 concepts ({mastered}/5)", "days_away": None,
                    "status": "done" if mastered >= 5 else "in_progress"})
        return {"milestones": out[:4]}

    # ── achievements (auto-unlock) ─────────────────────────────────────────--

    def _achievements(self, db: Session, user_id, streak: Dict, week: Dict) -> Dict:
        unlocked_ids = {
            a.achievement_id
            for a in db.query(UserAchievement).filter(UserAchievement.user_id == user_id).all()
        }
        max_day_hours = max((b["hours"] for b in week["daily_breakdown"]), default=0)
        mastered = (
            db.query(func.count(ConceptMastery.id))
            .filter(ConceptMastery.user_id == user_id, ConceptMastery.is_mastered.is_(True))
            .scalar()
            or 0
        )
        any_activity = bool(streak["active_days"])

        rules = {
            "getting_started": any_activity,
            "consistent_learner": streak["current"] >= 7,
            "quick_learner": max_day_hours >= 3,
            "consistency_master": streak["current"] >= 30,
            "sharp_shooter": mastered >= 1,
        }
        meta = {a[0]: a for a in _ACHIEVEMENTS}
        newly = False
        for aid, met in rules.items():
            if met and aid not in unlocked_ids:
                _, name, icon, desc = meta[aid]
                db.add(UserAchievement(
                    user_id=user_id, achievement_id=aid,
                    achievement_name=name, achievement_icon=icon, achievement_description=desc,
                ))
                unlocked_ids.add(aid)
                newly = True
        if newly:
            db.commit()

        unlocked = [
            {"id": a[0], "name": a[1], "icon": a[2], "description": a[3]}
            for a in _ACHIEVEMENTS if a[0] in unlocked_ids
        ]
        locked = [
            {"id": a[0], "name": a[1], "icon": a[2], "description": a[3]}
            for a in _ACHIEVEMENTS if a[0] not in unlocked_ids
        ]
        return {"unlocked": unlocked, "locked": locked}

    # ── orchestrate ────────────────────────────────────────────────────────--

    def get_dashboard(self, db: Session, user_id) -> Dict:
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        streak = self._update_streak(db, user_id)
        week = self._weekly(db, user_id, profile)
        return {
            "streak": {"current": streak["current"], "longest": streak["longest"]},
            "today": self._today(db, user_id, profile),
            "performance": self._performance(db, user_id),
            "weekly": week,
            "milestones": self._milestones(db, user_id, profile),
            "achievements": self._achievements(db, user_id, streak, week),
            "buddy": None,  # buddy system not implemented yet
        }


dashboard_service = DashboardService()
