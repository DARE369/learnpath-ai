"""Unit tests for SessionService — uses MagicMock for DB, no real database required."""

import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch, call
import pytest

from services.session_service import SessionService, _WATCHED_THRESHOLD


@pytest.fixture
def service():
    return SessionService()


@pytest.fixture
def mock_db():
    return MagicMock()


@pytest.fixture
def user_id():
    return uuid.uuid4()


@pytest.fixture
def topic_id():
    return uuid.uuid4()


@pytest.fixture
def session_id():
    return uuid.uuid4()


def make_mock_session(**kwargs):
    s = MagicMock()
    s.id = kwargs.get("id", uuid.uuid4())
    s.user_id = kwargs.get("user_id", uuid.uuid4())
    s.topic_id = kwargs.get("topic_id", uuid.uuid4())
    s.video_watched = kwargs.get("video_watched", False)
    s.watch_percentage = kwargs.get("watch_percentage", 0)
    s.last_position_seconds = kwargs.get("last_position_seconds", 0)
    s.max_position_seconds = kwargs.get("max_position_seconds", 0)
    s.total_watch_time_seconds = kwargs.get("total_watch_time_seconds", 0)
    s.playback_speed = kwargs.get("playback_speed", 1.0)
    s.questions_answered = kwargs.get("questions_answered", 0)
    s.questions_correct = kwargs.get("questions_correct", 0)
    s.completed_at = kwargs.get("completed_at", None)
    s.session_number = kwargs.get("session_number", 1)
    s.started_at = kwargs.get("started_at", datetime.utcnow())
    return s


# ─── start_session ────────────────────────────────────────────────────────────

class TestStartSession:
    def test_creates_session_with_correct_fields(self, service, mock_db, user_id, topic_id):
        mock_db.query.return_value.filter.return_value.count.return_value = 0
        mock_session = make_mock_session(user_id=user_id, topic_id=topic_id, session_number=1)
        mock_db.refresh.side_effect = lambda s: None

        with patch("services.session_service.PathSession", return_value=mock_session):
            result = service.start_session(
                mock_db,
                user_id=user_id,
                topic_id=topic_id,
                video_index=0,
                youtube_id="abc123",
            )

        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        assert result is mock_session

    def test_session_number_increments(self, service, mock_db, user_id, topic_id):
        mock_db.query.return_value.filter.return_value.count.return_value = 3
        mock_session = make_mock_session(session_number=4)
        mock_db.refresh.side_effect = lambda s: None

        with patch("services.session_service.PathSession", return_value=mock_session) as MockSession:
            service.start_session(
                mock_db,
                user_id=user_id,
                topic_id=topic_id,
                video_index=1,
                youtube_id="xyz789",
            )
            # session_number should be count + 1
            kwargs = MockSession.call_args.kwargs
            assert kwargs["session_number"] == 4

    def test_path_id_stored_when_provided(self, service, mock_db, user_id, topic_id):
        mock_db.query.return_value.filter.return_value.count.return_value = 0
        mock_session = make_mock_session()
        mock_db.refresh.side_effect = lambda s: None

        with patch("services.session_service.PathSession", return_value=mock_session) as MockSession:
            service.start_session(
                mock_db,
                user_id=user_id,
                topic_id=topic_id,
                video_index=0,
                youtube_id="abc",
                path_id="path-abc-123",
            )
            assert MockSession.call_args.kwargs["path_id"] == "path-abc-123"


# ─── update_watch_progress ────────────────────────────────────────────────────

class TestUpdateWatchProgress:
    def test_returns_none_when_session_not_found(self, service, mock_db, session_id, user_id):
        mock_db.query.return_value.filter.return_value.first.return_value = None
        result = service.update_watch_progress(
            mock_db, session_id=session_id, user_id=user_id,
            watch_percentage=50, last_position_seconds=120,
            total_watch_time_seconds=120, playback_speed=1.0,
        )
        assert result is None

    def test_watch_percentage_never_decreases(self, service, mock_db, session_id, user_id):
        session = make_mock_session(watch_percentage=70)
        mock_db.query.return_value.filter.return_value.first.return_value = session

        service.update_watch_progress(
            mock_db, session_id=session_id, user_id=user_id,
            watch_percentage=40,
            last_position_seconds=50,
            total_watch_time_seconds=50,
            playback_speed=1.0,
        )
        assert session.watch_percentage == 70

    def test_marks_video_watched_at_threshold(self, service, mock_db, session_id, user_id):
        session = make_mock_session(watch_percentage=0, video_watched=False)
        mock_db.query.return_value.filter.return_value.first.return_value = session

        service.update_watch_progress(
            mock_db, session_id=session_id, user_id=user_id,
            watch_percentage=_WATCHED_THRESHOLD,
            last_position_seconds=800,
            total_watch_time_seconds=800,
            playback_speed=1.0,
        )
        assert session.video_watched is True

    def test_does_not_mark_watched_below_threshold(self, service, mock_db, session_id, user_id):
        session = make_mock_session(watch_percentage=0, video_watched=False)
        mock_db.query.return_value.filter.return_value.first.return_value = session

        service.update_watch_progress(
            mock_db, session_id=session_id, user_id=user_id,
            watch_percentage=_WATCHED_THRESHOLD - 1,
            last_position_seconds=700,
            total_watch_time_seconds=700,
            playback_speed=1.0,
        )
        assert session.video_watched is False

    def test_total_watch_time_never_decreases(self, service, mock_db, session_id, user_id):
        session = make_mock_session(total_watch_time_seconds=500)
        mock_db.query.return_value.filter.return_value.first.return_value = session

        service.update_watch_progress(
            mock_db, session_id=session_id, user_id=user_id,
            watch_percentage=30,
            last_position_seconds=200,
            total_watch_time_seconds=100,
            playback_speed=1.0,
        )
        assert session.total_watch_time_seconds == 500


# ─── submit_answer ────────────────────────────────────────────────────────────

class TestSubmitAnswer:
    def test_returns_none_when_session_not_found(self, service, mock_db, session_id, user_id):
        mock_db.query.return_value.filter.return_value.first.return_value = None
        result = service.submit_answer(
            mock_db, session_id=session_id, user_id=user_id,
            question="What is ML?", answer="ML is cool",
        )
        assert result is None

    def test_records_question_and_answer(self, service, mock_db, session_id, user_id):
        session = make_mock_session(questions_answered=0)
        mock_db.query.return_value.filter.return_value.first.return_value = session

        service.submit_answer(
            mock_db, session_id=session_id, user_id=user_id,
            question="What is ML?", answer="Machine learning is amazing",
        )
        assert session.post_video_question == "What is ML?"
        assert session.post_video_answer == "Machine learning is amazing"
        assert session.questions_answered == 1

    def test_increments_questions_answered(self, service, mock_db, session_id, user_id):
        session = make_mock_session(questions_answered=2)
        mock_db.query.return_value.filter.return_value.first.return_value = session

        service.submit_answer(
            mock_db, session_id=session_id, user_id=user_id,
            question="Q", answer="A",
        )
        assert session.questions_answered == 3


# ─── complete_session ─────────────────────────────────────────────────────────

class TestCompleteSession:
    def test_sets_completed_at(self, service, mock_db, session_id, user_id):
        session = make_mock_session(completed_at=None, watch_percentage=95)
        mock_db.query.return_value.filter.return_value.first.return_value = session

        service.complete_session(mock_db, session_id=session_id, user_id=user_id)
        assert session.completed_at is not None

    def test_returns_none_when_not_found(self, service, mock_db, session_id, user_id):
        mock_db.query.return_value.filter.return_value.first.return_value = None
        result = service.complete_session(mock_db, session_id=session_id, user_id=user_id)
        assert result is None

    def test_marks_video_watched_when_above_threshold(self, service, mock_db, session_id, user_id):
        session = make_mock_session(watch_percentage=_WATCHED_THRESHOLD, video_watched=False)
        mock_db.query.return_value.filter.return_value.first.return_value = session

        service.complete_session(mock_db, session_id=session_id, user_id=user_id)
        assert session.video_watched is True


# ─── get_session_progress ─────────────────────────────────────────────────────

class TestGetSessionProgress:
    def test_empty_result_for_no_sessions(self, service, mock_db, user_id, topic_id):
        mock_db.query.return_value.filter.return_value.all.return_value = []
        mock_db.query.return_value.filter.return_value.count.return_value = 0

        result = service.get_session_progress(mock_db, user_id=user_id, topic_id=topic_id)

        assert result["total_sessions"] == 0
        assert result["completed_sessions"] == 0
        assert result["completion_percentage"] == 0.0

    def test_correct_completion_percentage(self, service, mock_db, user_id, topic_id):
        sessions = [
            make_mock_session(completed_at=datetime.utcnow()),
            make_mock_session(completed_at=datetime.utcnow()),
            make_mock_session(completed_at=None),
            make_mock_session(completed_at=None),
        ]
        mock_db.query.return_value.filter.return_value.all.return_value = sessions
        mock_db.query.return_value.filter.return_value.count.return_value = 0

        result = service.get_session_progress(mock_db, user_id=user_id, topic_id=topic_id)

        assert result["total_sessions"] == 4
        assert result["completed_sessions"] == 2
        assert result["completion_percentage"] == 50.0

    def test_sums_total_watch_time(self, service, mock_db, user_id, topic_id):
        sessions = [
            make_mock_session(total_watch_time_seconds=300, completed_at=datetime.utcnow()),
            make_mock_session(total_watch_time_seconds=450, completed_at=datetime.utcnow()),
        ]
        mock_db.query.return_value.filter.return_value.all.return_value = sessions
        mock_db.query.return_value.filter.return_value.count.return_value = 0

        result = service.get_session_progress(mock_db, user_id=user_id, topic_id=topic_id)
        assert result["total_watch_time_seconds"] == 750
