from __future__ import annotations

from typing import Any
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _validate_http_url(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Only HTTP(S) URLs are supported")
    if parsed.username or parsed.password:
        raise ValueError("URLs containing credentials are not supported")
    _ = parsed.port
    return value


def _validate_required_http_url(value: str) -> str:
    validated = _validate_http_url(value)
    if validated is None:
        raise ValueError("A video URL is required")
    return validated


class VideoSearchRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    query: str = Field(min_length=1, max_length=500)
    limit: int = Field(default=24, ge=1, le=50)
    page: int = Field(default=1, ge=1, le=20)

    @field_validator("query")
    @classmethod
    def query_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Search query must not be blank")
        return value.strip()


class VideoResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1, max_length=128)
    title: str = Field(min_length=1, max_length=1000)
    thumbnail_url: str | None = Field(default=None, max_length=4096)
    video_url: str = Field(min_length=1, max_length=4096)
    platform: str = Field(min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=5000)
    duration: str | None = Field(default=None, max_length=64)
    duration_seconds: int | None = Field(default=None, ge=0)
    published_at: str | None = Field(default=None, max_length=128)
    creator: str | None = Field(default=None, max_length=300)
    score: float = 0.0
    metadata: dict[str, Any] = Field(default_factory=dict)

    _validate_video_url = field_validator("video_url")(_validate_required_http_url)
    _validate_thumbnail_url = field_validator("thumbnail_url")(_validate_http_url)


class VideoSearchResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    query: str
    page: int
    has_more: bool = False
    provider: str = "searxng"
    results: list[VideoResult] = Field(default_factory=list)


class SaveVideoRequest(VideoResult):
    pass


class SavedVideo(VideoResult):
    saved_at: str


class SavedVideosResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    videos: list[SavedVideo] = Field(default_factory=list)
