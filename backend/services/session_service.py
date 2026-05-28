import logging
from datetime import datetime
from typing import Optional, Dict, List
from uuid import UUID

from sqlalchemy.orm import Session as DBSession

from models import PathSession, ConceptProgress

logger = logging.getLogger(__name__)

_WATCHED_THRESHOLD = 90  # watch_percentage >= 90 marks video as watched


class SessionService:
    def start_session(
        self,
        db: DBSession,
        user_id: UUID,
        topic_id: UUID,
        video_index: int,
        youtube_id: str,
        path_id: Optional[str] = None,
        video_id: Optional[UUID] = None,
    ) -> PathSession:
        session_count = (
            db.query(PathSession)
            .filter(PathSession.user_id == user_id, PathSession.topic_id == topic_id)
            .count()
        )
        session = PathSession(
            user_id=user_id,
            topic_id=topic_id,
            video_id=video_id,
            youtube_id=youtube_id,
            video_index=video_index,
            path_id=path_id,
            session_number=session_count + 1,
            last_position_seconds=0,
            max_position_seconds=0,
            total_watch_time_seconds=0,
            playback_speed=1.0,
            questions_answered=0,
            questions_correct=0,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        logger.info(f"Session started: user={user_id} topic={topic_id} video_index={video_index}")
        return session

    def update_watch_progress(
        self,
        db: DBSession,
        session_id: UUID,
        user_id: UUID,
        watch_percentage: int,
        last_position_seconds: int,
        total_watch_time_seconds: int,
        playback_speed: float,
    ) -> Optional[PathSession]:
        session = self._get_session(db, session_id, user_id)
        if not session:
            return None

        session.watch_percentage = max(session.watch_percentage or 0, watch_percentage)
        session.last_position_seconds = last_position_seconds
        session.max_position_seconds = max(session.max_position_seconds or 0, last_position_seconds)
        session.total_watch_time_seconds = max(
            session.total_watch_time_seconds or 0, total_watch_time_seconds
        )
        session.playback_speed = playback_speed

        if session.watch_percentage >= _WATCHED_THRESHOLD and not session.video_watched:
            session.video_watched = True
            logger.info(f"Session {session_id}: video marked watched")

        db.commit()
        db.refresh(session)
        return session

    def submit_answer(
        self,
        db: DBSession,
        session_id: UUID,
        user_id: UUID,
        question: str,
        answer: str,
    ) -> Optional[PathSession]:
        session = self._get_session(db, session_id, user_id)
        if not session:
            return None

        session.post_video_question = question
        session.post_video_answer = answer
        session.questions_answered = (session.questions_answered or 0) + 1
        # AI-graded feedback is wired in Packet 2.3 (question_service); stub for now
        session.answer_feedback = "Answer recorded. AI-powered feedback coming soon."
        session.answer_score = None

        db.commit()
        db.refresh(session)
        return session

    def complete_session(
        self,
        db: DBSession,
        session_id: UUID,
        user_id: UUID,
    ) -> Optional[PathSession]:
        session = self._get_session(db, session_id, user_id)
        if not session:
            return None

        session.completed_at = datetime.utcnow()
        if (session.watch_percentage or 0) >= _WATCHED_THRESHOLD:
            session.video_watched = True

        db.commit()
        db.refresh(session)
        logger.info(f"Session {session_id} completed")
        return session

    def get_session_progress(
        self,
        db: DBSession,
        user_id: UUID,
        topic_id: UUID,
    ) -> Dict:
        sessions: List[PathSession] = (
            db.query(PathSession)
            .filter(PathSession.user_id == user_id, PathSession.topic_id == topic_id)
            .all()
        )

        completed = [s for s in sessions if s.completed_at is not None]
        total_watch = sum(s.total_watch_time_seconds or 0 for s in sessions)

        concepts_mastered = (
            db.query(ConceptProgress)
            .filter(
                ConceptProgress.user_id == user_id,
                ConceptProgress.topic_id == topic_id,
                ConceptProgress.status == "mastered",
            )
            .count()
        )

        completion_pct = (len(completed) / len(sessions) * 100) if sessions else 0.0

        return {
            "topic_id": str(topic_id),
            "total_sessions": len(sessions),
            "completed_sessions": len(completed),
            "completion_percentage": round(completion_pct, 1),
            "total_watch_time_seconds": total_watch,
            "concepts_mastered": concepts_mastered,
        }

    def get_session_by_id(
        self,
        db: DBSession,
        session_id: UUID,
        user_id: UUID,
    ) -> Optional[PathSession]:
        return self._get_session(db, session_id, user_id)

    def _get_session(
        self,
        db: DBSession,
        session_id: UUID,
        user_id: UUID,
    ) -> Optional[PathSession]:
        return (
            db.query(PathSession)
            .filter(PathSession.id == session_id, PathSession.user_id == user_id)
            .first()
        )

    def update_concept_progress(
        self,
        db: DBSession,
        user_id: UUID,
        topic_id: UUID,
        concept_name: str,
        correct: bool,
    ) -> ConceptProgress:
        concept = (
            db.query(ConceptProgress)
            .filter(
                ConceptProgress.user_id == user_id,
                ConceptProgress.topic_id == topic_id,
                ConceptProgress.concept_name == concept_name,
            )
            .first()
        )

        if not concept:
            concept = ConceptProgress(
                user_id=user_id,
                topic_id=topic_id,
                concept_name=concept_name,
            )
            db.add(concept)

        concept.encounters = (concept.encounters or 0) + 1
        concept.last_seen_at = datetime.utcnow()

        if correct:
            concept.correct_answers = (concept.correct_answers or 0) + 1
        else:
            concept.wrong_answers = (concept.wrong_answers or 0) + 1

        total = (concept.correct_answers or 0) + (concept.wrong_answers or 0)
        concept.mastery_score = round((concept.correct_answers or 0) / total * 100, 1) if total else 0.0

        if concept.mastery_score >= 80 and (concept.encounters or 0) >= 3:
            concept.status = "mastered"
        elif (concept.encounters or 0) >= 1:
            concept.status = "learning"
        else:
            concept.status = "not_started"

        db.commit()
        db.refresh(concept)
        return concept


session_service = SessionService()
