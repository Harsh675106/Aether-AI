from __future__ import annotations

import hashlib
from collections.abc import Mapping
from typing import Any

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.core.interfaces import MemoryManager
from app.core.settings import Settings


class ChromaMemoryManager(MemoryManager):
    """Persist semantic memories in a local ChromaDB collection."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or Settings()
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
        self.collection.upsert(
            ids=[document_id],
            documents=[content],
            metadatas=[{"source": str(event.get("source", "conversation")), **dict(event)}],
        )

    async def search_semantic(self, query: str, *, limit: int = 3) -> list[dict[str, Any]]:
        if not query.strip():
            return []

        results = self.collection.query(query_texts=[query], n_results=limit, include=["documents", "metadatas", "distances"])
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]
        return [
            {"content": document, "metadata": metadata, "distance": distance}
            for document, metadata, distance in zip(documents, metadatas, distances, strict=False)
        ]


