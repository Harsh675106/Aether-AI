from __future__ import annotations

import re
from typing import Any

from app.core.logging import get_logger
from app.videos.schemas import VideoResult
from app.videos.service import SearXNGVideoSearchService
from app.videos.storage import SavedVideoStore

logger = get_logger(__name__)


class VideoCommandRouter:
    """Routes discovery and saved-video commands through the video service."""

    def __init__(
        self,
        search_service: SearXNGVideoSearchService,
        store: SavedVideoStore,
        browser: Any,
    ) -> None:
        self.search_service = search_service
        self.store = store
        self.browser = browser
        self._results: dict[str, list[dict[str, Any]]] = {}
        self._selected: dict[str, dict[str, Any]] = {}
        self._pending_metadata: dict[str, Any] | None = None

    def pop_search_metadata(self) -> dict[str, Any] | None:
        metadata = self._pending_metadata
        self._pending_metadata = None
        return metadata

    def set_context(
        self,
        conversation_id: str | None,
        results: list[dict[str, Any]],
        selected: dict[str, Any] | None,
    ) -> None:
        key = conversation_id or "default"
        validated: list[dict[str, Any]] = []
        for item in results[:50]:
            try:
                validated.append(VideoResult.model_validate(item).model_dump(mode="json"))
            except (TypeError, ValueError):
                continue
        self._results[key] = validated
        self._selected.pop(key, None)
        if selected:
            try:
                selected_video = VideoResult.model_validate(selected).model_dump(mode="json")
            except (TypeError, ValueError):
                return
            self._selected[key] = selected_video

    async def execute(self, text: str, conversation_id: str | None = None) -> str | None:
        normalized = text.strip()
        key = conversation_id or "default"
        lowered = normalized.casefold()

        if re.search(r"\b(?:show|list|open)\s+(?:me\s+)?my\s+saved\s+videos\b", lowered):
            self._pending_metadata = {"view": "saved"}
            return "Here are your saved videos in the Videos section."

        if re.search(r"\b(?:save|bookmark)\s+(?:this|the current|current|that)\s+video\b", lowered):
            video = self._selected.get(key)
            if video is None:
                results = self._results.get(key, [])
                video = results[0] if results else None
            if video is None:
                return "Search for a video or open one before saving it."
            saved = await self.store.save(video)
            return f"Saved “{saved.get('title', 'video')}” to Saved Videos."

        saved_match = re.search(r"\b(?:play|open)\s+my\s+saved\s+(.+)$", normalized, re.I)
        if saved_match:
            matches = await self.store.list(query=saved_match.group(1).strip(" ."))
            return (
                await self._open(matches[0], key)
                if matches
                else "I couldn't find a matching saved video."
            )

        selected_match = re.search(
            r"\b(?:open|play)\s+(?:the\s+)?(first|second|third|fourth|fifth|\d+(?:st|nd|rd|th)?)\s+(?:video|result|one)\b",
            lowered,
        )
        if selected_match:
            index = self._ordinal(selected_match.group(1))
            results = self._results.get(key, [])
            if index < 1 or index > len(results):
                return (
                    "There isn't a video at that result number. "
                    "Search first or choose a visible result."
                )
            return await self._open(results[index - 1], key)

        search_match = re.match(
            r"^(?:please\s+)?(?:search|find|show\s+me|look\s+for)\s+(.+)$",
            normalized,
            re.I,
        )
        search_terms = search_match.group(1).strip(" .") if search_match else ""
        is_video_discovery = bool(
            search_match
            and re.search(r"\b(?:videos?|tutorials?|youtube)\b", search_terms, re.I)
        )
        if is_video_discovery:
            query = re.sub(r"^youtube\s+(?:search\s+for|for)\s+", "", search_terms, flags=re.I)
            query = re.sub(r"^youtube\s+", "", query, flags=re.I)
            query = re.sub(r"^for\s+", "", query, flags=re.I)
            query = re.sub(r"^(?:videos?|video)\s+(?:about|for|on|of)\s+", "", query, flags=re.I)
            query = re.sub(r"\s+on\s+youtube\s*$", "", query, flags=re.I)
            query = re.sub(r"\s+from\s+youtube\s*$", "", query, flags=re.I)
            query = re.sub(r"^(?:the\s+)?(?:best|latest|recent|newest)\s+", "", query, flags=re.I)
            query = re.sub(r"\s+videos?\s*$", "", query, flags=re.I)
            query = re.sub(r"\s+", " ", query).strip(" .")
            if not query:
                return "Tell me what topic you'd like to find videos about."
            engine = "youtube" if re.search(r"\byoutube\b", search_terms, re.I) else None
            try:
                response = await self.search_service.search(
                    query,
                    limit=24,
                    engine=engine,
                )
            except (RuntimeError, ValueError) as exc:
                logger.warning("video_command_search_failed", error=str(exc))
                return "I couldn't reach the video search service. Please try again."
            results = [item.model_dump(mode="json") for item in response.results]
            self._results[key] = results
            self._selected.pop(key, None)
            self._pending_metadata = {
                "view": "results",
                **response.model_dump(mode="json"),
            }
            if not results:
                return f"I couldn't find video results for {query!r}."
            return (
                f"I found {len(results)} video results for {query!r}. "
                "Open one from the Videos section."
            )
        return None

    async def _open(self, video: dict[str, Any], key: str) -> str:
        url = str(video.get("video_url") or "")
        if not url.startswith(("https://", "http://")):
            return "That video does not have a safe web URL to open."
        await self.browser.navigate(url)
        self._selected[key] = video
        self._pending_metadata = {"view": "opened", "video_id": video.get("id")}
        return f"Opening “{video.get('title') or 'video'}” in Aether's floating browser."

    @staticmethod
    def _ordinal(value: str) -> int:
        ordinals = {"first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5}
        if value in ordinals:
            return ordinals[value]
        match = re.match(r"\d+", value)
        return int(match.group()) if match else 1
