from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class UserBase(BaseModel):
    email: str
    full_name: Optional[str] = None
    country: Optional[str] = None
    age: Optional[int] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserLogin(BaseModel):
    email: str
    password: str


class GoogleSignIn(BaseModel):
    access_token: str = Field(..., min_length=10)


class UserResponse(UserBase):
    id: UUID
    tier: str
    role: str = "user"
    email_verified: bool
    created_at: datetime
    updated_at: datetime
    onboarding_completed: Optional[bool] = False

    model_config = {"from_attributes": True}


class TopicCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    difficulty: Optional[str] = None


class TopicResponse(TopicCreate):
    id: UUID
    keywords: List[str] = []
    video_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class VideoCreate(BaseModel):
    youtube_id: str
    title: str
    channel_id: Optional[str] = None
    duration_seconds: Optional[int] = None


class VideoResponse(VideoCreate):
    id: UUID
    transcript_cached: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class HealthCheck(BaseModel):
    status: str
    timestamp: str
    app: str
    version: str
    environment: str


# YouTube search results (raw API data — not database-backed)
class VideoSearchResult(BaseModel):
    youtube_id: str
    title: str
    description: Optional[str] = None
    channel_id: Optional[str] = None
    channel_name: Optional[str] = None
    published_at: Optional[str] = None
    thumbnail_url: Optional[str] = None


# EQS (Educational Quality Score)
class VideoScoreRequest(BaseModel):
    youtube_id: str
    title: str
    transcript: Optional[str] = None
    description: Optional[str] = None


# Summary generation
class SummarySection(BaseModel):
    title: str
    timestamp_start: Optional[int] = None
    content: str


class SummaryRequest(BaseModel):
    youtube_id: str
    transcript: str = Field(..., min_length=10)
    title: Optional[str] = None
    max_length: Optional[int] = Field(default=500, ge=100, le=2000)


class SummaryResponse(BaseModel):
    youtube_id: str
    summary: str
    key_concepts: List[str]
    sections: List[SummarySection]
    word_count: int


# ─── Learning Sessions (Packet 2.2) ───────────────────────────────────────────

class SessionStartRequest(BaseModel):
    topic_id: UUID
    video_index: int = Field(..., ge=0)
    youtube_id: str
    path_id: Optional[str] = None
    video_id: Optional[UUID] = None


class WatchProgressUpdate(BaseModel):
    watch_percentage: int = Field(..., ge=0, le=100)
    last_position_seconds: int = Field(..., ge=0)
    total_watch_time_seconds: int = Field(..., ge=0)
    playback_speed: float = Field(default=1.0, ge=0.25, le=3.0)


class AnswerSubmission(BaseModel):
    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)


class SessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    topic_id: UUID
    youtube_id: Optional[str] = None
    video_index: Optional[int] = None
    session_number: Optional[int] = None
    video_watched: bool
    watch_percentage: int
    last_position_seconds: int
    total_watch_time_seconds: int
    playback_speed: float
    questions_answered: int
    questions_correct: int
    started_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PathProgressResponse(BaseModel):
    topic_id: str
    path_id: Optional[str] = None
    total_sessions: int
    completed_sessions: int
    completion_percentage: float
    total_watch_time_seconds: int
    concepts_mastered: int


class ConceptProgressResponse(BaseModel):
    id: UUID
    concept_name: str
    mastery_score: float
    encounters: int
    status: str
    last_seen_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
