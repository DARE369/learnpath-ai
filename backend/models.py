from sqlalchemy import (
    Column, String, Integer, Float, Boolean,
    DateTime, Text, ForeignKey, JSON,
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
