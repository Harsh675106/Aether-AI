from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ImageSearchRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    query: str = Field(min_length=1, max_length=500)
    limit: int = Field(default=12, ge=1, le=24)
    request_source: str | None = Field(default=None, max_length=32)
    conversation_id: str | None = Field(default=None, max_length=128)


class ImageSearchResultModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    preview_url: str
    image_url: str
    source_url: str
    source_site: str
    width: int | None = None
    height: int | None = None
    mime_type: str | None = None
    score: float = 0.0
    provider: str = "searxng"
    thumbnail_url: str | None = None
    details: dict[str, Any] | None = None


class ImageSearchResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    request_id: str | None = None
    query: str
    request_source: str | None = None
    provider: str = "searxng"
    results: list[ImageSearchResultModel] = Field(default_factory=list)


class ImageSearchHistoryEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    request_id: str
    query: str
    request_source: str | None = None
    provider: str = "searxng"
    created_at: str
    conversation_id: str | None = None
    result_count: int = 0
    results: list[ImageSearchResultModel] = Field(default_factory=list)


class ImageSearchHistoryResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    entries: list[ImageSearchHistoryEntry] = Field(default_factory=list)


@dataclass(frozen=True)
class NormalizedImageResult:
    title: str
    preview_url: str
    image_url: str
    source_url: str
    source_site: str
    width: int | None = None
    height: int | None = None
    mime_type: str | None = None
    score: float = 0.0
    provider: str = "searxng"
    thumbnail_url: str | None = None
    details: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "preview_url": self.preview_url,
            "image_url": self.image_url,
            "source_url": self.source_url,
            "source_site": self.source_site,
            "width": self.width,
            "height": self.height,
            "mime_type": self.mime_type,
            "score": self.score,
            "provider": self.provider,
            "thumbnail_url": self.thumbnail_url,
            "details": self.details or {},
        }
