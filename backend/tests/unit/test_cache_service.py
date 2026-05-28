"""
Unit tests for the two-layer CacheService.
All tests use a fresh CacheService() instance — no shared state.
"""

from datetime import datetime, timedelta

import pytest

from services.cache_service import CacheService


@pytest.fixture
def cache():
    """Fresh cache instance per test — no state bleed."""
    return CacheService()


# ---------------------------------------------------------------------------
# get_cache_key
# ---------------------------------------------------------------------------

def test_cache_key_deterministic(cache):
    k1 = cache.get_cache_key("test_query")
    k2 = cache.get_cache_key("test_query")
    assert k1 == k2


def test_cache_key_different_inputs(cache):
    k1 = cache.get_cache_key("photosynthesis")
    k2 = cache.get_cache_key("mitosis")
    assert k1 != k2


def test_cache_key_is_hex_string(cache):
    key = cache.get_cache_key("any string")
    assert isinstance(key, str)
    assert len(key) == 32  # MD5 hex = 32 chars


# ---------------------------------------------------------------------------
# Layer 2 — query cache
# ---------------------------------------------------------------------------

def test_query_cache_hit(cache):
    cache.cache_query_mapping("photosynthesis", "topic_123")
    result = cache.get_query_mapping("photosynthesis")
    assert result == "topic_123"


def test_query_cache_normalises_case(cache):
    cache.cache_query_mapping("Photosynthesis", "topic_abc")
    assert cache.get_query_mapping("photosynthesis") == "topic_abc"
    assert cache.get_query_mapping("PHOTOSYNTHESIS") == "topic_abc"


def test_query_cache_miss(cache):
    result = cache.get_query_mapping("nonexistent_topic_xyz")
    assert result is None


def test_query_cache_increments_hits(cache):
    cache.cache_query_mapping("q1", "t1")
    cache.get_query_mapping("q1")
    assert cache.hits == 1
    assert cache.misses == 0


def test_query_cache_increments_misses(cache):
    cache.get_query_mapping("not_there")
    assert cache.misses == 1
    assert cache.hits == 0


def test_query_cache_expired_returns_none(cache):
    key = cache._normalise("expired_query")
    cache._query_cache[key] = {
        "topic_id": "t1",
        "expires_at": datetime.utcnow() - timedelta(seconds=1),
    }
    assert cache.get_query_mapping("expired_query") is None


# ---------------------------------------------------------------------------
# Layer 1 — topic path cache
# ---------------------------------------------------------------------------

def test_topic_cache_hit(cache):
    path = {"topic_id": "t1", "video_sequence": ["v1", "v2"], "average_score": 82.0,
            "video_count": 2}
    cache.cache_topic_path(path)
    result = cache.get_topic_path("t1")
    assert result is not None
    assert result["video_sequence"] == ["v1", "v2"]


def test_topic_cache_miss(cache):
    result = cache.get_topic_path("nonexistent_topic")
    assert result is None


def test_topic_cache_expired_returns_none(cache):
    cache._topic_cache["t_old"] = {
        "data": {"topic_id": "t_old"},
        "expires_at": datetime.utcnow() - timedelta(seconds=1),
        "cached_at": "old",
    }
    assert cache.get_topic_path("t_old") is None


def test_topic_cache_invalidate(cache):
    path = {"topic_id": "t2", "video_sequence": ["v3"], "average_score": 75.0,
            "video_count": 1}
    cache.cache_topic_path(path)
    assert cache.get_topic_path("t2") is not None

    cache.invalidate_topic_cache("t2")
    # After invalidation the next call should be a miss
    assert cache.get_topic_path("t2") is None


def test_topic_cache_skips_missing_topic_id(cache):
    result = cache.cache_topic_path({"video_sequence": ["v1"]})  # no topic_id
    assert result is False


# ---------------------------------------------------------------------------
# Statistics
# ---------------------------------------------------------------------------

def test_cache_stats_hit_rate(cache):
    cache.cache_query_mapping("q1", "t1")
    cache.get_query_mapping("q1")   # hit
    cache.get_query_mapping("q2")   # miss

    stats = cache.get_cache_stats()
    assert stats["hits"] == 1
    assert stats["misses"] == 1
    assert stats["total_requests"] == 2
    assert stats["hit_rate_percent"] == 50.0


def test_cache_stats_zero_requests(cache):
    stats = cache.get_cache_stats()
    assert stats["total_requests"] == 0
    assert stats["hit_rate_percent"] == 0.0


def test_cache_stats_memory_cache_size(cache):
    cache.cache_query_mapping("q1", "t1")
    cache.cache_query_mapping("q2", "t2")
    stats = cache.get_cache_stats()
    assert stats["query_cache_size"] == 2


# ---------------------------------------------------------------------------
# Clear cache
# ---------------------------------------------------------------------------

def test_clear_cache_resets_everything(cache):
    cache.cache_query_mapping("q1", "t1")
    path = {"topic_id": "t1", "video_sequence": ["v1"], "average_score": 80.0,
            "video_count": 1}
    cache.cache_topic_path(path)
    cache.get_query_mapping("q1")  # hit

    cache.clear_cache()

    stats = cache.get_cache_stats()
    assert stats["hits"] == 0
    assert stats["misses"] == 0
    assert stats["memory_cache_size"] == 0
    assert cache.get_query_mapping("q1") is None
    assert cache.get_topic_path("t1") is None
