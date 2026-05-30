"""
Nightly self-expansion job (Packet 3.5).

Two entry points:
  - `run_nightly_expansion()` — async coroutine, the actual work. Builds a
    DB session, calls expansion_service.run_nightly_job(), commits, closes.
    Used by both the APScheduler job and the admin `/run-now` endpoint.

  - `setup_scheduler()` — wires the cron trigger into an AsyncIOScheduler
    when EXPANSION_SCHEDULER_ENABLED is True. Called from main.py's
    lifespan. The scheduler instance is returned so lifespan can shut it
    down cleanly.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


async def run_nightly_expansion() -> dict:
    """
    Execute one nightly expansion pass. Constructs its own DB session — must
    not rely on FastAPI Depends since APScheduler invokes us outside any
    request context.
    """
    from database import _get_session_factory
    from services.expansion_service import expansion_service

    SessionLocal = _get_session_factory()
    db = SessionLocal()
    try:
        result = await expansion_service.run_nightly_job(db)
        logger.info(
            f"Nightly expansion finished: status={result.get('status')} "
            f"aliases={result.get('aliases_created')} "
            f"keywords={result.get('keywords_extracted')} "
            f"expansions={result.get('topics_expanded')} "
            f"duration={result.get('duration_seconds')}s"
        )
        return result
    except Exception:
        logger.exception("Nightly expansion crashed")
        raise
    finally:
        db.close()


def setup_scheduler(app):
    """
    Attach an AsyncIOScheduler to the FastAPI app and register the nightly
    job. Returns the scheduler so lifespan can shut it down. Returns None
    when EXPANSION_SCHEDULER_ENABLED is False — caller just skips shutdown.

    Idempotent for re-imports: if a scheduler is already attached, returns it.
    """
    from config import settings

    if not settings.EXPANSION_SCHEDULER_ENABLED:
        logger.info("EXPANSION_SCHEDULER_ENABLED=False — nightly job not scheduled")
        return None

    existing = getattr(app.state, "expansion_scheduler", None)
    if existing is not None:
        return existing

    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger
    except ImportError:
        logger.warning("apscheduler not installed — nightly job not scheduled")
        return None

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_nightly_expansion,
        trigger=CronTrigger(hour=settings.EXPANSION_SCHEDULER_HOUR_UTC, minute=0),
        id="nightly_expansion",
        name="nightly_expansion",
        replace_existing=True,
        coalesce=True,        # if missed (e.g. process restart), run once not N times
        max_instances=1,
    )
    scheduler.start()
    app.state.expansion_scheduler = scheduler
    logger.info(
        f"Nightly expansion scheduled at {settings.EXPANSION_SCHEDULER_HOUR_UTC:02d}:00 UTC daily"
    )
    return scheduler


def shutdown_scheduler(app) -> None:
    """Stop the scheduler attached to the app, if any."""
    scheduler = getattr(app.state, "expansion_scheduler", None)
    if scheduler is None:
        return
    try:
        scheduler.shutdown(wait=False)
        logger.info("Expansion scheduler shut down")
    except Exception as e:
        logger.warning(f"Scheduler shutdown error: {e}")
    finally:
        app.state.expansion_scheduler = None
