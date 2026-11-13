from __future__ import annotations

import asyncio
import math
import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit

import httpx

from app.core.logging import get_logger
from app.videos.schemas import VideoResult, VideoSearchResponse
from app.videos.storage import video_id_for_url

logger = get_logger(__name__)


@dataclass
class SearXNGVideoSearchService:
    base_url: str
    timeout: float = 12.0

    async def search(
        self,
        query: str,
        *,
        limit: int = 24,
        page: int = 1,
        engine: str | None = None,
    ) -> VideoSearchResponse:
        normalized_query = re.sub(r"\s+", " ", query).strip()
        if not normalized_query:
            raise ValueError("Search query must not be blank")
        params = {
            "q": normalized_query,
            "format": "json",
            "categories": "videos",
            "language": "en",
            "safesearch": 1,
            "pageno": page,
        }
        if engine:
            params["engines"] = engine
        headers = {"Accept": "application/json", "User-Agent": "AetherAI/1.0"}
        last_error: Exception | None = None
        for attempt in range(2):
            try:
                timeout = httpx.Timeout(self.timeout, connect=5.0)
                async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                    response = await client.get(
                        f"{self.base_url.rstrip('/')}/search",
                        params=params,
                        headers=headers,
                    )
                    response.raise_for_status()
                    body = response.json()
                if not isinstance(body, dict) or not isinstance(body.get("results"), list):
                    raise ValueError("SearXNG returned an invalid video-search response")
                raw_results = body["results"]
                results = self._normalize(raw_results, limit)
                return VideoSearchResponse(
                    query=normalized_query,
                    page=page,
                    has_more=bool(raw_results),
                    results=results,
                )
            except (httpx.HTTPError, ValueError) as exc:
                last_error = exc
                if attempt == 0:
                    await asyncio.sleep(0.2)
        logger.warning("video_search_failed", error=str(last_error), query=normalized_query)
        raise RuntimeError("SearXNG video search is unavailable") from last_error

    def _normalize(self, items: list[Any], limit: int) -> list[VideoResult]:
        output: list[VideoResult] = []
        seen: set[str] = set()
        for item in items:
            if not isinstance(item, dict):
                continue
            video_url = str(item.get("url") or "").strip()
            try:
                parsed_url = urlsplit(video_url)
                _ = parsed_url.port
                thumbnail = self._first(
                    item.get("thumbnail"),
                    item.get("thumbnail_src"),
                    item.get("img_src"),
                )
                parsed_thumbnail = urlsplit(thumbnail) if thumbnail else None
                if parsed_thumbnail:
                    _ = parsed_thumbnail.port
            except ValueError:
                continue
            if (
                len(video_url) > 4096
                or parsed_url.scheme not in {"http", "https"}
                or not parsed_url.hostname
                or parsed_url.username
                or parsed_url.password
            ):
                continue
            video_id = video_id_for_url(video_url)
            if video_id in seen:
                continue
            seen.add(video_id)
            if thumbnail and (
                len(thumbnail) > 4096
                or parsed_thumbnail is None
                or parsed_thumbnail.scheme not in {"http", "https"}
                or not parsed_thumbnail.hostname
                or parsed_thumbnail.username
                or parsed_thumbnail.password
            ):
                thumbnail = None
            duration_seconds, duration = self._duration(item.get("length") or item.get("duration"))
            platform = self._first(
                item.get("engine"),
                item.get("source"),
                parsed_url.hostname or "web",
            )[:128]
            metadata: dict[str, Any] = {}
            for key, value in list(item.items())[:30]:
                if key in {
                    "url",
                    "title",
                    "thumbnail",
                    "thumbnail_src",
                    "img_src",
                    "content",
                    "description",
                }:
                    continue
                if isinstance(value, (str, int, float, bool, type(None))):
                    metadata[str(key)[:100]] = value[:500] if isinstance(value, str) else value
            output.append(
                VideoResult(
                    id=video_id,
                    title=self._first(item.get("title"), video_url)[:1000],
                    thumbnail_url=thumbnail,
                    video_url=video_url,
                    platform=platform,
                    description=(
                        self._optional(item.get("content") or item.get("description")) or ""
                    )[:5000]
                    or None,
                    duration=duration[:64] if duration else None,
                    duration_seconds=duration_seconds,
                    published_at=(
                        self._optional(item.get("publishedDate") or item.get("published_at")) or ""
                    )[:128]
                    or None,
                    creator=(self._optional(item.get("author") or item.get("creator")) or "")[
                        :300
                    ]
                    or None,
                    score=self._score(item.get("score")),
                    metadata=metadata,
                )
            )
            if len(output) >= limit:
                break
        return output

    @staticmethod
    def _first(*values: Any) -> str:
        return next(
            (
                str(value).strip()
                for value in values
                if value is not None and str(value).strip()
            ),
            "",
        )

    @staticmethod
    def _optional(value: Any) -> str | None:
        return str(value).strip() or None if value is not None else None

    @staticmethod
    def _score(value: Any) -> float:
        try:
            score = float(value or 0)
            return score if math.isfinite(score) else 0.0
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _duration(value: Any) -> tuple[int | None, str | None]:
        if value is None:
            return None, None
        if isinstance(value, (int, float)):
            seconds = int(value)
        else:
            text = str(value).strip()
            try:
                if text.isdigit():
                    seconds = int(text)
                else:
                    parts = [int(part) for part in text.split(":")]
                    seconds = 0
                    for part in parts:
                        seconds = seconds * 60 + part
            except ValueError:
                return None, text or None
        if seconds < 0:
            return None, None
        hours, remainder = divmod(seconds, 3600)
        minutes, seconds_left = divmod(remainder, 60)
        label = (
            f"{hours}:{minutes:02d}:{seconds_left:02d}"
            if hours
            else f"{minutes}:{seconds_left:02d}"
        )
        return seconds, label
