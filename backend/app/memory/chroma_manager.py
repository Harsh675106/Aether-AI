from __future__ import annotations

import asyncio
import hashlib
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.core.interfaces import MemoryManager
from app.core.settings import Settings


class ChromaMemoryManager(MemoryManager):
    """Persist semantic memories in a local ChromaDB collection."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or Settings()
        mode = getattr(self.settings, "chroma_mode", "local")
        if mode == "http":
            self.client = chromadb.HttpClient(
                host=getattr(self.settings, "chroma_host", "localhost"),
                port=getattr(self.settings, "chroma_port", 8001),
                settings=ChromaSettings(allow_reset=True),
            )
        else:
            self.client = chromadb.PersistentClient(
                path=getattr(self.settings, "chroma_persist_directory", "./data/chroma"),
                settings=ChromaSettings(allow_reset=True),
            )
        self.collection = self.client.get_or_create_collection(
            name=getattr(self.settings, "chroma_collection_name", "aether_memories")
        )

    async def record_event(self, event: Mapping[str, Any]) -> None:
        content = str(event.get("content", ""))
        if not content:
            return

        document_id = hashlib.sha256(
            f"{event.get('conversation_id', 'global')}:{content}".encode("utf-8")
        ).hexdigest()
        metadata = {
            "source": str(event.get("source", "conversation")),
            **dict(event),
            "created_at": str(event.get("created_at") or datetime.now(UTC).isoformat()),
        }
        await asyncio.to_thread(
            self.collection.upsert,
            ids=[document_id],
            documents=[content],
            metadatas=[metadata],
        )

    async def search_semantic(self, query: str, *, limit: int = 3) -> list[dict[str, Any]]:
        if not query.strip():
            return []

        results = await asyncio.to_thread(
            self.collection.query,
            query_texts=[query],
            n_results=limit,
            include=["documents", "metadatas", "distances"],
        )
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]
        ids = results.get("ids", [[]])[0]
        return [
            {"id": memory_id, "content": document, "metadata": metadata, "distance": distance}
            for memory_id, document, metadata, distance in zip(
                ids,
                documents,
                metadatas,
                distances,
                strict=False,
            )
        ]

    async def list_memories(self, *, limit: int = 100) -> list[dict[str, Any]]:
        results = await asyncio.to_thread(
            self.collection.get,
            include=["documents", "metadatas"],
        )
        ids = results.get("ids", [])
        documents = results.get("documents", [])
        metadatas = results.get("metadatas", [])
        memories = [
            {
                "id": memory_id,
                "content": document,
                "source": str((metadata or {}).get("source", "conversation")),
                "conversation_id": (metadata or {}).get("conversation_id"),
                "created_at": (metadata or {}).get("created_at"),
            }
            for memory_id, document, metadata in zip(
                ids,
                documents,
                metadatas,
                strict=False,
            )
            if document
        ]
        memories.sort(key=lambda memory: str(memory.get("created_at") or ""), reverse=True)
        return memories[:limit]
