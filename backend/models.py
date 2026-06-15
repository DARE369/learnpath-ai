from sqlalchemy import (
    Column, String, Integer, Float, Boolean,
    DateTime, Date, Text, ForeignKey, JSON, UniqueConstraint, Numeric,
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=True)
    full_name = Column(String)
    google_id = Column(String, unique=True, nullable=True, index=True)
    auth_provider = Column(String, default="email", nullable=False)
    country = Column(String)
    age = Column(Integer)
    email_verified = Column(Boolean, default=False)
    account_active = Column(Boolean, default=True)
    role = Column(String, default="user", nullable=False, index=True)  # student | teacher | school_admin | admin (legacy "user" == student)
    last_seen_at = Column(DateTime, nullable=True)  # presence (throttled in get_current_user)
    tier = Column(String, default="free")
    tier_updated_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime)
    profile_image_url = Column(String)
    bio = Column(String)
    preferences = Column(JSON, default=dict)

    progress = relationship("UserProgress", back_populates="user")
    sessions = relationship("PathSession", back_populates="user")


class Topic(Base):
    __tablename__ = "topics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, unique=True, nullable=False, index=True)
    description = Column(Text)
    keywords = Column(ARRAY(String), default=list)
    category = Column(String)
    difficulty = Column(String)
    curriculum_name = Column(String)
    curriculum_version = Column(String)
    video_count = Column(Integer, default=0)
    user_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    language = Column(String, default="en")
    is_featured = Column(Boolean, default=False)
    popularity_score = Column(Float, default=0)


class Video(Base):
    __tablename__ = "videos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    youtube_id = Column(String, unique=True, nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    channel_id = Column(String, index=True)
    channel_name = Column(String)
    duration_seconds = Column(Integer)
    transcript_cached = Column(Boolean, default=False)
    transcript = Column(Text)
    transcript_timestamps = Column(JSON)           # [{text, start, duration}, ...]
    transcript_unavailable = Column(Boolean, default=False)
    transcript_fetched_at = Column(DateTime)
    published_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    view_count = Column(Integer, default=0)
    like_count = Column(Integer, default=0)
    comment_count = Column(Integer, default=0)
    language = Column(String, default="en")


class VideoScore(Base):
    __tablename__ = "video_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id = Column(UUID(as_uuid=True), ForeignKey("videos.id"), nullable=False, index=True)
    topic_id = Column(UUID(as_uuid=True), ForeignKey("topics.id"), index=True)
    eqs_algorithm_version = Column(String, nullable=False, index=True)
    score = Column(Integer)
    confidence = Column(Integer)
    pedagogical_score = Column(Integer)
    credibility_score = Column(Integer)
    length_score = Column(Integer)
    engagement_score = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    evaluated_at = Column(DateTime)
    next_reevaluation_at = Column(DateTime)
    is_valid = Column(Boolean, default=True)
    invalidated_at = Column(DateTime)


class UserProgress(Base):
    __tablename__ = "user_progress"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    topic_id = Column(UUID(as_uuid=True), ForeignKey("topics.id"), nullable=False, index=True)
    videos_watched = Column(Integer, default=0)
    videos_total = Column(Integer, default=0)
    completion_percentage = Column(Integer, default=0)
    quiz_attempts = Column(Integer, default=0)
    quiz_score = Column(Float)
    concepts_learned = Column(Integer, default=0)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime)
    last_activity_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status = Column(String, default="in_progress")

    user = relationship("User", back_populates="progress")


class PathSession(Base):
    __tablename__ = "path_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    topic_id = Column(UUID(as_uuid=True), ForeignKey("topics.id"), nullable=False, index=True)
    video_id = Column(UUID(as_uuid=True), ForeignKey("videos.id"), index=True)
    # path_id stored as string until LearningPath model is created (Packet 2.3+)
    path_id = Column(String, index=True)
    youtube_id = Column(String, index=True)
    video_index = Column(Integer, default=0)
    session_number = Column(Integer)
    video_watched = Column(Boolean, default=False)
    watch_percentage = Column(Integer, default=0)
    last_position_seconds = Column(Integer, default=0)
    max_position_seconds = Column(Integer, default=0)
    total_watch_time_seconds = Column(Integer, default=0)
    playback_speed = Column(Float, default=1.0)
    timestamp_watched = Column(String)
    post_video_question = Column(Text)
    post_video_answer = Column(Text)
    answer_feedback = Column(Text)
    answer_score = Column(Integer)
    questions_answered = Column(Integer, default=0)
    questions_correct = Column(Integer, default=0)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime)
    notes = Column(Text)

    user = relationship("User", back_populates="sessions")


class ConceptProgress(Base):
    __tablename__ = "concept_progress"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    topic_id = Column(UUID(as_uuid=True), ForeignKey("topics.id"), index=True)
    concept_name = Column(String, nullable=False, index=True)
    mastery_score = Column(Float, default=0.0)
    encounters = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    wrong_answers = Column(Integer, default=0)
    status = Column(String, default="not_started")
    first_seen_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_seen_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SearchEvent(Base):
    """
    Per-search log (Packet 3.5).

    Written by SearchService after every successful search_and_build_path call.
    Powers the "popular topic" identification — count distinct query_normalized
    over the last 30 days, threshold at >10. Wrapped in best-effort try/except
    in SearchService so a write failure can never block search.
    """
    __tablename__ = "search_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    query_normalized = Column(String, nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    source = Column(String)  # cache | generated | remediated
    average_score = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class CachedPath(Base):
    """
    Durable, cross-user store for an assembled learning path (the "persistence
    stage" the in-memory CacheService was always meant to graduate into).

    A path is topic-level (videos + concepts, no personal data), so one row is
    shared by every user who searches that topic — generated once, reused forever
    (until invalidated), saving Claude/YouTube tokens. Per-user progress lives
    elsewhere (adaptive_paths, progress); this is just the reusable content.
    """
    __tablename__ = "cached_paths"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    topic_id = Column(String, unique=True, nullable=False, index=True)
    query_normalized = Column(String, index=True)  # query→topic lookup layer
    path_json = Column(JSON, nullable=False)  # the full assembled path dict
    video_count = Column(Integer, default=0)
    average_score = Column(Integer, default=0)
    created_by_user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    times_served = Column(Integer, default=0)  # reuse counter (token-savings metric)
    valid = Column(Boolean, default=True, index=True)
    last_validated_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RevokedToken(Base):
    """Denylist for refresh / password-reset token jtis (Stage 3 auth hardening).
    Logout and refresh-rotation add the old jti here; refresh and reset check it.
    `expires_at` lets a cleanup pass drop rows once the token would have expired."""
    __tablename__ = "revoked_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    jti = Column(String, unique=True, nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ProcessedWebhook(Base):
    """Idempotency log for payment webhooks (Stage 4). Each delivered event is
    recorded by a dedup key so Flutterwave retries are processed exactly once and
    we keep an audit trail."""
    __tablename__ = "processed_webhooks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_key = Column(String, unique=True, nullable=False, index=True)
    reference = Column(String, index=True)
    status = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class TopicAlias(Base):
    """
    Semantic dedup map (Packet 3.5).

    Nightly job clusters recent search queries via Claude Opus and writes one
    TopicAlias row per non-canonical query: alias_query → canonical_query.

    NOTE: SearchService does NOT consult this map yet — alias mappings are
    surfaced in the admin dashboard for human validation before any auto-
    redirect behavior gets wired up.
    """
    __tablename__ = "topic_aliases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alias_query = Column(String, nullable=False, index=True)
    canonical_query = Column(String, nullable=False, index=True)
    similarity_score = Column(Float)  # Claude's confidence 0-1
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class TopicKeyword(Base):
    """Keyword index for popular topics (Packet 3.5)."""
    __tablename__ = "topic_keywords"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    topic_query = Column(String, nullable=False, index=True)
    keyword = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class NightlyRun(Base):
    """One row per nightly_expansion run (Packet 3.5)."""
    __tablename__ = "nightly_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    finished_at = Column(DateTime)
    duration_seconds = Column(Float)

    distinct_queries_scanned = Column(Integer, default=0)
    aliases_created = Column(Integer, default=0)
    popular_topics_count = Column(Integer, default=0)
    keywords_extracted = Column(Integer, default=0)
    topics_expanded = Column(Integer, default=0)

    expansion_cost_ngn = Column(Float, default=0)
    branching_cost_ngn = Column(Float, default=0)
    skipped_budget = Column(Boolean, default=False)

    errors = Column(JSON, default=list)
    status = Column(String, default="running")  # running | success | partial | failed


class RemediationEvent(Base):
    """
    Auto-remediation attempt log (Packet 3.4).

    Written once per remediation attempt (success or failure) so the stats
    endpoint can compute success rate by tier and average duration.
    """
    __tablename__ = "remediation_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    query_normalized = Column(String, nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    original_score = Column(Integer)
    remediated_score = Column(Integer)
    tier_used = Column(String, nullable=False, index=True)  # tier_1|tier_2|tier_3|none
    success = Column(Boolean, default=False, index=True)
    duration_ms = Column(Integer)

    notes = Column(Text)  # error message, fallback reason, etc.

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ExpandedVideoScore(Base):
    """
    11-criterion expanded EQS scores (Packet 3.3).

    Coexists with the legacy VideoScore table — old EQS (0-100) still powers
    the search pipeline; this table feeds the confidence dashboard and any
    future migration. Keyed on youtube_id (string), no FK to videos.id.
    """
    __tablename__ = "expanded_video_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    youtube_id = Column(String, nullable=False, index=True)

    base_scores = Column(JSON, default=dict)                # {pedagogy, clarity, credibility, length}
    bonus_scores = Column(JSON, default=dict)               # {engagement, production, recency, ...}
    base_score = Column(Integer, nullable=False)            # 0-100 (sum of base_scores)
    total_score = Column(Integer, nullable=False, index=True)  # 0-170 (base + bonus)
    confidence_level = Column(String, nullable=False, index=True)  # poor|acceptable|good|excellent|outstanding
    cache_ttl_days = Column(Integer, default=0)

    reasoning = Column(Text)
    algorithm_version = Column(String, default="expanded_v1")
    is_valid = Column(Boolean, default=True, index=True)

    evaluated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    next_reevaluation_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class VideoBlacklist(Base):
    """
    Soft- or hard-blacklisted videos (Packet 3.2).

    Keyed by youtube_id (string), not videos.id (UUID) — matches the
    path_sessions.youtube_id pattern. SearchService deals in youtube_ids
    and doesn't always materialise a videos row.
    """
    __tablename__ = "video_blacklist"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    youtube_id = Column(String, nullable=False, index=True)

    blacklist_type = Column(String, nullable=False, default="soft")  # "soft" | "hard"
    reason = Column(String)
    last_score = Column(Integer)  # EQS that triggered (null for manual)

    blacklist_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    retry_date = Column(DateTime)  # null for hard

    is_active = Column(Boolean, default=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BlacklistFeedback(Base):
    """User feedback on shadow-tested blacklisted videos (Packet 3.2)."""
    __tablename__ = "blacklist_feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    youtube_id = Column(String, nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    rating = Column(Integer)  # 1-5
    feedback = Column(Text)
    helpful = Column(Boolean)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ConceptBranch(Base):
    """
    Progressive learning branches for a concept (Packet 3.1).

    `concept_key` is the lowercased concept name and is the lookup key —
    branches do NOT FK to topics.id because search-built concepts live
    outside the topics table (same pattern as path_sessions.path_id).
    """
    __tablename__ = "concept_branches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    concept_key = Column(String, nullable=False, index=True)
    concept_name = Column(String, nullable=False)

    branch_title = Column(String, nullable=False)
    description = Column(Text)
    difficulty_level = Column(Integer)
    prerequisites = Column(JSON, default=list)
    estimated_duration_minutes = Column(Integer, default=30)
    branch_order = Column(Integer, default=0, index=True)

    algorithm_version = Column(String, default="v1")
    is_active = Column(Boolean, default=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Subscription(Base):
    """
    A user's subscription record (Packet 4.1).

    One user can have many rows over time, but at most ONE active row at a
    time (enforced in SubscriptionService, not the DB). `plan_type` is the
    plan currently in effect; `pending_plan_type` holds a queued downgrade
    that the daily renewal job applies at `renewal_date`.
    """
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    plan_type = Column(String, nullable=False, default="free")   # free | pro | premium
    pending_plan_type = Column(String, nullable=True)            # queued downgrade target
    billing_cycle = Column(String, nullable=False, default="monthly")  # monthly | yearly

    start_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    renewal_date = Column(DateTime, index=True)

    price_paid = Column(Float, default=0)
    currency = Column(String, default="NGN")

    status = Column(String, nullable=False, default="active", index=True)  # active | cancelled | expired
    auto_renew = Column(Boolean, default=True)
    cancelled_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Transaction(Base):
    """
    A single payment attempt against Flutterwave (Packet 4.1).

    `reference` is our tx_ref sent to Flutterwave and is the idempotency key
    for verification + webhook reconciliation.
    """
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id"), nullable=True)

    plan_type = Column(String)  # plan this payment is for
    amount = Column(Float, nullable=False)
    currency = Column(String, default="NGN")

    payment_method = Column(String)  # card | bank_transfer | ussd | mobile_money
    reference = Column(String, unique=True, nullable=False, index=True)  # our tx_ref
    flutterwave_id = Column(String, index=True)  # Flutterwave's transaction id (on success)

    status = Column(String, nullable=False, default="pending", index=True)  # pending | successful | failed | refunded

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BillingHistory(Base):
    """
    Immutable billing line items (Packet 4.1).

    Written on every successful charge and on each auto-renewal, capturing a
    usage snapshot at billing time so invoices stay accurate even as live
    usage counters keep moving.
    """
    __tablename__ = "billing_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id"), nullable=True)

    billing_date = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    amount = Column(Float, default=0)
    currency = Column(String, default="NGN")
    plan_used = Column(String)  # which plan was billed
    description = Column(String)  # e.g. "Pro plan — monthly renewal"

    # usage snapshot at billing time
    videos_watched = Column(Integer, default=0)
    hours_learned = Column(Float, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ReferralCode(Base):
    """
    One row per user — created on first request, persists for life.
    `earnings_this_month` resets transparently in ReferralService when the
    stored `earnings_month` (YYYY-MM) differs from the current month, so no
    cron job is needed to enforce the monthly cap.
    """
    __tablename__ = "referral_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False, index=True)
    code = Column(String(20), unique=True, nullable=False, index=True)

    total_referrals = Column(Integer, default=0)
    successful_referrals = Column(Integer, default=0)
    total_earnings = Column(Float, default=0.0)
    earnings_this_month = Column(Float, default=0.0)
    earnings_month = Column(String(7))  # "YYYY-MM"; resets when month changes

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Referral(Base):
    """One row per referred-user relationship (Packet 4.6)."""
    __tablename__ = "referrals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    referrer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    referred_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    referral_code = Column(String(20), nullable=False, index=True)

    status = Column(String, nullable=False, default="pending")  # pending | signed_up | rewarded
    clicked_at = Column(DateTime, nullable=True)
    signed_up_at = Column(DateTime, nullable=True)
    reward_given_at = Column(DateTime, nullable=True)
    reward_amount = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class LoyaltyPoints(Base):
    """
    Running loyalty point balance per user (Packet 4.6).
    `total_points` is spendable (decrements on redemption).
    `lifetime_points` only ever increases and drives tier calculation so users
    don't lose tier status when they redeem rewards.
    """
    __tablename__ = "loyalty_points"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False, index=True)

    total_points = Column(Integer, default=0)       # spendable balance
    lifetime_points = Column(Integer, default=0)    # always-increasing tier driver

    current_tier = Column(String, default="bronze")
    bonus_multiplier = Column(Float, default=1.0)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LoyaltyHistory(Base):
    """Immutable ledger of every point earn/spend (Packet 4.6)."""
    __tablename__ = "loyalty_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    action_type = Column(String, nullable=False)   # video_watch | question | upgrade | referral | redeem
    points_delta = Column(Integer, nullable=False)  # positive = earned, negative = spent
    balance_after = Column(Integer, nullable=False)
    description = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class RewardCode(Base):
    """Generated reward codes produced when a user redeems loyalty points (Packet 4.6)."""
    __tablename__ = "reward_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    code = Column(String(20), unique=True, nullable=False, index=True)
    reward_type = Column(String, nullable=False)   # discount | free_month | three_months
    reward_value = Column(Integer, nullable=False)  # NGN amount or months
    points_cost = Column(Integer, nullable=False)

    is_used = Column(Boolean, default=False)
    used_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class QuestionAnswer(Base):
    """Stores answered questions and drives spaced-repetition scheduling."""
    __tablename__ = "question_answers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    topic_id = Column(UUID(as_uuid=True), ForeignKey("topics.id"), index=True)
    concept_name = Column(String, nullable=False, index=True)

    question = Column(Text, nullable=False)
    correct_answer = Column(Text, nullable=False)
    student_answer = Column(Text, nullable=False)

    score = Column(Integer)
    is_correct = Column(Boolean)
    explanation = Column(Text)
    feedback = Column(Text)

    times_reviewed = Column(Integer, default=1)
    next_review_at = Column(DateTime, index=True)
    last_reviewed_at = Column(DateTime)

    answer_time_seconds = Column(Integer)
    confidence = Column(Integer)
    difficulty = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ═══════════════════════════════════════════════════════════════════════════════
# PACKET 5.0: B2B & INSTITUTIONAL (Schools, Teachers, Classes)
# ═══════════════════════════════════════════════════════════════════════════════


class Organization(Base):
    """School or institution account (Packet 5.0)"""
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, index=True)
    type = Column(String, default="school")  # school | coaching_center | corporate | bootcamp
    country = Column(String)
    city = Column(String)
    admin_email = Column(String, nullable=False)
    admin_name = Column(String)
    phone = Column(String)
    website = Column(String)

    subscription_tier = Column(String, default="trial")  # trial | starter | pro | enterprise
    subscription_start_date = Column(DateTime)
    subscription_end_date = Column(DateTime)
    status = Column(String, default="active")  # active | trial | suspended | canceled

    student_count = Column(Integer, default=0)
    teacher_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Teacher(Base):
    """School staff member (Packet 5.0)"""
    __tablename__ = "teachers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    # Links this teacher record to the platform User (added ADMIN-1.1). Nullable
    # for legacy rows; new teachers are provisioned with it set.
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    role = Column(String, default="teacher")  # teacher | department_head | principal
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Class(Base):
    """School classroom/group (Packet 5.0)"""
    __tablename__ = "classes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=False, index=True)
    name = Column(String, nullable=False)  # e.g., "SS1 English", "Grade 10 Math"
    subject = Column(String)
    description = Column(Text)
    max_students = Column(Integer, default=50)
    enrolled_students = Column(Integer, default=0)
    learning_path_id = Column(UUID(as_uuid=True), nullable=True)  # Link to learning path

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClassMembership(Base):
    """Student enrollment in a class (Packet 5.0)"""
    __tablename__ = "class_memberships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    enrollment_status = Column(String, default="active")  # active | completed | dropped
    enrolled_date = Column(DateTime, default=datetime.utcnow)
    progress_percent = Column(Integer, default=0)
    average_score = Column(Integer, default=0)
    last_active = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class TeacherAssignment(Base):
    """A homework/quiz/content assignment a teacher gives a class (ADMIN-1.3).
    Type-specific payload lives in content_data (JSON) so we don't need a table
    per type. Student submission/auto-grading/notifications are a later packet."""
    __tablename__ = "teacher_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=False, index=True)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False, index=True)

    name = Column(String, nullable=False)
    description = Column(Text)
    # quick_quiz | custom_quiz | video | path | document | discussion | external_link
    assignment_type = Column(String, default="document")
    content_data = Column(JSON, default=dict)  # link/url, doc note, question list, content id…

    due_date = Column(DateTime, nullable=True)
    deadline_type = Column(String, default="allow_anytime")  # allow_anytime | hard_cutoff | late_with_penalty
    late_penalty_percent = Column(Integer, nullable=True)
    late_penalty_days = Column(Integer, nullable=True)

    assigned_to_type = Column(String, default="whole_class")  # whole_class | individuals
    is_active = Column(Boolean, default=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AssignmentSubmission(Base):
    """One student's submission/grade record for an assignment (ADMIN-1.3). A row
    is created per targeted student at assignment time (status 'assigned')."""
    __tablename__ = "assignment_submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("teacher_assignments.id"), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    submission_data = Column(JSON, default=dict)
    status = Column(String, default="assigned", index=True)  # assigned | submitted | pending_manual | graded
    auto_score = Column(Integer, nullable=True)
    manual_score = Column(Integer, nullable=True)
    teacher_notes = Column(Text, nullable=True)

    is_late = Column(Boolean, default=False)
    submitted_at = Column(DateTime, nullable=True)
    graded_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (UniqueConstraint("assignment_id", "student_id", name="uq_assignment_student"),)


class OrganizationSubscription(Base):
    """School subscription tier and limits (Packet 5.0)"""
    __tablename__ = "organization_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, unique=True, index=True)
    tier = Column(String, nullable=False)  # starter | pro | enterprise
    student_limit = Column(Integer)
    teacher_limit = Column(Integer)
    class_limit = Column(Integer)
    features = Column(JSON, default=dict)

    start_date = Column(DateTime, default=datetime.utcnow)
    end_date = Column(DateTime)
    auto_renew = Column(Boolean, default=True)
    status = Column(String, default="active")  # active | expired | canceled

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class OrganizationPayment(Base):
    """School subscription payment (Packet 5.0)"""
    __tablename__ = "organization_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("organization_subscriptions.id"), nullable=True)

    amount = Column(Float, nullable=False)  # In NGN
    currency = Column(String, default="NGN")
    billing_period_start = Column(Date)
    billing_period_end = Column(Date)
    invoice_number = Column(String, unique=True, index=True)
    status = Column(String, default="pending")  # paid | pending | overdue | failed

    due_date = Column(Date)
    paid_date = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TeacherAnalytics(Base):
    """Daily analytics for teacher (Packet 5.0)"""
    __tablename__ = "teacher_analytics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=False, index=True)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)

    active_students = Column(Integer, default=0)
    avg_quiz_score = Column(Float, default=0)
    total_time_minutes = Column(Integer, default=0)
    paths_completed = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SchoolAnalytics(Base):
    """Daily analytics for school (Packet 5.0)"""
    __tablename__ = "school_analytics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)

    total_active_students = Column(Integer, default=0)
    total_active_teachers = Column(Integer, default=0)
    avg_student_score = Column(Float, default=0)
    paths_completed = Column(Integer, default=0)
    time_spent_hours = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# NEW-PACKET-C: Interactive Quiz System with Adaptive Difficulty (IRT)

class QuizSession(Base):
    """Quiz session - groups all questions in one quiz attempt (NEW-PACKET-C)"""
    __tablename__ = "quiz_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    topic_id = Column(UUID(as_uuid=True), ForeignKey("topics.id"), nullable=True, index=True)

    session_started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    session_completed_at = Column(DateTime, nullable=True)

    # Quiz metadata
    quiz_type = Column(String, default="section")  # section | module | full_path | mock_exam
    concept = Column(String, nullable=True)  # optional concept_id to scope the question pool
    total_questions = Column(Integer, default=5)
    questions_answered = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    score_percent = Column(Integer, default=0)

    # Timing
    total_time_seconds = Column(Integer, default=0)
    avg_time_per_question = Column(Integer, default=0)

    # IRT results
    estimated_ability = Column(Float, default=0.0)  # θ ability estimate
    ability_range = Column(JSON, default=dict)  # {"low": -1.5, "high": 0.8}

    # Analysis
    weak_concepts = Column(ARRAY(String), default=list)
    strong_concepts = Column(ARRAY(String), default=list)

    # Feedback
    performance_level = Column(String)  # below_average | average | above_average | expert
    recommendation = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class QuizQuestion(Base):
    """Quiz questions - cached for fast loading (NEW-PACKET-C)"""
    __tablename__ = "quiz_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    topic_id = Column(UUID(as_uuid=True), ForeignKey("topics.id"), nullable=True, index=True)

    question_text = Column(Text, nullable=False)
    question_type = Column(String, default="multiple_choice")  # multiple_choice | true_false | short_answer

    # Options (for MC/TF)
    options = Column(JSON, default=list)  # [{"text": "A", "correct": true, "id": "A"}, ...]

    # IRT parameters
    difficulty_parameter = Column(Float, default=0.0)  # -3 to +3 (lower = easier)
    discrimination_parameter = Column(Float, default=1.0)  # How well it measures ability
    guessing_parameter = Column(Float, default=0.0)  # Probability of guessing correctly

    # Answer explanation
    correct_answer_id = Column(String)
    explanation = Column(Text)
    explanation_for_each_option = Column(JSON, default=dict)  # {"A": "Why...", "B": "Why...", ...}

    # Metadata
    concept_id = Column(String, index=True)  # Link to knowledge concept
    tags = Column(ARRAY(String), default=list)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class QuizResponse(Base):
    """User quiz responses - core data for IRT + analytics (NEW-PACKET-C)"""
    __tablename__ = "quiz_responses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    quiz_session_id = Column(UUID(as_uuid=True), ForeignKey("quiz_sessions.id"), nullable=False, index=True)
    question_id = Column(UUID(as_uuid=True), ForeignKey("quiz_questions.id"), nullable=False, index=True)

    # User's answer
    user_answer_id = Column(String)
    is_correct = Column(Boolean, default=False)

    # Confidence (1-10 scale)
    confidence_rating = Column(Integer, default=5)  # 1 = not sure, 10 = very sure
    confidence_appropriate = Column(Boolean, default=False)  # Matches correctness?

    # Timing
    time_spent_seconds = Column(Integer, default=0)

    # IRT tracking
    learner_ability_before = Column(Float, default=0.0)  # θ before this Q
    learner_ability_after = Column(Float, default=0.0)  # θ after this Q

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ConceptMastery(Base):
    """Concept mastery tracking - aggregate progress per concept (NEW-PACKET-C)"""
    __tablename__ = "concept_mastery"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    concept_id = Column(String, nullable=False, index=True)

    # Mastery tracking
    questions_attempted = Column(Integer, default=0)
    questions_correct = Column(Integer, default=0)
    accuracy_percent = Column(Integer, default=0)

    # Progress
    is_mastered = Column(Boolean, default=False)  # >80% accuracy
    mastered_date = Column(DateTime, nullable=True)

    last_attempted = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class FSRSCard(Base):
    """Spaced repetition cards (FSRS scheduling) (NEW-PACKET-C)"""
    __tablename__ = "fsrs_cards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    # Card content (from failed quiz questions)
    source_type = Column(String, default="quiz_question")  # quiz_question | flashcard
    source_id = Column(UUID(as_uuid=True))

    # FSRS state
    state = Column(String, default="new")  # new | learning | reviewing | relearning
    due_date = Column(DateTime, default=datetime.utcnow)

    # Metrics
    stability = Column(Float, default=1.0)  # Resistance to forgetting
    difficulty = Column(Float, default=5.0)  # Estimated difficulty (0-10)
    elapsed_days = Column(Integer, default=0)
    scheduled_days = Column(Integer, default=1)
    reps = Column(Integer, default=0)  # Number of reviews
    lapses = Column(Integer, default=0)  # Number of failures
    last_reviewed = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# NEW-PACKET-A: Learner Profile System & Onboarding

class UserProfile(Base):
    """Extended learner profile captured during onboarding (NEW-PACKET-A)"""
    __tablename__ = "user_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False, index=True)

    # Onboarding state
    onboarding_completed = Column(Boolean, default=False)
    onboarding_completed_at = Column(DateTime, nullable=True)

    # Step 1 — study goals
    # [{goal, target_score, deadline_date, days_to_deadline}]
    study_goals = Column(JSON, default=list)

    # Step 2 — current level
    current_level = Column(String, nullable=True)          # beginner|intermediate|advanced
    placement_test_completed = Column(Boolean, default=False)
    placement_test_score = Column(Integer, nullable=True)  # 0-100
    self_assessed = Column(Boolean, default=False)

    # Step 3 — derived pace
    required_hours_per_week = Column(Float, nullable=True)
    required_hours_per_day = Column(Float, nullable=True)

    # Step 4 — time commitment
    weekly_commitment_hours = Column(Integer, nullable=True)
    preferred_study_times = Column(ARRAY(String), default=list)

    # Step 5 — learning styles
    learning_styles = Column(ARRAY(String), default=list)

    # Re-profiling (quarterly)
    last_profiling_date = Column(DateTime, nullable=True)
    next_profiling_date = Column(DateTime, nullable=True)
    profiling_frequency_days = Column(Integer, default=90)

    # Preferences
    difficulty_preference = Column(String, default="auto")
    notification_frequency = Column(String, default="daily_digest")
    language = Column(String, default="en")

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PlacementTest(Base):
    """Records for adaptive placement tests (NEW-PACKET-A)"""
    __tablename__ = "placement_tests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    test_started_at = Column(DateTime, default=datetime.utcnow)
    test_completed_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)

    questions_answered = Column(Integer, default=0)
    questions_correct = Column(Integer, default=0)
    score_percent = Column(Integer, nullable=True)          # 0-100

    # Adaptive tracking
    difficulty_sequence = Column(ARRAY(String), default=list)
    estimated_level = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ProfilingHistory(Base):
    """Snapshot diffs written on each quarterly re-profile (NEW-PACKET-A)"""
    __tablename__ = "profiling_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    study_goals_before = Column(JSON, nullable=True)
    study_goals_after = Column(JSON, nullable=True)
    current_level_before = Column(String, nullable=True)
    current_level_after = Column(String, nullable=True)
    weekly_hours_before = Column(Integer, nullable=True)
    weekly_hours_after = Column(Integer, nullable=True)

    goals_changed = Column(Boolean, default=False)
    level_changed = Column(Boolean, default=False)
    pace_changed = Column(Boolean, default=False)

    profiling_type = Column(String, default="quarterly")   # quarterly|manual|on_request
    completed_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# NEW-PACKET-B: Video Chunking Service — Micro-Learning & Section-Based Learning

class VideoChunk(Base):
    """AI-generated chapter segment of a video (NEW-PACKET-B)"""
    __tablename__ = "video_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id = Column(UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, index=True)

    chunk_number = Column(Integer, nullable=False)          # 1, 2, 3 …
    title = Column(String(255))
    description = Column(Text)

    start_timestamp = Column(String(12))                    # "0:00"
    end_timestamp = Column(String(12))                      # "2:45"
    start_seconds = Column(Integer, default=0)
    end_seconds = Column(Integer, default=0)
    duration_seconds = Column(Integer, default=0)

    learning_objective = Column(String(512))
    key_concepts = Column(ARRAY(String), default=list)
    summary = Column(Text)

    # AI generation provenance
    ai_generated = Column(Boolean, default=True)
    ai_model = Column(String(50))

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ChapterQuiz(Base):
    """Quiz auto-generated for a single video chapter (NEW-PACKET-B)"""
    __tablename__ = "chapter_quizzes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chunk_id = Column(UUID(as_uuid=True), ForeignKey("video_chunks.id", ondelete="CASCADE"), nullable=False, index=True)

    question_count = Column(Integer, default=2)
    estimated_time_seconds = Column(Integer, default=120)
    ai_generated_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ChapterQuizQuestion(Base):
    """Individual question inside a chapter quiz (NEW-PACKET-B)"""
    __tablename__ = "chapter_quiz_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chapter_quiz_id = Column(UUID(as_uuid=True), ForeignKey("chapter_quizzes.id", ondelete="CASCADE"), nullable=False, index=True)

    question_number = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(50), default="multiple_choice")
    # [{"text": "...", "correct": True/False}, ...]
    options = Column(JSON, default=list)
    explanation = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ChapterProgress(Base):
    """Per-user viewing and quiz progress on a single chapter (NEW-PACKET-B)"""
    __tablename__ = "chapter_progress"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_id = Column(UUID(as_uuid=True), ForeignKey("video_chunks.id", ondelete="CASCADE"), nullable=False, index=True)

    started_at = Column(DateTime, nullable=True)
    watched_seconds = Column(Integer, default=0)
    completion_percent = Column(Integer, default=0)
    completed_at = Column(DateTime, nullable=True)

    quiz_score = Column(Integer, nullable=True)          # 0-100
    quiz_attempts = Column(Integer, default=0)
    best_quiz_score = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# NEW-PACKET-D: Study Notes AI Generation
# Notes are keyed by youtube_id (shared, cached) like video_chunks; each style
# is generated lazily on first request and cached on its own row.

class StudyNote(Base):
    """A study-notes record for one video (NEW-PACKET-D)."""
    __tablename__ = "study_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    youtube_id = Column(String, nullable=False, unique=True, index=True)

    source_title = Column(String)
    transcript_preview = Column(Text)          # first ~500 chars
    word_count = Column(Integer, default=0)
    estimated_read_time_minutes = Column(Integer, default=0)

    generated_by_user_id = Column(UUID(as_uuid=True), nullable=True)  # first generator

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class NoteStyle(Base):
    """One generated style (standard|simple|technical|bullet_points|mindmap)."""
    __tablename__ = "note_styles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    study_note_id = Column(UUID(as_uuid=True), ForeignKey("study_notes.id"), nullable=False, index=True)

    style_name = Column(String, nullable=False, index=True)
    content = Column(Text)                     # Markdown
    word_count = Column(Integer, default=0)
    generated_by = Column(String, default="claude")

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class NoteFlashcard(Base):
    """Auto-extracted flashcard from a study note (NEW-PACKET-D)."""
    __tablename__ = "note_flashcards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    study_note_id = Column(UUID(as_uuid=True), ForeignKey("study_notes.id"), nullable=False, index=True)

    front_text = Column(Text, nullable=False)
    back_text = Column(Text, nullable=False)
    source_concept = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# NEW-PACKET-E: User Note Upload + Transformation
# An uploaded document/URL plus its lazily-generated transformations
# (ai_explanation, flashcards, youtube_match, quiz), each cached on its own row.

class UserUpload(Base):
    """A user-uploaded document or URL awaiting/holding transformations."""
    __tablename__ = "user_uploads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    original_filename = Column(String)
    file_type = Column(String)                 # pdf | image | docx | txt | url
    file_size_bytes = Column(Integer, default=0)
    source_url = Column(String)
    source_title = Column(String)

    extraction_status = Column(String, default="pending")  # pending|processing|complete|failed
    extraction_error = Column(Text)
    extracted_text = Column(Text)
    detected_subject = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ContentTransformation(Base):
    """One generated transformation for an upload (cached per type)."""
    __tablename__ = "content_transformations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    upload_id = Column(UUID(as_uuid=True), ForeignKey("user_uploads.id"), nullable=False, index=True)

    transform_type = Column(String, nullable=False, index=True)  # ai_explanation|flashcards|youtube_match|quiz
    result_content = Column(Text)              # markdown or JSON string
    result_format = Column(String, default="markdown")  # markdown | json
    item_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class UploadFlashcard(Base):
    """Individual flashcard extracted from an upload — enrollable in FSRS review."""
    __tablename__ = "uploaded_flashcards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    upload_id = Column(UUID(as_uuid=True), ForeignKey("user_uploads.id"), nullable=False, index=True)

    front_text = Column(Text, nullable=False)
    back_text = Column(Text, nullable=False)
    source_concept = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# NEW-PACKET-F: School-like dashboard — streaks + achievements.

class UserStreak(Base):
    """Per-user learning streak (recomputed from activity)."""
    __tablename__ = "user_streaks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False, index=True)

    current_streak_days = Column(Integer, default=0)
    longest_streak_days = Column(Integer, default=0)
    last_activity_date = Column(Date, nullable=True)
    streak_started_date = Column(Date, nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserAchievement(Base):
    """An unlocked badge for a user (NEW-PACKET-F)."""
    __tablename__ = "user_achievements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    achievement_id = Column(String, nullable=False, index=True)  # consistent_learner, etc.
    achievement_name = Column(String)
    achievement_icon = Column(String)
    achievement_description = Column(Text)

    unlocked_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# NEW-PACKET-G: Concept knowledge graph.
# Nodes (Concept) + edges (ConceptRelationship). User mastery is read from the
# existing ConceptMastery table, joined by concept_name == ConceptMastery.concept_id.

class Concept(Base):
    """A node in the knowledge graph."""
    __tablename__ = "concepts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    concept_name = Column(String, unique=True, nullable=False, index=True)  # join key
    display_name = Column(String)
    description = Column(Text)

    subject = Column(String, index=True)
    topic = Column(String, index=True)
    difficulty_level = Column(Integer, default=5)  # 1-10

    created_by = Column(String, default="system")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ConceptRelationship(Base):
    """A directed edge between two concepts."""
    __tablename__ = "concept_relationships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_concept_id = Column(UUID(as_uuid=True), ForeignKey("concepts.id"), nullable=False, index=True)
    target_concept_id = Column(UUID(as_uuid=True), ForeignKey("concepts.id"), nullable=False, index=True)

    # prerequisite: target must be learned before source
    # related | extends | leads_to
    relationship_type = Column(String, nullable=False, default="related", index=True)
    strength = Column(Float, default=0.7)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# NEW-PACKET-H: Adaptive learning paths.

class AdaptivePath(Base):
    """A personalized, adapting learning sequence toward a goal concept."""
    __tablename__ = "adaptive_paths"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    path_name = Column(String)
    goal_concept_id = Column(UUID(as_uuid=True), ForeignKey("concepts.id"), nullable=True)

    target_completion_weeks = Column(Integer, default=12)
    target_success_rate = Column(Float, default=0.7)

    started_at = Column(DateTime, default=datetime.utcnow)
    original_end_date = Column(Date, nullable=True)

    current_module_number = Column(Integer, default=1)
    completed_modules = Column(Integer, default=0)
    total_modules = Column(Integer, default=0)
    is_active = Column(Boolean, default=True, index=True)

    last_adapted_at = Column(DateTime, nullable=True)
    times_adapted = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PathModule(Base):
    """One ordered step in an adaptive path."""
    __tablename__ = "path_modules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    adaptive_path_id = Column(UUID(as_uuid=True), ForeignKey("adaptive_paths.id"), nullable=False, index=True)

    module_number = Column(Integer)
    module_title = Column(String)
    module_type = Column(String, default="lesson")  # lesson | quiz | review
    content_concept_id = Column(UUID(as_uuid=True), nullable=True)

    estimated_duration_minutes = Column(Integer, default=45)
    recommended_difficulty = Column(String, default="medium")  # easy | medium | hard
    difficulty_multiplier = Column(Float, default=1.0)

    module_status = Column(String, default="pending", index=True)  # pending|in_progress|completed|skipped
    user_start_date = Column(DateTime, nullable=True)
    user_end_date = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ModulePerformance(Base):
    """A user's performance on a path module."""
    __tablename__ = "module_performance"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    path_module_id = Column(UUID(as_uuid=True), ForeignKey("path_modules.id"), nullable=False, index=True)

    time_spent_minutes = Column(Integer, default=0)
    quiz_score_percent = Column(Integer, nullable=True)
    attempts = Column(Integer, default=1)
    completion_percent = Column(Integer, default=100)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class PathAdaptation(Base):
    """Audit log of an adaptation applied to a path."""
    __tablename__ = "path_adaptations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    adaptive_path_id = Column(UUID(as_uuid=True), ForeignKey("adaptive_paths.id"), nullable=False, index=True)

    adaptation_type = Column(String)  # difficulty_up|difficulty_down|pacing_increase|pacing_decrease|gap_inserted
    reason = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# NEW-PACKET-I: Exam-specific tracks (IELTS / SAT / WAEC ...).

class ExamTrack(Base):
    """A structured exam-prep track (catalogue entry)."""
    __tablename__ = "exam_tracks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_type = Column(String, unique=True, nullable=False, index=True)  # ielts | sat | waec
    name = Column(String, nullable=False)
    description = Column(Text)
    score_scale = Column(String)            # e.g. "Band 0-9"
    sections = Column(JSON, default=list)   # [{"name": "Listening"}, ...]

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ExamEnrollment(Base):
    """A user's enrollment in an exam track."""
    __tablename__ = "exam_enrollments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    exam_track_id = Column(UUID(as_uuid=True), ForeignKey("exam_tracks.id"), nullable=False, index=True)

    target_score = Column(String)           # e.g. "7.0"
    exam_date = Column(Date, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MockExamAttempt(Base):
    """A logged mock-exam result, used to track progress + refine predictions."""
    __tablename__ = "mock_exam_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    exam_track_id = Column(UUID(as_uuid=True), ForeignKey("exam_tracks.id"), nullable=False, index=True)

    overall_percent = Column(Integer, default=0)
    section_scores = Column(JSON, default=dict)   # {"Listening": 72, ...}
    predicted_score = Column(String)

    taken_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


# PHASE 2: Study-buddy social graph.

class BuddyConnection(Base):
    """A study-buddy link between two users (pending until accepted)."""
    __tablename__ = "buddy_connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requester_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    status = Column(String, default="pending", index=True)  # pending | accepted
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    accepted_at = Column(DateTime, nullable=True)


class SharedItem(Base):
    """A note or uploaded-content item shared from one user to a buddy."""
    __tablename__ = "shared_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    item_type = Column(String, nullable=False)   # note | upload
    item_ref = Column(String, nullable=False)     # youtube_id (note) or upload_id (content)
    title = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class BuddyMessage(Base):
    """A direct message between two buddies."""
    __tablename__ = "buddy_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    body = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


# ─── WAEC Curriculum Layer ────────────────────────────────────────────────────
# Three-level hierarchy: Subject → Topic → Subtopic
# Seeded from backend/data/waec_curriculum.json on first startup.

class WAECSubject(Base):
    """A WAEC examinable subject (e.g. Mathematics, Biology)."""
    __tablename__ = "waec_subjects"

    id = Column(String, primary_key=True)          # slug e.g. "mathematics"
    name = Column(String, nullable=False)
    code = Column(String, nullable=False)          # e.g. "MAT"
    category = Column(String, nullable=False)      # compulsory|science|arts|commercial
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class WAECTopic(Base):
    """A curriculum topic within a WAEC subject, mapped to SS level."""
    __tablename__ = "waec_topics"

    id = Column(String, primary_key=True)          # e.g. "mat-ss1-1"
    subject_id = Column(String, ForeignKey("waec_subjects.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    ss_level = Column(String, nullable=False, index=True)   # SS1|SS2|SS3|ALL
    order = Column(Integer, default=0)
    exam_weight = Column(Integer, default=5)       # estimated % of WAEC marks
    description = Column(Text)
    subtopics = Column(ARRAY(String), default=list)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ─── AI Tutor Session ─────────────────────────────────────────────────────────

class TutorSession(Base):
    """A conversation session between a user and the AI tutor."""
    __tablename__ = "tutor_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    # Context at session start — what the user was studying
    subject = Column(String, nullable=True)
    topic_id = Column(String, nullable=True)       # waec_topic.id
    video_title = Column(String, nullable=True)
    learning_path_id = Column(String, nullable=True)

    message_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    last_message_at = Column(DateTime, nullable=True)


class TutorMessage(Base):
    """A single message in a tutor conversation."""
    __tablename__ = "tutor_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("tutor_sessions.id"), nullable=False, index=True)
    role = Column(String, nullable=False)          # "user" | "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ─── Exam Readiness Score ─────────────────────────────────────────────────────

class ExamReadinessScore(Base):
    """
    Per-subject readiness score for a user.
    Recomputed after each study session or diagnostic.
    Stored so the dashboard can load instantly without re-computing.
    """
    __tablename__ = "exam_readiness_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    subject_id = Column(String, ForeignKey("waec_subjects.id"), nullable=False, index=True)

    score = Column(Integer, default=0)             # 0-100
    diagnostic_score = Column(Integer, nullable=True)   # score from initial diagnostic
    weak_topics = Column(ARRAY(String), default=list)   # topic IDs with lowest mastery
    strong_topics = Column(ARRAY(String), default=list)

    # Trend: list of last 7 daily scores for the sparkline
    score_history = Column(ARRAY(Integer), default=list)

    computed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ─── Diagnostic Result ────────────────────────────────────────────────────────

class DiagnosticResult(Base):
    """Stores the result of a per-subject diagnostic assessment at onboarding."""
    __tablename__ = "diagnostic_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    subject_id = Column(String, ForeignKey("waec_subjects.id"), nullable=False)
    ss_level = Column(String, nullable=True)       # SS1|SS2|SS3

    total_questions = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    score_percent = Column(Integer, default=0)

    # Which topics were tested and how the user did per topic
    topic_scores = Column(JSON, default=dict)      # {topic_id: {correct: int, total: int}}
    weak_topic_ids = Column(ARRAY(String), default=list)

    taken_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ─── ADMIN-1.5: Messaging & Communication ─────────────────────────────────────

class Conversation(Base):
    """A 1-on-1 or group message thread initiated by a teacher (ADMIN-1.5)."""
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    conversation_type = Column(String, nullable=False)  # direct | group
    conversation_name = Column(String, nullable=False)  # student name or group label

    # Serialised list of all participant user UUIDs (teacher + students)
    participant_ids = Column(ARRAY(String), default=list)

    # Group metadata — NULL for direct conversations
    group_type = Column(String, nullable=True)      # at_risk | advanced | custom
    group_criteria = Column(JSON, nullable=True)    # {risk_level, topic, class_id, …}

    retention_days = Column(Integer, nullable=True)  # 30/60/90 or NULL = never delete

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Message(Base):
    """A single message inside a Conversation (ADMIN-1.5)."""
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    sender_role = Column(String)  # teacher | student

    content = Column(Text, nullable=False)
    links = Column(JSON, default=list)  # [{url, title}, …]

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MessageReadReceipt(Base):
    """Tracks whether each recipient has read a specific message (ADMIN-1.5)."""
    __tablename__ = "message_read_receipts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    is_read = Column(Boolean, default=False, index=True)
    read_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("message_id", "user_id", name="uq_msg_read_user"),)


class TypingIndicator(Base):
    """Ephemeral typing status for a conversation (expires_at drives cleanup, ADMIN-1.5)."""
    __tablename__ = "typing_indicators"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    is_typing = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)

    __table_args__ = (UniqueConstraint("conversation_id", "user_id", name="uq_typing_conv_user"),)


class Announcement(Base):
    """Class-wide broadcast from a teacher — students cannot reply (ADMIN-1.5)."""
    __tablename__ = "announcements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    links = Column(JSON, default=list)

    scheduled_for = Column(DateTime, nullable=True)  # NULL = send now
    sent_at = Column(DateTime, nullable=True)
    status = Column(String, default="sent", index=True)  # draft | scheduled | sent

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AnnouncementRead(Base):
    """Per-student read/acknowledgement for an Announcement (ADMIN-1.5)."""
    __tablename__ = "announcement_reads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    announcement_id = Column(UUID(as_uuid=True), ForeignKey("announcements.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    is_read = Column(Boolean, default=False, index=True)
    read_at = Column(DateTime, nullable=True)

    acknowledged = Column(Boolean, default=False)
    acknowledged_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("announcement_id", "student_id", name="uq_ann_read_student"),)


class NotificationPreference(Base):
    """Per-user notification channel settings (ADMIN-1.5)."""
    __tablename__ = "notification_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True, index=True)

    # Email
    email_enabled = Column(Boolean, default=True)
    email_direct_messages = Column(Boolean, default=True)
    email_group_messages = Column(Boolean, default=True)
    email_announcements = Column(Boolean, default=True)
    email_replies = Column(Boolean, default=True)
    email_frequency = Column(String, default="immediate")  # immediate | daily_digest

    # In-app
    in_app_enabled = Column(Boolean, default=True)
    in_app_direct_messages = Column(Boolean, default=True)
    in_app_group_messages = Column(Boolean, default=True)
    in_app_announcements = Column(Boolean, default=True)
    in_app_replies = Column(Boolean, default=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ─── ADMIN-1.6: Settings & Profile ────────────────────────────────────────────

class TeacherProfile(Base):
    """Extended profile info for a teacher user (ADMIN-1.6)."""
    __tablename__ = "teacher_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    bio = Column(Text, nullable=True)
    phone = Column(String(30), nullable=True)
    school_name = Column(String(255), nullable=True)

    # ["K", "1-3", "4-6", "7-8", "9-12", "higher_ed"]
    grade_levels = Column(JSON, default=list)

    # {"linkedin": "...", "twitter": "@...", "portfolio": "..."}
    social_links = Column(JSON, default=dict)

    avatar_url = Column(String(500), nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TwoFactorAuth(Base):
    """TOTP-based two-factor auth for a user (ADMIN-1.6)."""
    __tablename__ = "two_factor_auth"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    secret = Column(String(64), nullable=True)
    is_enabled = Column(Boolean, default=False, index=True)
    recovery_codes = Column(JSON, default=list)  # [{code, used}, …]

    enabled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class UserSession(Base):
    """Active login session per device (ADMIN-1.6)."""
    __tablename__ = "user_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    device_name = Column(String(255), nullable=True)
    device_type = Column(String(50), nullable=True)   # mobile | tablet | desktop
    os_name = Column(String(100), nullable=True)
    browser_name = Column(String(100), nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_activity = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)


class LoginActivity(Base):
    """Audit log of login attempts (ADMIN-1.6)."""
    __tablename__ = "login_activity"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    ip_address = Column(String(45), nullable=True)
    device_name = Column(String(255), nullable=True)
    os_name = Column(String(100), nullable=True)
    browser_name = Column(String(100), nullable=True)

    status = Column(String(50), nullable=False)      # success | failed
    failure_reason = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class TeacherPreference(Base):
    """Display and UX preferences per teacher (ADMIN-1.6)."""
    __tablename__ = "teacher_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    theme = Column(String(50), default="system")       # light | dark | system
    language = Column(String(10), default="en")
    timezone = Column(String(100), default="UTC")

    default_class_view = Column(String(50), default="list")  # list | grid | calendar
    auto_refresh_interval = Column(Integer, default=0)        # seconds (0 = off)
    remember_sidebar_state = Column(Boolean, default=True)

    # Notification extras (quiet hours — supplements NotificationPreference)
    quiet_hours_enabled = Column(Boolean, default=False)
    quiet_hours_start = Column(String(5), nullable=True)   # "20:00"
    quiet_hours_end = Column(String(5), nullable=True)     # "08:00"

    # Dashboard alert toggles
    alert_at_risk = Column(Boolean, default=True)
    alert_low_submission = Column(Boolean, default=True)
    alert_system = Column(Boolean, default=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Integration(Base):
    """Third-party OAuth connection per user/provider (ADMIN-1.6)."""
    __tablename__ = "integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    provider = Column(String(50), nullable=False)   # google_classroom | teams | zoom

    access_token = Column(String(1000), nullable=True)
    refresh_token = Column(String(1000), nullable=True)
    token_expires_at = Column(DateTime, nullable=True)

    provider_user_id = Column(String(255), nullable=True)
    provider_email = Column(String(255), nullable=True)
    provider_name = Column(String(255), nullable=True)

    auto_sync = Column(Boolean, default=True)
    last_sync = Column(DateTime, nullable=True)
    connected_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "provider", name="uq_integration_user_provider"),)


class ClassMetadata(Base):
    """Extended metadata for a class: archive status, external sync IDs (ADMIN-1.6)."""
    __tablename__ = "class_metadata"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    is_archived = Column(Boolean, default=False, index=True)
    archived_at = Column(DateTime, nullable=True)

    google_classroom_id = Column(String(255), nullable=True)
    grade_level = Column(Integer, nullable=True)  # ADMIN-2.3 class management

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class DataExportRequest(Base):
    """GDPR data export request (ADMIN-1.6)."""
    __tablename__ = "data_export_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    status = Column(String(50), default="pending", index=True)  # pending | processing | completed | failed
    download_url = Column(String(500), nullable=True)

    requested_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class AccountDeletionRequest(Base):
    """Soft-delete request with 30-day grace period (ADMIN-1.6)."""
    __tablename__ = "account_deletion_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    requested_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    scheduled_deletion_date = Column(DateTime, nullable=False)  # 30 days out

    status = Column(String(50), default="pending", index=True)  # pending | canceled | completed
    canceled_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)


# ── ADMIN-2.1: School Admin Foundation ────────────────────────────────────────

class SchoolProfile(Base):
    """Extended branding & configuration for a school org (ADMIN-2.1)."""
    __tablename__ = "school_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, unique=True, index=True)

    logo_url = Column(String(500), nullable=True)
    banner_color = Column(String(7), nullable=True)

    district_name = Column(String(255), nullable=True)
    address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(50), nullable=True)
    zip_code = Column(String(10), nullable=True)
    phone = Column(String(20), nullable=True)
    website = Column(String(500), nullable=True)

    timezone = Column(String(100), default="UTC")
    language = Column(String(10), default="en")
    academic_year_start = Column(Date, nullable=True)
    academic_year_end = Column(Date, nullable=True)

    max_teachers = Column(Integer, default=50)
    max_students = Column(Integer, default=2000)
    max_storage_gb = Column(Integer, default=100)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SchoolUserRole(Base):
    """Multi-level access control for school admins/staff (ADMIN-2.1)."""
    __tablename__ = "school_user_roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)

    role_type = Column(String(50), nullable=False)  # principal | admin | support_staff | finance
    permissions = Column(JSON, default=dict)
    scope = Column(String(50), default="all")  # all | department | assigned_only
    scope_details = Column(JSON, default=dict)

    assigned_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "school_id", name="uq_school_user_role"),)


class SchoolHealthMetric(Base):
    """Cached health snapshot for the school dashboard (ADMIN-2.1)."""
    __tablename__ = "school_health_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)

    snapshot_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    total_teachers = Column(Integer, default=0)
    active_teachers = Column(Integer, default=0)
    total_students = Column(Integer, default=0)
    enrolled_students = Column(Integer, default=0)
    total_classes = Column(Integer, default=0)
    active_classes = Column(Integer, default=0)

    teachers_active_today = Column(Float, default=0.0)
    students_active_today = Column(Float, default=0.0)
    assignments_created_today = Column(Integer, default=0)
    assignments_submitted_today = Column(Integer, default=0)

    avg_student_score = Column(Float, default=0.0)
    at_risk_student_count = Column(Integer, default=0)

    storage_used_gb = Column(Float, default=0.0)
    videos_created = Column(Integer, default=0)

    teacher_growth_pct = Column(Float, default=0.0)
    student_growth_pct = Column(Float, default=0.0)
    engagement_trend = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SchoolAlert(Base):
    """Auto-generated threshold alerts for principals (ADMIN-2.1)."""
    __tablename__ = "school_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)

    alert_type = Column(String(50), nullable=False, index=True)
    severity = Column(String(20), nullable=False, index=True)  # critical | high | medium | low

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    context_data = Column(JSON, default=dict)
    suggested_actions = Column(JSON, default=list)

    status = Column(String(50), default="active", index=True)  # active | muted | resolved
    muted_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    auto_resolve_condition = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SchoolActivityLog(Base):
    """Immutable audit trail for all school admin actions (ADMIN-2.1)."""
    __tablename__ = "school_activity_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    actor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(String(255), nullable=True)

    changes = Column(JSON, default=dict)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class TeacherInvitation(Base):
    """Teacher invite tokens with expiry and status tracking (ADMIN-2.1)."""
    __tablename__ = "teacher_invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    invited_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    email = Column(String(255), nullable=False, index=True)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)

    invite_token = Column(String(255), unique=True, nullable=False, index=True)
    invite_url = Column(String(500), nullable=True)
    expires_at = Column(DateTime, nullable=False)

    sent_at = Column(DateTime, nullable=True)
    reminder_sent_at = Column(DateTime, nullable=True)
    accepted_at = Column(DateTime, nullable=True)
    accepted_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    status = Column(String(50), default="sent", index=True)  # sent | clicked | accepted | expired

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class StudentBulkUpload(Base):
    """CSV import job tracking for bulk student enrollment (ADMIN-2.1)."""
    __tablename__ = "student_bulk_uploads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    uploaded_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    filename = Column(String(255), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)

    status = Column(String(50), default="pending", index=True)  # pending | processing | completed | failed
    total_rows = Column(Integer, default=0)
    processed_rows = Column(Integer, default=0)
    successful_rows = Column(Integer, default=0)
    failed_rows = Column(Integer, default=0)

    error_log = Column(JSON, default=list)
    created_student_count = Column(Integer, default=0)
    existing_student_count = Column(Integer, default=0)
    enrollment_errors = Column(Integer, default=0)

    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class SchoolOnboarding(Base):
    """Wizard checklist state for new school setup (ADMIN-2.1)."""
    __tablename__ = "school_onboarding"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, unique=True, index=True)
    principal_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    profile_complete = Column(Boolean, default=False)
    profile_completed_at = Column(DateTime, nullable=True)

    teachers_invited_count = Column(Integer, default=0)
    teachers_needed = Column(Integer, default=30)
    teachers_invitations_sent_at = Column(DateTime, nullable=True)

    students_uploaded = Column(Boolean, default=False)
    students_uploaded_count = Column(Integer, default=0)
    students_upload_completed_at = Column(DateTime, nullable=True)

    google_classroom_connected = Column(Boolean, default=False)
    google_classroom_connected_at = Column(DateTime, nullable=True)

    roles_configured = Column(Boolean, default=False)
    roles_configured_at = Column(DateTime, nullable=True)

    completion_percentage = Column(Integer, default=0)
    completed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EngagementSnapshot(Base):
    """Daily engagement stats for WoW trend calculations (ADMIN-2.1)."""
    __tablename__ = "engagement_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    snapshot_date = Column(Date, nullable=False)

    active_teachers = Column(Integer, default=0)
    active_students = Column(Integer, default=0)
    assignments_created = Column(Integer, default=0)
    assignments_submitted = Column(Integer, default=0)

    avg_teacher_logins = Column(Float, default=0.0)
    avg_student_logins = Column(Float, default=0.0)
    avg_student_score = Column(Float, default=0.0)
    at_risk_count = Column(Integer, default=0)
    storage_gb = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("school_id", "snapshot_date", name="uq_engagement_snapshot"),)


class AtRiskStudentCache(Base):
    """Denormalized at-risk student data for fast principal queries (ADMIN-2.1)."""
    __tablename__ = "at_risk_students_cache"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    current_score = Column(Float, default=0.0)
    score_trend = Column(Float, default=0.0)
    last_active = Column(DateTime, nullable=True)
    days_inactive = Column(Integer, default=0)

    risk_level = Column(String(50), default="medium", index=True)  # low | medium | high | critical
    risk_score = Column(Integer, default=0)

    risk_factors = Column(JSON, default=dict)
    suggested_actions = Column(JSON, default=list)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False, index=True)


class SchoolRecommendation(Base):
    """Smart suggestions engine for principals (ADMIN-2.1)."""
    __tablename__ = "school_recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)

    recommendation_type = Column(String(50), nullable=False)
    priority = Column(Integer, default=5, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    reasoning = Column(Text, nullable=True)

    expected_impact = Column(JSON, default=dict)
    suggested_action = Column(String(255), nullable=True)
    action_url = Column(String(500), nullable=True)

    dismissed = Column(Boolean, default=False, index=True)
    dismissed_at = Column(DateTime, nullable=True)
    acted_on = Column(Boolean, default=False)
    acted_on_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class WeeklyDigestSnapshot(Base):
    """Pre-computed weekly digest for email summaries (ADMIN-2.1)."""
    __tablename__ = "weekly_digest_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    week_start_date = Column(Date, nullable=False)
    week_end_date = Column(Date, nullable=False)

    new_teachers_count = Column(Integer, default=0)
    new_students_count = Column(Integer, default=0)
    new_classes_count = Column(Integer, default=0)

    teacher_engagement_pct = Column(Float, default=0.0)
    student_engagement_pct = Column(Float, default=0.0)
    assignment_completion_rate = Column(Float, default=0.0)

    top_performing_teachers = Column(JSON, default=list)
    most_active_classes = Column(JSON, default=list)

    new_at_risk_students = Column(Integer, default=0)
    resolved_alerts_count = Column(Integer, default=0)
    active_alerts_count = Column(Integer, default=0)

    key_insights = Column(JSON, default=list)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


# ── ADMIN-2.2: Teacher & Student Management ────────────────────────────────

class TeacherSchoolProfile(Base):
    """Extended teacher info scoped to a school (ADMIN-2.2)."""
    __tablename__ = "teacher_school_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)

    hire_date = Column(Date, nullable=True)
    department = Column(String(255), nullable=True)

    is_active = Column(Boolean, default=True, index=True)
    is_invited = Column(Boolean, default=False)
    accepted_invitation_at = Column(DateTime, nullable=True)

    deactivated_at = Column(DateTime, nullable=True)
    deactivation_reason = Column(String(255), nullable=True)

    total_classes = Column(Integer, default=0)
    total_students = Column(Integer, default=0)
    total_assignments_created = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class StudentSchoolProfile(Base):
    """Extended student info scoped to a school (ADMIN-2.2)."""
    __tablename__ = "student_school_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)

    enrollment_date = Column(Date, nullable=True)
    student_id_number = Column(String(50), nullable=True)
    grade_level = Column(Integer, nullable=True, index=True)

    is_active = Column(Boolean, default=True, index=True)
    is_enrolled = Column(Boolean, default=False)
    enrollment_completed_at = Column(DateTime, nullable=True)

    deactivated_at = Column(DateTime, nullable=True)
    deactivation_reason = Column(String(255), nullable=True)

    total_classes = Column(Integer, default=0)
    avg_score = Column(Float, default=0.0)
    at_risk_status = Column(String(50), default="none", index=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ParentContact(Base):
    """Parent/guardian contact for a student (ADMIN-2.2)."""
    __tablename__ = "parent_contacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)

    parent_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    relationship = Column(String(100), nullable=True)

    can_receive_alerts = Column(Boolean, default=True)
    preferred_contact_method = Column(String(50), default="email")
    preferred_language = Column(String(10), default="en")

    is_primary = Column(Boolean, default=False, index=True)
    email_verified = Column(Boolean, default=False)
    phone_verified = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TeacherActivityLog(Base):
    """Detailed teacher activity events (ADMIN-2.2)."""
    __tablename__ = "teacher_activity_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)

    activity_type = Column(String(100), nullable=False, index=True)
    related_class_id = Column(UUID(as_uuid=True), nullable=True)
    related_student_id = Column(UUID(as_uuid=True), nullable=True)
    related_assignment_id = Column(UUID(as_uuid=True), nullable=True)

    description = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class StudentActivityLog(Base):
    """Detailed student activity events (ADMIN-2.2)."""
    __tablename__ = "student_activity_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)

    activity_type = Column(String(100), nullable=False, index=True)
    related_class_id = Column(UUID(as_uuid=True), nullable=True)
    related_assignment_id = Column(UUID(as_uuid=True), nullable=True)
    related_video_id = Column(UUID(as_uuid=True), nullable=True)

    description = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class ClassReassignmentHistory(Base):
    """Audit trail when a class teacher changes (ADMIN-2.2)."""
    __tablename__ = "class_reassignment_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False, index=True)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)

    from_teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    to_teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reassigned_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    reassigned_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    transferred_assignments = Column(Boolean, default=False)
    transferred_grades = Column(Boolean, default=False)
    transfer_notes = Column(Text, nullable=True)

    affected_students_count = Column(Integer, default=0)
    affected_assignments_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ClassEnrollmentAudit(Base):
    """Audit log of student enrollment changes (ADMIN-2.2)."""
    __tablename__ = "class_enrollment_audit"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)

    action = Column(String(50), nullable=False, index=True)
    from_class_id = Column(UUID(as_uuid=True), nullable=True)
    enrolled_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    action_timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class TeacherInvitationDetails(Base):
    """Email open/click tracking for teacher invitations (ADMIN-2.2)."""
    __tablename__ = "teacher_invitation_details"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invitation_id = Column(UUID(as_uuid=True), ForeignKey("teacher_invitations.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    email_opened = Column(Boolean, default=False)
    email_opened_at = Column(DateTime, nullable=True)
    invitation_clicked = Column(Boolean, default=False)
    invitation_clicked_at = Column(DateTime, nullable=True)

    assigned_grade_levels = Column(JSON, default=list)
    assigned_subject_areas = Column(JSON, default=list)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class StudentEnrollmentInvitation(Base):
    """Individual student enrollment invite tokens (ADMIN-2.2)."""
    __tablename__ = "student_enrollment_invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)

    email = Column(String(255), nullable=False, index=True)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    student_id_number = Column(String(50), nullable=True)
    grade_level = Column(Integer, nullable=True)

    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=True)

    invite_token = Column(String(255), unique=True, nullable=False, index=True)
    invite_url = Column(String(500), nullable=True)
    sent_at = Column(DateTime, nullable=True)
    opened_at = Column(DateTime, nullable=True)
    accepted_at = Column(DateTime, nullable=True)

    status = Column(String(50), default="sent", index=True)
    expires_at = Column(DateTime, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class BulkManagementOperation(Base):
    """Tracks bulk admin actions (ADMIN-2.2)."""
    __tablename__ = "bulk_management_operations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    performed_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    operation_type = Column(String(50), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False)

    total_count = Column(Integer, default=0)
    successful_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)

    error_log = Column(JSON, default=list)

    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ParentCommunicationLog(Base):
    """History of outreach to parents/guardians (ADMIN-2.2)."""
    __tablename__ = "parent_communication_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    parent_contact_id = Column(UUID(as_uuid=True), ForeignKey("parent_contacts.id"), nullable=False, index=True)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)

    communication_type = Column(String(50), nullable=False)
    subject = Column(String(255), nullable=True)
    message = Column(Text, nullable=True)
    sent_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    status = Column(String(50), default="sent")
    read_at = Column(DateTime, nullable=True)
    replied_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class TeacherDeactivationRecord(Base):
    """Preserves deactivation context for potential rehiring (ADMIN-2.2)."""
    __tablename__ = "teacher_deactivation_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)

    deactivated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    deactivated_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reason = Column(String(255), nullable=True)

    classes_archived = Column(JSON, default=list)
    assignments_transferred = Column(JSON, default=list)

    can_reactivate = Column(Boolean, default=True)
    reactivated_at = Column(DateTime, nullable=True)
    reactivated_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class StudentDeactivationRecord(Base):
    """Preserves deactivation context for students (ADMIN-2.2)."""
    __tablename__ = "student_deactivation_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)

    deactivated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    deactivated_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reason = Column(String(255), nullable=True)

    classes_removed_from = Column(JSON, default=list)

    can_reactivate = Column(Boolean, default=True)
    reactivated_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ── School Billing (ADMIN-2.4) ─────────────────────────────────────────────


class SchoolBillingPlan(Base):
    """Available subscription tiers for schools (Starter / Pro / Enterprise)."""
    __tablename__ = "school_billing_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_slug = Column(String(50), unique=True, nullable=False)   # starter | pro | enterprise
    plan_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    monthly_price = Column(Numeric(10, 2), nullable=False)
    annual_price = Column(Numeric(10, 2), nullable=False)
    features = Column(JSON, nullable=False, default=dict)
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SchoolBillingSubscription(Base):
    """Active subscription for a school (one per school)."""
    __tablename__ = "school_billing_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, unique=True, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("school_billing_plans.id"), nullable=False)
    plan_name = Column(String(100), nullable=False)
    monthly_price = Column(Numeric(10, 2), nullable=False)
    billing_cycle = Column(String(20), default="monthly")  # monthly | annual
    status = Column(String(30), default="active")           # active | cancelled | suspended
    auto_renew = Column(Boolean, default=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    renews_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)

    # Denormalised limits for quick access
    max_teachers = Column(Integer, default=50)
    max_students = Column(Integer, default=2000)
    max_classes = Column(Integer, default=100)
    max_storage_gb = Column(Numeric(10, 2), default=100)
    max_api_calls = Column(Integer, default=1_000_000)

    billing_contact_email = Column(String(255), nullable=True)
    billing_contact_name = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SchoolBillingInvoice(Base):
    """Monthly invoice record for a school subscription."""
    __tablename__ = "school_billing_invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("school_billing_subscriptions.id"), nullable=True)
    invoice_number = Column(String(50), unique=True, nullable=False)   # INV-2025-01-001
    invoice_date = Column(Date, nullable=False)
    billing_period_start = Column(Date, nullable=True)
    billing_period_end = Column(Date, nullable=True)
    subtotal = Column(Numeric(10, 2), nullable=False)
    tax = Column(Numeric(10, 2), default=0)
    tax_rate = Column(Numeric(5, 2), default=0)
    total = Column(Numeric(10, 2), nullable=False)
    status = Column(String(30), default="paid")    # paid | pending | failed | refunded
    line_items = Column(JSON, default=list)
    paid_at = Column(DateTime, nullable=True)
    email_sent_to = Column(String(255), nullable=True)
    email_sent_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SchoolBillingSettings(Base):
    """Billing contact and notification preferences for a school."""
    __tablename__ = "school_billing_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, unique=True, index=True)
    billing_contact_name = Column(String(255), nullable=True)
    billing_contact_email = Column(String(255), nullable=True)
    billing_contact_phone = Column(String(30), nullable=True)
    additional_invoice_emails = Column(JSON, default=list)
    send_invoice_emails = Column(Boolean, default=True)
    alert_at_pct_usage = Column(Integer, default=80)
    billing_address = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
