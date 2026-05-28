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


class UserResponse(UserBase):
    id: UUID
    tier: str
    email_verified: bool
    created_at: datetime
    updated_at: datetime

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
