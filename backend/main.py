from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
from datetime import datetime

from config import settings

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# Idempotent schema patches for tables that pre-date a column. create_all()
# never alters existing tables, so when the model gains a new column the live
# table stays at its old shape and queries 500 with "UndefinedColumn". Each
# statement here uses ADD COLUMN IF NOT EXISTS so re-runs are no-ops.
_SCHEMA_PATCHES = [
    # path_sessions — added across packets 2.2 → 2.4
    "ALTER TABLE path_sessions ADD COLUMN IF NOT EXISTS path_id VARCHAR",
    "ALTER TABLE path_sessions ADD COLUMN IF NOT EXISTS youtube_id VARCHAR",
    "ALTER TABLE path_sessions ADD COLUMN IF NOT EXISTS video_index INTEGER DEFAULT 0",
    "ALTER TABLE path_sessions ADD COLUMN IF NOT EXISTS session_number INTEGER",
    "ALTER TABLE path_sessions ADD COLUMN IF NOT EXISTS max_position_seconds INTEGER DEFAULT 0",
    "ALTER TABLE path_sessions ADD COLUMN IF NOT EXISTS timestamp_watched VARCHAR",
    "ALTER TABLE path_sessions ADD COLUMN IF NOT EXISTS post_video_question TEXT",
    "ALTER TABLE path_sessions ADD COLUMN IF NOT EXISTS post_video_answer TEXT",
    "ALTER TABLE path_sessions ADD COLUMN IF NOT EXISTS answer_feedback TEXT",
    "ALTER TABLE path_sessions ADD COLUMN IF NOT EXISTS answer_score INTEGER",
    "ALTER TABLE path_sessions ADD COLUMN IF NOT EXISTS questions_answered INTEGER DEFAULT 0",
    "ALTER TABLE path_sessions ADD COLUMN IF NOT EXISTS questions_correct INTEGER DEFAULT 0",
    "ALTER TABLE path_sessions ADD COLUMN IF NOT EXISTS notes TEXT",
    "CREATE INDEX IF NOT EXISTS ix_path_sessions_path_id ON path_sessions(path_id)",
    "CREATE INDEX IF NOT EXISTS ix_path_sessions_youtube_id ON path_sessions(youtube_id)",
    # Drop FK constraints — search-built paths use synthetic topic_ids
    # that don't exist in the topics table. The MVP treats these as logical
    # references, not enforced FKs. Pre-existing constraint names follow
    # Postgres default: <table>_<col>_fkey.
    "ALTER TABLE path_sessions DROP CONSTRAINT IF EXISTS path_sessions_topic_id_fkey",
    "ALTER TABLE path_sessions DROP CONSTRAINT IF EXISTS path_sessions_video_id_fkey",
    "ALTER TABLE path_sessions ALTER COLUMN topic_id DROP NOT NULL",
    "ALTER TABLE concept_progress DROP CONSTRAINT IF EXISTS concept_progress_topic_id_fkey",
    "ALTER TABLE question_answers DROP CONSTRAINT IF EXISTS question_answers_topic_id_fkey",
    # users — Google OAuth (Packet 2.5 extension)
    "ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR UNIQUE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR NOT NULL DEFAULT 'email'",
    "CREATE INDEX IF NOT EXISTS ix_users_google_id ON users(google_id)",
    # concept_branches — Packet 3.1
    "CREATE INDEX IF NOT EXISTS ix_concept_branches_concept_key ON concept_branches(concept_key)",
    "CREATE INDEX IF NOT EXISTS ix_concept_branches_is_active ON concept_branches(is_active)",
    "CREATE INDEX IF NOT EXISTS ix_concept_branches_branch_order ON concept_branches(branch_order)",
    # video_blacklist + blacklist_feedback — Packet 3.2
    "CREATE INDEX IF NOT EXISTS ix_video_blacklist_youtube_id ON video_blacklist(youtube_id)",
    "CREATE INDEX IF NOT EXISTS ix_video_blacklist_is_active ON video_blacklist(is_active)",
    "CREATE INDEX IF NOT EXISTS ix_blacklist_feedback_youtube_id ON blacklist_feedback(youtube_id)",
    "CREATE INDEX IF NOT EXISTS ix_blacklist_feedback_user_id ON blacklist_feedback(user_id)",
    # expanded_video_scores — Packet 3.3
    "CREATE INDEX IF NOT EXISTS ix_expanded_video_scores_youtube_id ON expanded_video_scores(youtube_id)",
    "CREATE INDEX IF NOT EXISTS ix_expanded_video_scores_total_score ON expanded_video_scores(total_score)",
    "CREATE INDEX IF NOT EXISTS ix_expanded_video_scores_confidence_level ON expanded_video_scores(confidence_level)",
    "CREATE INDEX IF NOT EXISTS ix_expanded_video_scores_is_valid ON expanded_video_scores(is_valid)",
    # remediation_events — Packet 3.4
    "CREATE INDEX IF NOT EXISTS ix_remediation_events_query_normalized ON remediation_events(query_normalized)",
    "CREATE INDEX IF NOT EXISTS ix_remediation_events_user_id ON remediation_events(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_remediation_events_tier_used ON remediation_events(tier_used)",
    "CREATE INDEX IF NOT EXISTS ix_remediation_events_success ON remediation_events(success)",
    # search_events + topic_aliases + topic_keywords + nightly_runs — Packet 3.5
    "CREATE INDEX IF NOT EXISTS ix_search_events_query_normalized ON search_events(query_normalized)",
    "CREATE INDEX IF NOT EXISTS ix_search_events_user_id ON search_events(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_search_events_created_at ON search_events(created_at)",
    "CREATE INDEX IF NOT EXISTS ix_topic_aliases_alias_query ON topic_aliases(alias_query)",
    "CREATE INDEX IF NOT EXISTS ix_topic_aliases_canonical_query ON topic_aliases(canonical_query)",
    "CREATE INDEX IF NOT EXISTS ix_topic_aliases_is_active ON topic_aliases(is_active)",
    "CREATE INDEX IF NOT EXISTS ix_topic_keywords_topic_query ON topic_keywords(topic_query)",
    "CREATE INDEX IF NOT EXISTS ix_topic_keywords_keyword ON topic_keywords(keyword)",
    "CREATE INDEX IF NOT EXISTS ix_nightly_runs_started_at ON nightly_runs(started_at)",
    # users — account credit balance for referral/loyalty rewards (Packet 4.6)
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS account_credit_ngn FLOAT DEFAULT 0",
    # referral_codes + referrals + loyalty_points + loyalty_history + reward_codes — Packet 4.6
    "CREATE INDEX IF NOT EXISTS ix_referral_codes_user_id ON referral_codes(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_referral_codes_code ON referral_codes(code)",
    "CREATE INDEX IF NOT EXISTS ix_referrals_referrer_id ON referrals(referrer_id)",
    "CREATE INDEX IF NOT EXISTS ix_referrals_referred_user_id ON referrals(referred_user_id)",
    "CREATE INDEX IF NOT EXISTS ix_referrals_referral_code ON referrals(referral_code)",
    "CREATE INDEX IF NOT EXISTS ix_loyalty_points_user_id ON loyalty_points(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_loyalty_history_user_id ON loyalty_history(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_loyalty_history_created_at ON loyalty_history(created_at)",
    "CREATE INDEX IF NOT EXISTS ix_reward_codes_user_id ON reward_codes(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_reward_codes_code ON reward_codes(code)",
    # subscriptions + transactions + billing_history — Packet 4.1
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS pending_plan_type VARCHAR",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP",
    "CREATE INDEX IF NOT EXISTS ix_subscriptions_user_id ON subscriptions(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_subscriptions_status ON subscriptions(status)",
    "CREATE INDEX IF NOT EXISTS ix_subscriptions_renewal_date ON subscriptions(renewal_date)",
    "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS flutterwave_id VARCHAR",
    "CREATE INDEX IF NOT EXISTS ix_transactions_user_id ON transactions(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_transactions_reference ON transactions(reference)",
    "CREATE INDEX IF NOT EXISTS ix_transactions_status ON transactions(status)",
    "CREATE INDEX IF NOT EXISTS ix_transactions_created_at ON transactions(created_at)",
    "CREATE INDEX IF NOT EXISTS ix_transactions_flutterwave_id ON transactions(flutterwave_id)",
    "CREATE INDEX IF NOT EXISTS ix_billing_history_user_id ON billing_history(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_billing_history_billing_date ON billing_history(billing_date)",
]


def _apply_schema_patches():
    """Run each patch in its own transaction so one failure doesn't block the rest."""
    from sqlalchemy import text
    from database import _get_engine
    engine = _get_engine()
    applied = 0
    for sql in _SCHEMA_PATCHES:
        try:
            with engine.begin() as conn:
                conn.execute(text(sql))
            applied += 1
        except Exception as e:
            # Most common harmless failure: table doesn't exist yet (will after
            # create_all on the next boot) or the column already exists in a
            # form that pg can't compare. Log and continue.
            logger.warning(f"Schema patch skipped: {sql} → {e}")
    logger.info(f"Schema patches: {applied}/{len(_SCHEMA_PATCHES)} applied")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT} | Debug: {settings.DEBUG}")

    # 1. Create any missing tables (idempotent — never alters existing).
    try:
        import models  # noqa: F401  (side effect: registers tables with Base.metadata)
        from database import Base, _get_engine
        Base.metadata.create_all(bind=_get_engine())
        logger.info("Database tables ensured (create_all complete)")
    except Exception as e:
        logger.error(f"Failed to ensure database tables: {e}", exc_info=True)

    # 2. Patch existing tables with any columns the model gained later.
    try:
        _apply_schema_patches()
    except Exception as e:
        logger.error(f"Schema-patch step failed: {e}", exc_info=True)

    # 3. Start the nightly self-expansion scheduler (Packet 3.5).
    # No-op when EXPANSION_SCHEDULER_ENABLED=False or apscheduler is missing.
    try:
        from jobs.nightly_expansion import setup_scheduler
        setup_scheduler(app)
    except Exception as e:
        logger.error(f"Scheduler setup failed: {e}", exc_info=True)

    yield
    logger.info(f"Shutting down {settings.APP_NAME}")
    try:
        from jobs.nightly_expansion import shutdown_scheduler
        shutdown_scheduler(app)
    except Exception as e:
        logger.warning(f"Scheduler shutdown error: {e}")


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered personalized learning platform",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    debug=settings.DEBUG,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    response = await call_next(request)
    logger.info(f"{request.method} {request.url.path} → {response.status_code}")
    return response


@app.get("/health", tags=["system"])
async def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


def _mask_database_url(url: str) -> dict:
    """Parse DATABASE_URL into safe-to-display parts (no password)."""
    import re
    if not url:
        return {"set": False}
    m = re.match(
        r"^(?P<scheme>[^:]+)://(?P<user>[^:]+):(?P<pw>[^@]+)@(?P<host>[^:/]+)(:(?P<port>\d+))?/(?P<db>[^?]+)(\?(?P<query>.*))?$",
        url,
    )
    if not m:
        return {
            "set": True,
            "parseable": False,
            "scheme_prefix": url.split("://")[0] if "://" in url else "?",
        }
    return {
        "set": True,
        "parseable": True,
        "scheme": m.group("scheme"),
        "user": m.group("user"),
        "host": m.group("host"),
        "port": m.group("port") or "default",
        "database": m.group("db"),
        "query": m.group("query") or "",
        "is_pooler": "pooler.supabase.com" in m.group("host"),
        "is_direct": m.group("host").startswith("db.") and "supabase.co" in m.group("host"),
    }


@app.get("/db-health", tags=["system"])
async def db_health_check():
    """Diagnostic: shows masked DATABASE_URL parts and connection status (no password)."""
    from database import check_connection

    url_info = _mask_database_url(settings.DATABASE_URL or "")
    connected = False
    error_msg = None
    try:
        connected = check_connection()
    except Exception as e:
        error_msg = str(e)

    return {
        "database_url": url_info,
        "connected": connected,
        "error": error_msg,
        "cors_origins": settings.ALLOWED_ORIGINS,
        "google_oauth_configured": bool(settings.GOOGLE_CLIENT_ID),
        "claude_configured": bool(settings.CLAUDE_API_KEY),
        "youtube_configured": bool(settings.YOUTUBE_API_KEY),
        "frontend_url": settings.FRONTEND_URL,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/", tags=["system"])
async def root():
    return {
        "message": "LearnPath AI API",
        "docs": "/docs",
        "version": settings.APP_VERSION,
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.DEBUG else "An error occurred",
        },
    )


# Stage 1: Core pipeline routers
from routers import youtube, eqs, summary, concept_graph, path, cache
app.include_router(youtube.router, prefix="/api/youtube", tags=["youtube"])
app.include_router(eqs.router, prefix="/api/eqs", tags=["eqs"])
app.include_router(summary.router, prefix="/api/summary", tags=["summary"])
app.include_router(concept_graph.router, prefix="/api/concepts", tags=["concepts"])
app.include_router(path.router, prefix="/api/path", tags=["path"])
app.include_router(cache.router, prefix="/api/cache", tags=["cache"])

# Wire up search orchestration service (uses all Stage 1 singletons)
import services.search_service as _search_mod
from services.youtube_service import youtube_service
from services.eqs_service import EQSService
from services.summary_service import SummaryService
from services.concept_graph_service import concept_graph_service
from services.path_service import path_service
from services.cache_service import cache_service

_search_mod.search_service = _search_mod.SearchService(
    youtube_service=youtube_service,
    eqs_service=EQSService(),
    summary_service=SummaryService(),
    concept_graph_service=concept_graph_service,
    path_service=path_service,
    cache_service=cache_service,
)

# Stage 2: User layer routers
from routers import auth, session, progress, questions, search
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(session.router, prefix="/api/sessions", tags=["sessions"])
app.include_router(progress.router, prefix="/api/progress", tags=["progress"])
app.include_router(questions.router, prefix="/api/questions", tags=["questions"])
app.include_router(search.router, prefix="/api/search", tags=["search"])

# Stage 3: Intelligence layer routers
from routers import branching, blacklist, eqs_expanded, remediation, expansion
app.include_router(branching.router, prefix="/api/branching", tags=["branching"])
app.include_router(blacklist.router, prefix="/api/blacklist", tags=["blacklist"])
app.include_router(eqs_expanded.router, prefix="/api/eqs/expanded", tags=["eqs-expanded"])
app.include_router(remediation.router, prefix="/api/remediation", tags=["remediation"])
app.include_router(expansion.router, prefix="/api/expansion", tags=["expansion"])

# Stage 4: Monetization layer routers
from routers import subscriptions, usage, free_tier, features, analytics, referral, loyalty
app.include_router(subscriptions.router, prefix="/api/subscriptions", tags=["subscriptions"])
app.include_router(subscriptions.payments_router, prefix="/api/payments", tags=["payments"])
app.include_router(usage.router, prefix="/api/usage", tags=["usage"])
app.include_router(free_tier.router, prefix="/api/free-tier", tags=["free-tier"])
app.include_router(features.router, prefix="/api/features", tags=["features"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(referral.router, prefix="/api/referral", tags=["referral"])
app.include_router(loyalty.router, prefix="/api/loyalty", tags=["loyalty"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
