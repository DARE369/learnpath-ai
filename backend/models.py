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
    password_hash = Column(String, nullable=False)
    full_name = Column(String)
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
