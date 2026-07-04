from collections.abc import Mapping, Sequence
from typing import Any

from app.core.interfaces import MemoryManager


class PlaceholderMemoryManager(MemoryManager):
    async def record_event(self, event: Mapping[str, Any]) -> None:
        _ = event

    async def search_semantic(self, query: str, *, limit: int = 3) -> Sequence[Mapping[str, Any]]:
        _ = query, limit
        return []

