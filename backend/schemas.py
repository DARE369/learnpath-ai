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
