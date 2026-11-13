from __future__ import annotations

from typing import Any

import pytest
from app.memory.chroma_manager import ChromaMemoryManager


class MemoryCollection:
    def __init__(self) -> None:
        self.records: dict[str, dict[str, Any]] = {}

    def upsert(
        self,
        *,
        ids: list[str],
        documents: list[str],
        metadatas: list[dict[str, Any]],
    ) -> None:
        for memory_id, document, metadata in zip(ids, documents, metadatas, strict=False):
            self.records[memory_id] = {"document": document, "metadata": metadata}

    def get(self, *, include: list[str]) -> dict[str, list[Any]]:
        _ = include
        records = list(self.records.items())
        return {
            "ids": [memory_id for memory_id, _record in records],
            "documents": [record["document"] for _memory_id, record in records],
            "metadatas": [record["metadata"] for _memory_id, record in records],
        }

    def query(
        self,
        *,
        query_texts: list[str],
        n_results: int,
        include: list[str],
    ) -> dict[str, list[list[Any]]]:
        _ = query_texts, include
        records = list(self.records.items())[:n_results]
        return {
            "ids": [[memory_id for memory_id, _record in records]],
            "documents": [[record["document"] for _memory_id, record in records]],
            "metadatas": [[record["metadata"] for _memory_id, record in records]],
            "distances": [[0.1 for _ in records]],
        }


def build_manager() -> tuple[ChromaMemoryManager, MemoryCollection]:
    manager = object.__new__(ChromaMemoryManager)
    collection = MemoryCollection()
    manager.collection = collection
    return manager, collection


@pytest.mark.asyncio
async def test_memories_can_be_listed_and_semantically_searched() -> None:
    manager, collection = build_manager()
    await manager.record_event(
        {
            "content": "The user prefers concise explanations.",
            "source": "conversation",
            "conversation_id": "conversation-1",
        }
    )

    memories = await manager.list_memories()
    results = await manager.search_semantic("concise explanations", limit=1)

    assert len(memories) == 1
    assert memories[0]["content"] == "The user prefers concise explanations."
    assert memories[0]["conversation_id"] == "conversation-1"
    assert memories[0]["created_at"]
    assert results[0]["id"] == memories[0]["id"]
    assert results[0]["distance"] == 0.1
    assert collection.records


@pytest.mark.asyncio
async def test_memory_list_orders_newest_first_and_applies_limit() -> None:
    manager, collection = build_manager()
    collection.records = {
        "old": {
            "document": "Older memory",
            "metadata": {"source": "conversation", "created_at": "2025-01-01"},
        },
        "new": {
            "document": "Newer memory",
            "metadata": {"source": "conversation", "created_at": "2026-01-01"},
        },
    }

    memories = await manager.list_memories(limit=1)

    assert len(memories) == 1
    assert memories[0]["id"] == "new"
