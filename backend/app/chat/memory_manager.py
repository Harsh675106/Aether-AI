from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from app.core.interfaces import MemoryManager


@dataclass(frozen=True)
class MemoryRetrievalResult:
    context: str
    used: bool
    skipped_reason: str | None
    result_count: int = 0


class RelevantMemoryManager:
    """Retrieve semantic memories only after the router asks for them."""

    def __init__(self, memory_manager: MemoryManager) -> None:
        self._memory_manager = memory_manager

    async def retrieve(self, query: str, *, enabled: bool, limit: int = 3) -> MemoryRetrievalResult:
        if not enabled:
            return MemoryRetrievalResult(context="", used=False, skipped_reason="intent did not require memory")

        memories = await self._memory_manager.search_semantic(query, limit=limit)
        relevant = self._filter_relevant(query, memories)
        if not relevant:
            return MemoryRetrievalResult(context="", used=False, skipped_reason="no relevant memory found")

        lines = [str(item.get("content", "")).strip() for item in relevant if str(item.get("content", "")).strip()]
        return MemoryRetrievalResult(
            context="\n".join(lines),
            used=bool(lines),
            skipped_reason=None if lines else "retrieved memory had no content",
            result_count=len(lines),
        )

    def _filter_relevant(self, query: str, memories: Sequence[Mapping[str, Any]]) -> list[Mapping[str, Any]]:
        if not memories:
            return []

        query_tokens = self._tokens(query)
        if not query_tokens:
            return []

        relevant: list[Mapping[str, Any]] = []
        for memory in memories:
            content = str(memory.get("content", ""))
            score = memory.get("score") or memory.get("distance")
            if isinstance(score, (int, float)):
                if "distance" in memory and float(score) > 1.2:
                    continue
                if "score" in memory and float(score) < 0.2:
                    continue

            memory_tokens = self._tokens(content)
            if query_tokens & memory_tokens or self._is_personal_recall(query):
                relevant.append(memory)

        return relevant[:3]

    def _is_personal_recall(self, query: str) -> bool:
        lowered = query.lower()
        return any(term in lowered for term in ("my name", "what did i tell", "remember", "previous", "earlier", "continue", "do i like", "language"))

    def _tokens(self, text: str) -> set[str]:
        import re

        stopwords = {
            "what",
            "is",
            "are",
            "the",
            "a",
            "an",
            "my",
            "me",
            "you",
            "your",
            "did",
            "do",
            "to",
            "of",
            "in",
            "and",
            "or",
        }
        return {token for token in re.findall(r"[a-z0-9]+", text.lower()) if token not in stopwords}

