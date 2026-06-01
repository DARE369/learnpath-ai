"""
Per-endpoint rate limiting (Packet 4.2).

In-memory sliding window, keyed by (user_id, endpoint, window_start).
Same soft-fence design as cost_tracker: counters reset on redeploy, which is
acceptable for an abuse-prevention fence (not a billing rail). Thread-safe via
a single lock.

No Redis or DB writes are needed for the hot path. The counts are per-process;
for multi-process deployments the limits are per-worker (effectively multiplied),
which is fine at our current scale.

Window boundaries are aligned to wall-clock hours/days (UTC) so all users in
the same time zone feel the same reset time.
"""

import logging
import threading
from datetime import datetime, timedelta
from typing import Dict, Tuple

logger = logging.getLogger(__name__)

_UNLIMITED = 999_999

# (max_count, window_seconds) per plan per endpoint.
# "search:build-path"     — expensive YouTube + Claude call, limit free users.
# "questions:evaluate"    — Claude inference; free users are limited per day.
# Keys are the canonical action names used by check_and_increment callers.
ENDPOINT_LIMITS: Dict[str, Dict[str, Tuple[int, int]]] = {
    "search:build-path": {
        "free":    (2,  3600),    # 2 per hour
        "pro":     (10, 3600),    # 10 per hour
        "premium": (_UNLIMITED, 3600),
    },
    "questions:evaluate": {
        "free":    (5,  86400),   # 5 per day  (also covered by usage_tracking)
        "pro":     (20, 86400),   # 20 per day
        "premium": (_UNLIMITED, 86400),
    },
}


class RateLimitExceededError(Exception):
    """Raised by enforce() when the window quota is exhausted."""

    def __init__(self, message: str, retry_after: int = 0):
        super().__init__(message)
        self.retry_after = retry_after


class RateLimitingService:
    def __init__(self):
        self._lock = threading.Lock()
        # key: "{user_id}:{endpoint}:{window_start_iso}" -> count
        self._counts: Dict[str, int] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def check_and_increment(self, user_id, endpoint: str, plan_type: str) -> Dict:
        """
        Atomically check whether the user is within quota and increment.

        Returns:
            {allowed, remaining, reset_time (ISO), retry_after (seconds)}

        Never raises — callers decide the HTTP response.
        """
        config = ENDPOINT_LIMITS.get(endpoint)
        if config is None:
            return self._ok(_UNLIMITED, None)

        plan_type = plan_type or "free"
        max_count, window_seconds = config.get(plan_type, (_UNLIMITED, 3600))

        if max_count >= _UNLIMITED:
            return self._ok(_UNLIMITED, None)

        with self._lock:
            window_start, window_end = self._current_window(window_seconds)
            key = f"{user_id}:{endpoint}:{window_start}"
            current = self._counts.get(key, 0)

            now = datetime.utcnow()
            retry_after = max(0, int((window_end - now).total_seconds()))

            if current >= max_count:
                return {
                    "allowed": False,
                    "remaining": 0,
                    "reset_time": window_end.isoformat(),
                    "retry_after": retry_after,
                }

            self._counts[key] = current + 1
            self._maybe_evict(now)
            return {
                "allowed": True,
                "remaining": max_count - (current + 1),
                "reset_time": window_end.isoformat(),
                "retry_after": 0,
            }

    def enforce(self, user_id, endpoint: str, plan_type: str) -> None:
        """Raise RateLimitExceededError if quota is exhausted."""
        result = self.check_and_increment(user_id, endpoint, plan_type)
        if not result["allowed"]:
            retry = result.get("retry_after", 0)
            raise RateLimitExceededError(
                f"Rate limit exceeded. Try again in {retry} seconds.",
                retry_after=retry,
            )

    def get_limits_for_plan(self, plan_type: str) -> Dict:
        """Plan's limits for all tracked endpoints."""
        out = {}
        for ep, cfg in ENDPOINT_LIMITS.items():
            max_count, window_seconds = cfg.get(plan_type or "free", (_UNLIMITED, 3600))
            out[ep] = {
                "limit": None if max_count >= _UNLIMITED else max_count,
                "window_seconds": window_seconds,
                "window": "hourly" if window_seconds == 3600 else "daily",
                "unlimited": max_count >= _UNLIMITED,
            }
        return out

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    @staticmethod
    def _current_window(window_seconds: int) -> Tuple[str, datetime]:
        now = datetime.utcnow()
        if window_seconds == 3600:
            start = now.replace(minute=0, second=0, microsecond=0)
        else:
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(seconds=window_seconds)
        return start.isoformat()[:16], end  # truncate to minute for key

    @staticmethod
    def _ok(remaining: int, reset_time) -> Dict:
        return {
            "allowed": True,
            "remaining": remaining,
            "reset_time": reset_time,
            "retry_after": 0,
        }

    def _maybe_evict(self, now: datetime) -> None:
        """Trim stale keys once the dict grows large (O(n) but rare)."""
        if len(self._counts) < 5000:
            return
        cutoff = (now - timedelta(hours=25)).isoformat()[:16]
        self._counts = {
            k: v for k, v in self._counts.items()
            if k.rsplit(":", 1)[-1] >= cutoff
        }


rate_limiting_service = RateLimitingService()
