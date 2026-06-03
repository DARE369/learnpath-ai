from sqlalchemy import (
    Column, String, Integer, Float, Boolean,
    DateTime, Date, Text, ForeignKey, JSON,
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
    role = Column(String, default="user", nullable=False, index=True)  # user | admin
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
