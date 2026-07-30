from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
from datetime import datetime

from config import settings
from config_validator import startup_checks
from services.performance_monitor import PerformanceMiddleware

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Error monitoring (Stage 2). No-op unless SENTRY_DSN is set; import is optional
# so a missing SDK never blocks boot.
if settings.SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            release=settings.APP_VERSION,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            send_default_pii=False,  # don't ship user PII to Sentry
            integrations=[StarletteIntegration(), FastApiIntegration()],
        )
        logger.info("Sentry error monitoring initialized")
    except Exception as e:  # pragma: no cover
        logger.warning(f"Sentry init failed (continuing without it): {e}")


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
    # Role-based access control: every user gets a role (default 'user').
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'user'",
    # Concept-scoped quizzes (path modules launch a quiz filtered to a concept).
    "ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS concept VARCHAR",
    # Study-buddy presence.
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP",
    # Link a Teacher record to its platform User (ADMIN-1.1). The teacher dashboard
    # query depends on this column.
    "ALTER TABLE teachers ADD COLUMN IF NOT EXISTS user_id UUID",
    "CREATE INDEX IF NOT EXISTS idx_teachers_user_id ON teachers(user_id)",
    # ADMIN-2.3 class management: grade level on class metadata.
    "ALTER TABLE class_metadata ADD COLUMN IF NOT EXISTS grade_level INTEGER",
    # Performance indexes (Packet 6.2) — auto-applied so no manual migration.
    "CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier)",
    "CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_path_sessions_user_created ON path_sessions(user_id, started_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_path_sessions_youtube_id ON path_sessions(youtube_id)",
    "CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_user_progress_user_topic ON user_progress(user_id, topic_id)",
    "CREATE INDEX IF NOT EXISTS idx_concept_progress_user_id ON concept_progress(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_quiz_responses_user_created ON quiz_responses(user_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_fsrs_cards_user_due ON fsrs_cards(user_id, due_date)",
    # NEW-PACKET-B: video chunking tables
    "CREATE INDEX IF NOT EXISTS ix_video_chunks_video_id ON video_chunks(video_id)",
    "CREATE INDEX IF NOT EXISTS ix_video_chunks_chunk_number ON video_chunks(chunk_number)",
    "CREATE INDEX IF NOT EXISTS ix_chapter_quizzes_chunk_id ON chapter_quizzes(chunk_id)",
    "CREATE INDEX IF NOT EXISTS ix_chapter_quiz_questions_quiz_id ON chapter_quiz_questions(chapter_quiz_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_chapter_progress_user_chunk ON chapter_progress(user_id, chunk_id)",
    # Chapter-generation lifecycle status (fixes the endless "generating…" loop).
    "ALTER TABLE videos ADD COLUMN IF NOT EXISTS chunk_status VARCHAR",
    "ALTER TABLE videos ADD COLUMN IF NOT EXISTS chunk_error VARCHAR",
    # NEW-PACKET-A: learner profile & placement test tables (idempotent)
    "CREATE INDEX IF NOT EXISTS ix_user_profiles_user_id ON user_profiles(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_placement_tests_user_id ON placement_tests(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_profiling_history_user_id ON profiling_history(user_id)",
    # path_sessions — core watch/progress columns. The ORM SELECTs every mapped
    # column, so a single missing one 500s all reads (e.g. /api/progress/*).
    # Session writes were made fault-tolerant earlier (return a stub on failure),
    # which masked this drift until the read paths surfaced it.
    "ALTER TABLE path_sessions ADD COLUMN IF NOT EXISTS video_id UUID",
    "ALTER TABLE path_sessions ADD COLUMN IF NOT EXISTS video_watched BOOLEAN DEFAULT FALSE",
    "ALTER TABLE path_sessions ADD COLUMN IF NOT EXISTS watch_percentage INTEGER DEFAULT 0",
    "ALTER TABLE path_sessions ADD COLUMN IF NOT EXISTS last_position_seconds INTEGER DEFAULT 0",
    "ALTER TABLE path_sessions ADD COLUMN IF NOT EXISTS total_watch_time_seconds INTEGER DEFAULT 0",
    "ALTER TABLE path_sessions ADD COLUMN IF NOT EXISTS playback_speed FLOAT DEFAULT 1.0",
    "ALTER TABLE path_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMP DEFAULT now()",
    "ALTER TABLE path_sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP",
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
    # ADMIN-1.6: Settings & Profile tables
    "CREATE INDEX IF NOT EXISTS ix_teacher_profiles_user_id ON teacher_profiles(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_two_factor_auth_user_id ON two_factor_auth(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_user_sessions_user_id ON user_sessions(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_user_sessions_expires_at ON user_sessions(expires_at)",
    "CREATE INDEX IF NOT EXISTS ix_login_activity_user_id ON login_activity(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_login_activity_created_at ON login_activity(created_at)",
    "CREATE INDEX IF NOT EXISTS ix_teacher_preferences_user_id ON teacher_preferences(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_integrations_user_id ON integrations(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_class_metadata_class_id ON class_metadata(class_id)",
    "CREATE INDEX IF NOT EXISTS ix_class_metadata_teacher_id ON class_metadata(teacher_id)",
    "CREATE INDEX IF NOT EXISTS ix_data_export_requests_user_id ON data_export_requests(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_account_deletion_requests_user_id ON account_deletion_requests(user_id)",
    # ADMIN-1.5: Messaging & Communication tables
    "CREATE INDEX IF NOT EXISTS ix_conversations_teacher_id ON conversations(teacher_id)",
    "CREATE INDEX IF NOT EXISTS ix_conversations_updated_at ON conversations(updated_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_messages_conversation_id ON messages(conversation_id)",
    "CREATE INDEX IF NOT EXISTS ix_messages_created_at ON messages(created_at)",
    "CREATE INDEX IF NOT EXISTS ix_message_read_receipts_message_id ON message_read_receipts(message_id)",
    "CREATE INDEX IF NOT EXISTS ix_message_read_receipts_user_id ON message_read_receipts(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_typing_indicators_conv_expires ON typing_indicators(conversation_id, expires_at)",
    "CREATE INDEX IF NOT EXISTS ix_announcements_teacher_id ON announcements(teacher_id)",
    "CREATE INDEX IF NOT EXISTS ix_announcements_class_id ON announcements(class_id)",
    "CREATE INDEX IF NOT EXISTS ix_announcement_reads_ann_id ON announcement_reads(announcement_id)",
    "CREATE INDEX IF NOT EXISTS ix_announcement_reads_student_id ON announcement_reads(student_id)",
    "CREATE INDEX IF NOT EXISTS ix_notification_prefs_user_id ON notification_preferences(user_id)",
    "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS flutterwave_id VARCHAR",
    "CREATE INDEX IF NOT EXISTS ix_transactions_user_id ON transactions(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_transactions_reference ON transactions(reference)",
    "CREATE INDEX IF NOT EXISTS ix_transactions_status ON transactions(status)",
    "CREATE INDEX IF NOT EXISTS ix_transactions_created_at ON transactions(created_at)",
    "CREATE INDEX IF NOT EXISTS ix_transactions_flutterwave_id ON transactions(flutterwave_id)",
    "CREATE INDEX IF NOT EXISTS ix_billing_history_user_id ON billing_history(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_billing_history_billing_date ON billing_history(billing_date)",
    # ADMIN-2.1: School Admin Foundation
    "CREATE INDEX IF NOT EXISTS ix_school_profiles_org ON school_profiles(organization_id)",
    "CREATE INDEX IF NOT EXISTS ix_school_user_roles_school ON school_user_roles(school_id, role_type)",
    "CREATE INDEX IF NOT EXISTS ix_school_health_school ON school_health_metrics(school_id, snapshot_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_school_alerts_school ON school_alerts(school_id, severity, status)",
    "CREATE INDEX IF NOT EXISTS ix_school_alerts_created ON school_alerts(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_school_activity_school ON school_activity_log(school_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_school_activity_actor ON school_activity_log(actor_user_id)",
    "CREATE INDEX IF NOT EXISTS ix_teacher_invitations_school ON teacher_invitations(school_id, status)",
    "CREATE INDEX IF NOT EXISTS ix_teacher_invitations_email ON teacher_invitations(email)",
    "CREATE INDEX IF NOT EXISTS ix_student_bulk_uploads_school ON student_bulk_uploads(school_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_school_onboarding_school ON school_onboarding(school_id)",
    "CREATE INDEX IF NOT EXISTS ix_engagement_snapshots_school ON engagement_snapshots(school_id, snapshot_date DESC)",
    "CREATE INDEX IF NOT EXISTS ix_at_risk_cache_school ON at_risk_students_cache(school_id, risk_level)",
    "CREATE INDEX IF NOT EXISTS ix_school_recs_school ON school_recommendations(school_id, priority DESC)",
    "CREATE INDEX IF NOT EXISTS ix_weekly_digest_school ON weekly_digest_snapshots(school_id, week_start_date DESC)",
    # ADMIN-2.2: Teacher & Student Management
    "CREATE INDEX IF NOT EXISTS ix_teacher_school_profiles_school ON teacher_school_profiles(school_id, is_active)",
    "CREATE INDEX IF NOT EXISTS ix_student_school_profiles_school ON student_school_profiles(school_id, is_active)",
    "CREATE INDEX IF NOT EXISTS ix_student_school_profiles_grade ON student_school_profiles(school_id, grade_level)",
    "CREATE INDEX IF NOT EXISTS ix_student_school_profiles_risk ON student_school_profiles(school_id, at_risk_status)",
    "CREATE INDEX IF NOT EXISTS ix_parent_contacts_student ON parent_contacts(student_id)",
    "CREATE INDEX IF NOT EXISTS ix_parent_contacts_school ON parent_contacts(school_id)",
    "CREATE INDEX IF NOT EXISTS ix_teacher_activity_log_teacher ON teacher_activity_log(teacher_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_student_activity_log_student ON student_activity_log(student_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_class_reassignment_class ON class_reassignment_history(class_id, reassigned_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_class_enrollment_audit_student ON class_enrollment_audit(student_id, action_timestamp DESC)",
    "CREATE INDEX IF NOT EXISTS ix_bulk_mgmt_ops_school ON bulk_management_operations(school_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_teacher_deactivation_school ON teacher_deactivation_records(school_id, deactivated_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_student_deactivation_school ON student_deactivation_records(school_id, deactivated_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_student_enroll_invites_school ON student_enrollment_invitations(school_id, status)",
    "CREATE INDEX IF NOT EXISTS ix_parent_comm_log_student ON parent_communication_log(student_id, created_at DESC)",
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

    # 0. Validate configuration (Packet 6.2). startup_checks() exits the
    # process itself if a CRITICAL check (Configuration/Database) fails.
    # Non-critical checks (e.g. external API reachability) only warn — we do
    # NOT treat a False return as fatal here, or a flaky optional dependency
    # would brick the whole backend on boot.
    try:
        startup_checks()
    except SystemExit:
        raise
    except Exception as e:
        logger.error(f"Startup checks error: {e}", exc_info=True)

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

    # 2.5 Seed sample quiz questions on first boot (idempotent — no-ops once
    # any question exists, so curated content added later is never touched).
    try:
        from jobs.quiz_seed import seed_quiz_questions_if_empty
        seed_quiz_questions_if_empty()
    except Exception as e:
        logger.error(f"Quiz-seed step failed: {e}", exc_info=True)

    # 2.6 Seed WAEC curriculum data (idempotent — skips rows that exist).
    try:
        from services.curriculum_service import curriculum_service
        from database import _get_session_factory
        _sf = _get_session_factory()
        with _sf() as _db:
            seeded = curriculum_service.seed(_db)
            if seeded:
                logger.info(f"WAEC curriculum seeded: {seeded} rows")
    except Exception as e:
        logger.error(f"WAEC curriculum seed failed: {e}", exc_info=True)

    # 2.6 Promote configured admin emails (ADMIN_EMAILS) — no SQL needed.
    try:
        emails = [e.strip().lower() for e in (settings.ADMIN_EMAILS or "").split(",") if e.strip()]
        if emails:
            from database import _get_session_factory
            from models import User
            from sqlalchemy import func
            db = _get_session_factory()()
            try:
                promoted = (
                    db.query(User)
                    .filter(func.lower(User.email).in_(emails), User.role != "admin")
                    .update({"role": "admin"}, synchronize_session=False)
                )
                db.commit()
                if promoted:
                    logger.info(f"Promoted {promoted} configured admin user(s)")
            finally:
                db.close()
    except Exception as e:
        logger.error(f"Admin-bootstrap step failed: {e}", exc_info=True)

    # 3. Start the nightly self-expansion scheduler (Packet 3.5).
    # No-op when EXPANSION_SCHEDULER_ENABLED=False or apscheduler is missing.
    try:
        from jobs.nightly_expansion import setup_scheduler
        setup_scheduler(app)
    except Exception as e:
        logger.error(f"Scheduler setup failed: {e}", exc_info=True)

    # 3.5 Daily auto-adaptation of adaptive paths (NEW-PACKET-H).
    try:
        from jobs.path_adaptation import setup_path_adaptation_scheduler
        setup_path_adaptation_scheduler(app)
    except Exception as e:
        logger.error(f"Path-adaptation scheduler setup failed: {e}", exc_info=True)

    yield
    logger.info(f"Shutting down {settings.APP_NAME}")
    try:
        from jobs.nightly_expansion import shutdown_scheduler
        shutdown_scheduler(app)
    except Exception as e:
        logger.warning(f"Scheduler shutdown error: {e}")
    try:
        from jobs.path_adaptation import shutdown_path_adaptation_scheduler
        shutdown_path_adaptation_scheduler(app)
    except Exception as e:
        logger.warning(f"Path-adaptation scheduler shutdown error: {e}")


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

# Performance monitoring middleware (Packet 6.2)
app.add_middleware(PerformanceMiddleware)


@app.middleware("http")
async def request_context(request: Request, call_next):
    """Attach a request id, time the request, log a structured line, and make sure
    unhandled errors are captured (Sentry) with a clean JSON 500 carrying the id."""
    import time
    import uuid

    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
    start = time.time()

    try:
        import sentry_sdk
        sentry_sdk.set_tag("request_id", request_id)
    except Exception:
        pass

    try:
        response = await call_next(request)
    except Exception:
        duration_ms = int((time.time() - start) * 1000)
        logger.exception(
            f"[{request_id}] {request.method} {request.url.path} -> 500 ({duration_ms}ms)"
        )
        try:
            import sentry_sdk
            sentry_sdk.capture_exception()
        except Exception:
            pass
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "request_id": request_id},
            headers={"X-Request-ID": request_id},
        )

    duration_ms = int((time.time() - start) * 1000)
    response.headers["X-Request-ID"] = request_id
    logger.info(
        f"[{request_id}] {request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)"
    )
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

# Stage 5: B2B & Institutional layer routers (Packet 5.0)
from routers import organizations, teachers, schools
app.include_router(organizations.router, prefix="/api/organizations", tags=["organizations"])
app.include_router(teachers.router, prefix="/api/teachers", tags=["teachers"])
app.include_router(schools.router, prefix="/api/schools", tags=["schools"])

# Packet 6.5: Customer Success admin dashboard (org health, churn, CS emails)
from routers import customer_success
app.include_router(customer_success.router)

# NEW-PACKET-A: Learner Profile System & Onboarding
from routers import learner
app.include_router(learner.router)

# NEW-PACKET-B: Video Chunking Service
from routers import video_chunks
app.include_router(video_chunks.router)

# NEW-PACKET-D: Study Notes AI Generation
from routers import notes as notes_router
app.include_router(notes_router.router)

# NEW-PACKET-E: User Note Upload + Transformation
from routers import content as content_router
app.include_router(content_router.router)

# NEW-PACKET-F: School-like dashboard
from routers import dashboard as dashboard_router
app.include_router(dashboard_router.router)

# NEW-PACKET-G: Concept knowledge graph
from routers import knowledge as knowledge_router
app.include_router(knowledge_router.router)

# NEW-PACKET-H: Adaptive learning paths
from routers import adaptive_paths as adaptive_paths_router
app.include_router(adaptive_paths_router.router)

# NEW-PACKET-I: Exam-specific tracks
from routers import exams as exams_router
app.include_router(exams_router.router)

# PHASE 2: Study-buddy social system
from routers import buddies as buddies_router
app.include_router(buddies_router.router)

# PHASE 2: Real-time presence + message push (WebSocket)
from routers import realtime as realtime_router
app.include_router(realtime_router.router)

# NEW-PACKET-C: Interactive Quiz System with Adaptive Difficulty (IRT)
from routers import quizzes
app.include_router(quizzes.router)

# PHASE 1: WAEC Curriculum + Diagnostics + Readiness
from routers import curriculum as curriculum_router
app.include_router(curriculum_router.router, prefix="/api/curriculum", tags=["curriculum"])

# PHASE 1: AI Tutor (Lexi)
from routers import tutor as tutor_router
app.include_router(tutor_router.router, prefix="/api/tutor", tags=["tutor"])

# ADMIN-1.5: Messaging & Communication
from routers import messaging as messaging_router
app.include_router(messaging_router.router)

# ADMIN-1.6: Settings & Profile
from routers import settings as settings_router
app.include_router(settings_router.router)

# ADMIN-2.1: School Admin Foundation
from routers import school_admin as school_admin_router
app.include_router(school_admin_router.router)

# ADMIN-2.2: Teacher & Student Management
from routers import teacher_student_mgmt as ts_mgmt_router
app.include_router(ts_mgmt_router.router)

# ADMIN-2.4: School Billing
from routers import billing as billing_router
app.include_router(billing_router.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
