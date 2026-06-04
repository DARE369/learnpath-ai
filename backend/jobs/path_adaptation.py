"""
Daily auto-adaptation of adaptive learning paths (NEW-PACKET-H).

Runs adapt_due_paths() on a daily cron so paths self-tune from performance
without the user clicking "Adapt". Gated by PATH_ADAPTATION_ENABLED (default on).
No-op if apscheduler is missing. Idempotent within adapt_due_paths (skips paths
adapted in the last few days).
"""

import logging

logger = logging.getLogger(__name__)


def run_adaptation_once() -> int:
    from database import _get_session_factory
    from services.adaptive_path_service import adaptive_path_service

    db = _get_session_factory()()
    try:
        n = adaptive_path_service.adapt_due_paths(db)
        logger.info(f"Auto-adaptation pass: adapted {n} path(s)")
        return n
    except Exception as e:
        logger.error(f"Auto-adaptation pass failed: {e}", exc_info=True)
        return 0
    finally:
        db.close()


def setup_path_adaptation_scheduler(app):
    """Wire a daily 03:30 UTC adaptation job. Returns the scheduler or None."""
    from config import settings

    if not getattr(settings, "PATH_ADAPTATION_ENABLED", True):
        logger.info("PATH_ADAPTATION_ENABLED=False — auto-adaptation not scheduled")
        return None

    existing = getattr(app.state, "path_adaptation_scheduler", None)
    if existing is not None:
        return existing

    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger
    except Exception:
        logger.warning("apscheduler not installed — auto-adaptation not scheduled")
        return None

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_adaptation_once,
        trigger=CronTrigger(hour=3, minute=30),
        id="path_adaptation",
        replace_existing=True,
    )
    scheduler.start()
    app.state.path_adaptation_scheduler = scheduler
    logger.info("Auto-adaptation scheduled daily at 03:30 UTC")
    return scheduler


def shutdown_path_adaptation_scheduler(app):
    sched = getattr(app.state, "path_adaptation_scheduler", None)
    if sched is not None:
        try:
            sched.shutdown(wait=False)
        except Exception:
            pass
