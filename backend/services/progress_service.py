import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session as DBSession

from models import UserProgress, PathSession, ConceptProgress

logger = logging.getLogger(__name__)


class ProgressService:
    def get_user_stats(self, db: DBSession, user_id: UUID) -> Dict:
        sessions: List[PathSession] = (
            db.query(PathSession).filter(PathSession.user_id == user_id).all()
        )
        concepts: List[ConceptProgress] = (
            db.query(ConceptProgress).filter(ConceptProgress.user_id == user_id).all()
        )
        progresses: List[UserProgress] = (
            db.query(UserProgress).filter(UserProgress.user_id == user_id).all()
        )

        videos_watched = sum(1 for s in sessions if s.video_watched)
        concepts_mastered = sum(1 for c in concepts if c.status == "mastered")
        total_seconds = sum(s.total_watch_time_seconds or 0 for s in sessions)
        courses_started = len(progresses)

        return {
            "videos_watched": videos_watched,
            "concepts_mastered": concepts_mastered,
            "hours_learned": round(total_seconds / 3600, 2),
            "courses_started": courses_started,
            "total_watch_time_seconds": total_seconds,
        }

    def get_learning_streak(self, db: DBSession, user_id: UUID) -> int:
        sessions: List[PathSession] = (
            db.query(PathSession)
            .filter(PathSession.user_id == user_id)
            .order_by(PathSession.started_at.desc())
            .all()
        )

        if not sessions:
            return 0

        days_active = {s.started_at.date() for s in sessions if s.started_at}
        today = datetime.utcnow().date()
        streak = 0

        for i in range(365):
            check = today - timedelta(days=i)
            if check in days_active:
                streak += 1
            else:
                break

        return streak

    def get_weekly_activity(self, db: DBSession, user_id: UUID) -> List[Dict]:
        cutoff = datetime.utcnow() - timedelta(days=7)
        sessions: List[PathSession] = (
            db.query(PathSession)
            .filter(
                PathSession.user_id == user_id,
                PathSession.started_at >= cutoff,
            )
            .all()
        )

        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        activity: Dict[str, Dict] = {}
        for i in range(7):
            d = (datetime.utcnow() - timedelta(days=6 - i)).date()
            day = day_names[d.weekday()]
            activity[day] = {"date": day, "videos": 0, "minutes": 0}

        for s in sessions:
            if not s.started_at:
                continue
            day = day_names[s.started_at.weekday()]
            if day in activity:
                activity[day]["videos"] += 1 if s.video_watched else 0
                activity[day]["minutes"] += (s.total_watch_time_seconds or 0) // 60

        return list(activity.values())

    def get_heatmap_data(self, db: DBSession, user_id: UUID, days: int = 112) -> List[Dict]:
        cutoff = datetime.utcnow() - timedelta(days=days)
        sessions: List[PathSession] = (
            db.query(PathSession)
            .filter(
                PathSession.user_id == user_id,
                PathSession.started_at >= cutoff,
            )
            .all()
        )

        day_map: Dict[str, Dict] = {}
        for s in sessions:
            if not s.started_at:
                continue
            key = s.started_at.date().isoformat()
            if key not in day_map:
                day_map[key] = {"date": key, "minutes": 0, "videos": 0}
            day_map[key]["minutes"] += (s.total_watch_time_seconds or 0) // 60
            if s.video_watched:
                day_map[key]["videos"] += 1

        return list(day_map.values())

    def get_concept_progress(
        self, db: DBSession, user_id: UUID, topic_id: Optional[UUID] = None
    ) -> List[Dict]:
        q = db.query(ConceptProgress).filter(ConceptProgress.user_id == user_id)
        if topic_id:
            q = q.filter(ConceptProgress.topic_id == topic_id)
        concepts = q.order_by(ConceptProgress.mastery_score.desc()).all()

        return [
            {
                "concept_name": c.concept_name,
                "mastery_score": c.mastery_score,
                "status": c.status,
                "encounters": c.encounters,
                "last_seen_at": c.last_seen_at.isoformat() if c.last_seen_at else None,
            }
            for c in concepts
        ]


progress_service = ProgressService()
