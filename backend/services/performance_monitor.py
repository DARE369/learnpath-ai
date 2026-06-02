"""Performance monitoring and metrics collection (Packet 6.2)"""

import time
import logging
import os
from datetime import datetime
from typing import Dict, Optional, Callable
from functools import wraps
import json

logger = logging.getLogger(__name__)

# Initialize Sentry if DSN is available
SENTRY_DSN = os.getenv("SENTRY_DSN")
if SENTRY_DSN:
    try:
        import sentry_sdk
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            traces_sample_rate=0.1,  # 10% of transactions for performance monitoring
            profiles_sample_rate=0.1,
        )
        logger.info("Sentry initialized for error tracking")
    except Exception as e:
        logger.warning(f"Failed to initialize Sentry: {e}")

# Initialize DataDog if available
DATADOG_API_KEY = os.getenv("DATADOG_API_KEY")
DATADOG_ENABLED = False
if DATADOG_API_KEY:
    try:
        from datadog import initialize, api
        options = {
            "api_key": DATADOG_API_KEY,
            "app_key": os.getenv("DATADOG_APP_KEY", ""),
        }
        initialize(**options)
        DATADOG_ENABLED = True
        logger.info("DataDog enabled for APM")
    except Exception as e:
        logger.warning(f"DataDog initialization failed: {e}")


class PerformanceMetrics:
    """Collect and report performance metrics."""

    def __init__(self):
        self.metrics: Dict[str, list] = {}

    def record_metric(self, name: str, value: float, tags: Optional[Dict] = None):
        """Record a metric value.

        Args:
            name: Metric name (e.g., "api.response_time")
            value: Metric value (usually milliseconds)
            tags: Optional tags for metric categorization
        """
        if name not in self.metrics:
            self.metrics[name] = []

        self.metrics[name].append({
            "value": value,
            "timestamp": datetime.utcnow().isoformat(),
            "tags": tags or {},
        })

        # Send to DataDog if enabled
        if DATADOG_ENABLED:
            try:
                from datadog import api
                api.Metric.send(
                    metric=f"learnpath.{name}",
                    points=value,
                    tags=[f"{k}:{v}" for k, v in (tags or {}).items()],
                )
            except Exception as e:
                logger.debug(f"Failed to send metric to DataDog: {e}")

        # Log slow operations (> 1000ms)
        if value > 1000:
            logger.warning(
                f"SLOW OPERATION: {name} took {value:.2f}ms",
                extra={"tags": tags}
            )

    def get_stats(self, name: str) -> Optional[Dict]:
        """Get statistics for a metric.

        Returns:
            Dict with min, max, avg, count
        """
        if name not in self.metrics:
            return None

        values = [m["value"] for m in self.metrics[name]]
        return {
            "min": min(values),
            "max": max(values),
            "avg": sum(values) / len(values),
            "count": len(values),
        }

    def clear(self):
        """Clear all metrics."""
        self.metrics.clear()


# Global metrics instance
metrics = PerformanceMetrics()


def track_performance(operation_name: str, thresholds: Optional[Dict[str, int]] = None):
    """Decorator to track function performance.

    Args:
        operation_name: Name of the operation for metrics
        thresholds: Dict of threshold names to milliseconds (e.g., {"slow": 500})
    """
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start = time.time()
            try:
                result = await func(*args, **kwargs)
                return result
            finally:
                elapsed_ms = (time.time() - start) * 1000
                metrics.record_metric(
                    f"{operation_name}.duration_ms",
                    elapsed_ms,
                    {"function": func.__name__}
                )

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                elapsed_ms = (time.time() - start) * 1000
                metrics.record_metric(
                    f"{operation_name}.duration_ms",
                    elapsed_ms,
                    {"function": func.__name__}
                )

        # Return async or sync based on function
        if hasattr(func, '__code__') and func.__code__.co_flags & 0x100:
            return async_wrapper
        return sync_wrapper

    return decorator


class DatabaseQueryLogger:
    """Log slow database queries."""

    @staticmethod
    def log_query(query: str, duration_ms: float, params: Optional[list] = None):
        """Log a database query.

        Args:
            query: SQL query string
            duration_ms: Query execution time in milliseconds
            params: Query parameters
        """
        if duration_ms > 100:  # Log queries slower than 100ms
            logger.warning(
                f"SLOW QUERY ({duration_ms:.2f}ms): {query[:100]}...",
                extra={
                    "query_duration_ms": duration_ms,
                    "params": str(params)[:200] if params else None,
                }
            )

        metrics.record_metric(
            "database.query_duration_ms",
            duration_ms,
            {"query_type": query.split()[0]}
        )


class APIEndpointTracker:
    """Track API endpoint performance."""

    @staticmethod
    def track_endpoint(method: str, path: str, status_code: int, duration_ms: float):
        """Track an API endpoint call.

        Args:
            method: HTTP method (GET, POST, etc.)
            path: Request path
            status_code: HTTP response status
            duration_ms: Request duration in milliseconds
        """
        tags = {
            "method": method,
            "path": path[:50],  # Truncate long paths
            "status_code": status_code,
        }

        metrics.record_metric(
            "api.endpoint.duration_ms",
            duration_ms,
            tags
        )

        # Track error rate
        if status_code >= 400:
            metrics.record_metric(
                "api.endpoint.error",
                1,
                tags
            )


# FastAPI middleware for automatic endpoint tracking
from starlette.middleware.base import BaseHTTPMiddleware


class PerformanceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000

        APIEndpointTracker.track_endpoint(
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
        )

        return response
