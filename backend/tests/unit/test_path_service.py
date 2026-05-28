"""
Unit tests for PathService — pure algorithm logic, no DB or Claude calls.
"""

import pytest
from services.path_service import PathService


@pytest.fixture
def svc():
    return PathService()


# ---------------------------------------------------------------------------
# rank_videos_by_score
# ---------------------------------------------------------------------------

def test_rank_videos_filters_below_threshold(svc):
    videos = [
        {"video_id": "v1", "eqs_score": 45},
        {"video_id": "v2", "eqs_score": 85},
        {"video_id": "v3", "eqs_score": 70},
    ]
    ranked = svc.rank_videos_by_score(videos)

    assert len(ranked) == 2
    assert ranked[0]["eqs_score"] == 85
    assert ranked[1]["eqs_score"] == 70


def test_rank_videos_empty(svc):
    assert svc.rank_videos_by_score([]) == []


def test_rank_videos_all_below_threshold(svc):
    videos = [{"video_id": f"v{i}", "eqs_score": 50} for i in range(5)]
    assert svc.rank_videos_by_score(videos) == []


def test_rank_videos_score_at_threshold_included(svc):
    videos = [{"video_id": "v1", "eqs_score": 65}]
    ranked = svc.rank_videos_by_score(videos)
    assert len(ranked) == 1


# ---------------------------------------------------------------------------
# assemble_path
# ---------------------------------------------------------------------------

def test_assemble_path_basic(svc):
    videos = [
        {"video_id": "v1", "eqs_score": 85},
        {"video_id": "v2", "eqs_score": 80},
        {"video_id": "v3", "eqs_score": 75},
    ]
    path = svc.assemble_path(topic_id="topic1", videos=videos)

    assert len(path["video_sequence"]) == 3
    assert path["average_score"] == 80.0
    assert path["is_quality"] is True
    assert path["topic_id"] == "topic1"
    assert path["algorithm_version"] == "v1"


def test_assemble_path_respects_max_length(svc):
    videos = [{"video_id": f"v{i}", "eqs_score": 80} for i in range(20)]
    path = svc.assemble_path(topic_id="t1", videos=videos)
    assert len(path["video_sequence"]) <= svc.max_path_length


def test_assemble_path_low_score_is_not_quality(svc):
    videos = [{"video_id": "v1", "eqs_score": 68}]
    path = svc.assemble_path(topic_id="t1", videos=videos)
    assert path["is_quality"] is False


def test_assemble_path_with_concept_graph(svc):
    videos = [
        {"video_id": "v1", "eqs_score": 80, "concepts": ["B"]},
        {"video_id": "v2", "eqs_score": 80, "concepts": ["A"]},
    ]
    concept_graph = {"ordered_concepts": ["A", "B"]}
    path = svc.assemble_path(topic_id="t1", videos=videos, concept_graph=concept_graph)

    # A should come before B
    seq = path["video_sequence"]
    assert seq.index("v2") < seq.index("v1")


# ---------------------------------------------------------------------------
# validate_path
# ---------------------------------------------------------------------------

def test_validate_path_valid(svc):
    good_path = {
        "video_sequence": ["v1", "v2", "v3"],
        "video_count": 3,
        "average_score": 80.0,
    }
    result = svc.validate_path(good_path)
    assert result["is_valid"] is True
    assert result["issues"] == []


def test_validate_path_too_short(svc):
    bad_path = {
        "video_sequence": ["v1"],
        "video_count": 1,
        "average_score": 80.0,
    }
    result = svc.validate_path(bad_path)
    assert result["is_valid"] is False
    assert any("few" in issue for issue in result["issues"])


def test_validate_path_low_quality(svc):
    bad_path = {
        "video_sequence": ["v1", "v2", "v3"],
        "video_count": 3,
        "average_score": 50.0,
    }
    result = svc.validate_path(bad_path)
    assert result["is_valid"] is False
    assert any("quality" in issue for issue in result["issues"])


def test_validate_path_duplicates(svc):
    dup_path = {
        "video_sequence": ["v1", "v1", "v2"],
        "video_count": 3,
        "average_score": 80.0,
    }
    result = svc.validate_path(dup_path)
    assert result["is_valid"] is False
    assert any("Duplicate" in issue for issue in result["issues"])


# ---------------------------------------------------------------------------
# save_path_to_db (stub)
# ---------------------------------------------------------------------------

def test_save_path_returns_uuid(svc):
    path = {
        "topic_id": "t1",
        "video_count": 3,
        "average_score": 80.0,
        "video_sequence": ["v1", "v2", "v3"],
    }
    path_id = svc.save_path_to_db(path)
    assert isinstance(path_id, str)
    assert len(path_id) == 36  # UUID format
