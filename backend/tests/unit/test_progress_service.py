"""Unit tests for ProgressService — uses MagicMock for DB, no real database required."""

import uuid
from datetime import datetime, timedelta
from unittest.mock import MagicMock
import pytest

from services.progress_service import ProgressService


@pytest.fixture
def service():
    return ProgressService()


@pytest.fixture
def mock_db():
    return MagicMock()


@pytest.fixture
def user_id():
    return uuid.uuid4()


def make_session(**kwargs):
    s = MagicMock()
    s.video_watched = kwargs.get("video_watched", False)
    s.total_watch_time_seconds = kwargs.get("total_watch_time_seconds", 0)
    s.started_at = kwargs.get("started_at", datetime.utcnow())
    return s


def make_concept(**kwargs):
    c = MagicMock()
    c.status = kwargs.get("status", "not_started")
    c.concept_name = kwargs.get("concept_name", "Test Concept")
    c.mastery_score = kwargs.get("mastery_score", 0.0)
    c.encounters = kwargs.get("encounters", 0)
    c.last_seen_at = kwargs.get("last_seen_at", None)
    return c


# ─── get_user_stats ───────────────────────────────────────────────────────────

class TestGetUserStats:
    def _setup_db(self, mock_db, sessions, concepts, progresses):
        # First call → sessions, second → concepts, third → progresses
        mock_db.query.return_value.filter.return_value.all.side_effect = [
            sessions, concepts, progresses
        ]

    def test_empty_user_returns_zeros(self, service, mock_db, user_id):
        self._setup_db(mock_db, [], [], [])
        result = service.get_user_stats(mock_db, user_id=user_id)
        assert result["videos_watched"] == 0
        assert result["concepts_mastered"] == 0
        assert result["hours_learned"] == 0.0
        assert result["courses_started"] == 0

    def test_counts_watched_videos(self, service, mock_db, user_id):
        sessions = [
            make_session(video_watched=True),
            make_session(video_watched=True),
            make_session(video_watched=False),
        ]
        self._setup_db(mock_db, sessions, [], [])
        result = service.get_user_stats(mock_db, user_id=user_id)
        assert result["videos_watched"] == 2

    def test_counts_mastered_concepts(self, service, mock_db, user_id):
        concepts = [
            make_concept(status="mastered"),
            make_concept(status="mastered"),
            make_concept(status="learning"),
            make_concept(status="not_started"),
        ]
        self._setup_db(mock_db, [], concepts, [])
        result = service.get_user_stats(mock_db, user_id=user_id)
        assert result["concepts_mastered"] == 2

    def test_calculates_hours_from_seconds(self, service, mock_db, user_id):
        sessions = [
            make_session(total_watch_time_seconds=3600),
            make_session(total_watch_time_seconds=1800),
        ]
        self._setup_db(mock_db, sessions, [], [])
        result = service.get_user_stats(mock_db, user_id=user_id)
        assert result["hours_learned"] == 1.5


# ─── get_learning_streak ─────────────────────────────────────────────────────

class TestGetLearningStreak:
    def test_no_sessions_returns_zero(self, service, mock_db, user_id):
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []
        result = service.get_learning_streak(mock_db, user_id=user_id)
        assert result == 0

    def test_consecutive_days_counted(self, service, mock_db, user_id):
        today = datetime.utcnow()
        sessions = [
            make_session(started_at=today),
            make_session(started_at=today - timedelta(days=1)),
            make_session(started_at=today - timedelta(days=2)),
        ]
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = sessions
        result = service.get_learning_streak(mock_db, user_id=user_id)
        assert result == 3

    def test_gap_breaks_streak(self, service, mock_db, user_id):
        today = datetime.utcnow()
        sessions = [
            make_session(started_at=today),
            # day 1 is skipped
            make_session(started_at=today - timedelta(days=2)),
        ]
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = sessions
        result = service.get_learning_streak(mock_db, user_id=user_id)
        assert result == 1

    def test_multiple_sessions_same_day_count_once(self, service, mock_db, user_id):
        today = datetime.utcnow()
        sessions = [
            make_session(started_at=today),
            make_session(started_at=today.replace(hour=max(0, today.hour - 2))),
        ]
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = sessions
        result = service.get_learning_streak(mock_db, user_id=user_id)
        assert result == 1


# ─── get_weekly_activity ──────────────────────────────────────────────────────

class TestGetWeeklyActivity:
    def test_returns_seven_days(self, service, mock_db, user_id):
        mock_db.query.return_value.filter.return_value.filter.return_value.all.return_value = []
        result = service.get_weekly_activity(mock_db, user_id=user_id)
        assert len(result) == 7

    def test_all_days_have_required_keys(self, service, mock_db, user_id):
        mock_db.query.return_value.filter.return_value.filter.return_value.all.return_value = []
        result = service.get_weekly_activity(mock_db, user_id=user_id)
        for day in result:
            assert "date" in day
            assert "videos" in day
            assert "minutes" in day


# ─── get_heatmap_data ─────────────────────────────────────────────────────────

class TestGetHeatmapData:
    def test_empty_returns_empty_list(self, service, mock_db, user_id):
        mock_db.query.return_value.filter.return_value.filter.return_value.all.return_value = []
        result = service.get_heatmap_data(mock_db, user_id=user_id)
        assert result == []

    def test_aggregates_same_day_sessions(self, service, mock_db, user_id):
        today = datetime.utcnow()
        sessions = [
            make_session(started_at=today, total_watch_time_seconds=600, video_watched=True),
            make_session(started_at=today, total_watch_time_seconds=300, video_watched=True),
        ]
        # get_heatmap_data uses a single .filter(...).all() call
        mock_db.query.return_value.filter.return_value.all.return_value = sessions
        result = service.get_heatmap_data(mock_db, user_id=user_id)
        assert len(result) == 1
        assert result[0]["minutes"] == 15  # 900 seconds / 60
        assert result[0]["videos"] == 2
