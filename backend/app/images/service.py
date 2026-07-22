from __future__ import annotations

import asyncio
import re
import uuid
from dataclasses import dataclass
from typing import Any, Protocol
from urllib.parse import urlparse

import httpx

from app.core.logging import get_logger
from app.images.history_store import ImageHistoryStore
from app.images.schemas import ImageSearchResponse, ImageSearchResultModel, NormalizedImageResult
from app.monitoring.service import MonitoringService

logger = get_logger(__name__)


class ImageSearchProvider(Protocol):
    async def search(self, query: str, *, limit: int = 12) -> list[dict[str, Any]]:
        ...


class SearXNGImageSearchProvider:
    """Fetch image search results from SearXNG."""

    def __init__(self, base_url: str = "http://localhost:8080") -> None:
        self.base_url = base_url.rstrip("/")

    async def search(self, query: str, *, limit: int = 12) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=20, headers={"User-Agent": "AetherAI/1.0"}) as client:
            response = await client.get(
                f"{self.base_url}/search",
                params={
                    "q": query,
                    "format": "json",
                    "categories": "images",
                    "language": "en",
                    "safesearch": 1,
                },
            )
            response.raise_for_status()
            payload = response.json()

        results: list[dict[str, Any]] = []
        for item in payload.get("results", [])[: limit * 2]:
            image_url = self._first_non_empty(
                item.get("img_src"),
                item.get("img"),
                item.get("image"),
                item.get("url"),
            )
            preview_url = self._first_non_empty(
                item.get("thumbnail_src"),
                item.get("thumbnail"),
                item.get("preview_url"),
                image_url,
            )
            source_url = self._first_non_empty(item.get("url"), item.get("source_url"), image_url)
            if not image_url or not source_url:
                continue
            results.append(
                {
                    "title": item.get("title") or item.get("alt") or "",
                    "preview_url": preview_url,
                    "image_url": image_url,
                    "source_url": source_url,
                    "source_site": item.get("engine") or item.get("source") or self._site_name(source_url),
                    "width": item.get("img_width") or item.get("width"),
                    "height": item.get("img_height") or item.get("height"),
                    "mime_type": item.get("content-type") or item.get("mime_type"),
                    "score": float(item.get("score") or 0.0),
                    "provider": "searxng",
                    "thumbnail_url": item.get("thumbnail_src") or item.get("thumbnail"),
                    "details": {
                        "engine": item.get("engine"),
                        "domain": item.get("parsed_url") or item.get("source"),
                    },
                }
            )
        return results

    def _first_non_empty(self, *values: Any) -> str:
        for value in values:
            text = str(value or "").strip()
            if text:
                return text
        return ""

    def _site_name(self, url: str) -> str:
        parsed = urlparse(url)
        return parsed.netloc.replace("www.", "") or "web"


@dataclass
class ImageSearchService:
    provider: ImageSearchProvider
    monitoring_service: MonitoringService | None = None
    history_store: ImageHistoryStore | None = None
    trusted_domains: tuple[str, ...] = (
        "wikimedia.org",
        "wikipedia.org",
        "commons.wikimedia.org",
        "openai.com",
        "apple.com",
        "microsoft.com",
        "nvidia.com",
        "intel.com",
        "amd.com",
        "bcci.tv",
        "viratkohli.foundation",
        "google.com",
        "unsplash.com",
        "pexels.com",
    )

    async def search(
        self,
        query: str,
        *,
        limit: int = 12,
        conversation_id: str | None = None,
        request_source: str | None = None,
    ) -> ImageSearchResponse:
        request_id = str(uuid.uuid4())
        normalized_query = self._normalize(query)
        await self._publish_event(
            "image.request",
            "Image request detected",
            f"Searching images for: {query}",
            conversation_id=conversation_id,
            request_source=request_source,
            details={"query": query, "request_source": request_source, "request_id": request_id},
        )

        raw_results = await self._safe_search(normalized_query or query, limit=limit)
        await self._publish_event(
            "image.searching",
            "Searching image sources",
            "Fetching and ranking image results from SearXNG.",
            conversation_id=conversation_id,
            request_source=request_source,
            details={"result_count": len(raw_results), "request_id": request_id},
        )

        normalized_results = self._normalize_results(raw_results)
        await self._publish_event(
            "image.filtering",
            "Filtering duplicate and broken images",
            "Removing duplicate, low-quality, and broken image results.",
            conversation_id=conversation_id,
            request_source=request_source,
            details={"raw_count": len(normalized_results), "request_id": request_id},
        )
        deduplicated = self._deduplicate(normalized_results)
        validated = await self._filter_broken_images(deduplicated)
        ranked = self._rank_results(validated, query)[:limit]

        response = ImageSearchResponse(
            request_id=request_id,
            query=query,
            request_source=request_source,
            provider="searxng",
            results=[ImageSearchResultModel(**item.to_dict()) for item in ranked],
        )

        await self._publish_event(
            "image.results_loaded",
            "Images loaded",
            f"Loaded {len(ranked)} image results.",
            severity="success",
            status="complete",
            conversation_id=conversation_id,
            request_source=request_source,
            details={
                "query": query,
                "request_source": request_source,
                "request_id": request_id,
                "result_count": len(ranked),
                "duplicate_count": max(0, len(normalized_results) - len(deduplicated)),
            },
        )

        await self._save_history(
            response,
            conversation_id=conversation_id,
            created_at=None,
        )
        return response

    async def list_history(self, *, limit: int = 12) -> list[dict[str, Any]]:
        if self.history_store is None:
            return []
        return await self.history_store.list_recent(limit=limit)

    async def get_history(self, request_id: str) -> dict[str, Any] | None:
        if self.history_store is None:
            return None
        return await self.history_store.get(request_id)

    async def _save_history(self, response: ImageSearchResponse, *, conversation_id: str | None, created_at: str | None) -> None:
        if self.history_store is None:
            return
        payload = response.model_dump(mode="json")
        payload["conversation_id"] = conversation_id
        if created_at:
            payload["created_at"] = created_at
        try:
            await self.history_store.record(payload)
        except Exception as exc:  # pragma: no cover - defensive guard
            logger.warning("image_history_persist_failed", exc_info=exc)

    async def _safe_search(self, query: str, *, limit: int) -> list[dict[str, Any]]:
        try:
            return await self.provider.search(query, limit=limit)
        except Exception as exc:  # pragma: no cover - defensive guard
            logger.warning("image_search_failed", exc_info=exc)
            await self._publish_event(
                "image.error",
                "Image search failed",
                str(exc) or "Image search failed unexpectedly.",
                severity="error",
                status="error",
                details={"query": query},
            )
            return []

    def _normalize_results(self, results: list[dict[str, Any]]) -> list[NormalizedImageResult]:
        normalized: list[NormalizedImageResult] = []
        for item in results:
            image_url = self._clean_url(item.get("image_url") or item.get("url") or "")
            preview_url = self._clean_url(item.get("preview_url") or item.get("thumbnail_url") or image_url)
            source_url = self._clean_url(item.get("source_url") or item.get("url") or image_url)
            if not image_url or not source_url:
                continue

            normalized.append(
                NormalizedImageResult(
                    title=self._clean_text(str(item.get("title") or self._site_name(source_url) or "Image")),
                    preview_url=preview_url or image_url,
                    image_url=image_url,
                    source_url=source_url,
                    source_site=self._clean_text(str(item.get("source_site") or self._site_name(source_url))),
                    width=self._coerce_int(item.get("width")),
                    height=self._coerce_int(item.get("height")),
                    mime_type=self._clean_text(str(item.get("mime_type") or "")) or None,
                    score=float(item.get("score") or 0.0),
                    provider=str(item.get("provider") or "searxng"),
                    thumbnail_url=self._clean_url(item.get("thumbnail_url") or item.get("preview_url") or preview_url),
                    details=item.get("details") if isinstance(item.get("details"), dict) else None,
                )
            )
        return normalized

    def _deduplicate(self, results: list[NormalizedImageResult]) -> list[NormalizedImageResult]:
        seen: set[str] = set()
        deduplicated: list[NormalizedImageResult] = []
        for item in results:
            key = self._normalize_url(item.image_url) or self._normalize_url(item.source_url)
            if not key or key in seen:
                continue
            seen.add(key)
            deduplicated.append(item)
        return deduplicated

    async def _filter_broken_images(self, results: list[NormalizedImageResult]) -> list[NormalizedImageResult]:
        if not results:
            return []

        semaphore = asyncio.Semaphore(6)

        async def _check(item: NormalizedImageResult) -> NormalizedImageResult | None:
            async with semaphore:
                if await self._looks_reachable(item.preview_url) or await self._looks_reachable(item.image_url):
                    return item
                return None

        checked = await asyncio.gather(*(_check(item) for item in results[:24]))
        return [item for item in checked if item is not None]

    async def _looks_reachable(self, url: str) -> bool:
        if not url:
            return False
        headers = {"User-Agent": "AetherAI/1.0", "Accept": "image/*,*/*;q=0.8"}
        timeout = httpx.Timeout(8.0, connect=4.0)
        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, headers=headers) as client:
                response = await client.head(url)
                if response.status_code >= 400:
                    response = await client.get(url, headers={"Range": "bytes=0-1024"})
                if response.status_code >= 400:
                    return False
                content_type = response.headers.get("content-type", "").lower()
                return content_type.startswith("image/") or bool(re.search(r"\.(png|jpe?g|gif|webp|bmp|avif|svg)(?:\?|$)", url.lower()))
        except Exception:
            return False

    def _rank_results(self, results: list[NormalizedImageResult], query: str) -> list[NormalizedImageResult]:
        normalized_query = self._tokenize(query)
        ranked: list[tuple[float, NormalizedImageResult]] = []
        for item in results:
            combined = f"{item.title} {item.source_site} {item.source_url}".lower()
            relevance = sum(1 for token in normalized_query if token and token in combined)
            trust = self._trusted_score(item.source_url, item.source_site)
            quality = 0.0
            if item.width and item.height:
                quality += min(item.width, item.height) / 1000.0
            if item.score:
                quality += min(item.score, 10.0)
            if "logo" in query.lower() and any(token in combined for token in ("logo", "brand", "official")):
                quality += 2.0
            if "eiffel" in query.lower() or "landmark" in query.lower():
                quality += 0.5
            ranked.append((relevance * 2.0 + trust + quality, item))
        ranked.sort(key=lambda pair: pair[0], reverse=True)
        return [item for _, item in ranked]

    def _trusted_score(self, source_url: str, source_site: str) -> float:
        lowered = f"{source_url} {source_site}".lower()
        if any(domain in lowered for domain in self.trusted_domains):
            return 3.0
        if lowered.endswith(".gov") or lowered.endswith(".edu"):
            return 2.5
        if "official" in lowered:
            return 1.5
        return 0.5

    def _coerce_int(self, value: Any) -> int | None:
        try:
            if value is None or value == "":
                return None
            return int(value)
        except (TypeError, ValueError):
            return None

    def _clean_text(self, text: str) -> str:
        return re.sub(r"\s+", " ", text).strip()

    def _clean_url(self, value: Any) -> str:
        return str(value or "").strip()

    def _normalize_url(self, url: str) -> str:
        parsed = urlparse(url)
        path = parsed.path.rstrip("/") or "/"
        return f"{parsed.netloc.lower()}{path}".strip().lower()

    def _site_name(self, url: str) -> str:
        parsed = urlparse(url)
        return parsed.netloc.replace("www.", "") or "web"

    def _tokenize(self, text: str) -> set[str]:
        return {token for token in re.findall(r"[a-z0-9]+", text.lower()) if token}

    def _normalize(self, text: str) -> str:
        return re.sub(r"\s+", " ", text.lower()).strip()

    async def _publish_event(
        self,
        event_type: str,
        title: str,
        description: str,
        *,
        severity: str = "info",
        status: str = "running",
        conversation_id: str | None = None,
        request_source: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        if self.monitoring_service is None:
            return
        payload = {
            "request_source": request_source,
            **(details or {}),
        }
        await self.monitoring_service.publish_event(
            event_type=event_type,
            subsystem="images",
            severity=severity,
            category="image",
            title=title,
            description=description,
            status=status,
            correlation_id=conversation_id,
            details=payload,
        )
