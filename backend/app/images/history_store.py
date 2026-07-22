from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import Mapping
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.core.settings import Settings


class ImageHistoryStore:
    """Persist image search requests and results in ChromaDB."""

    collection_name = "aether_image_history"

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or Settings()
        Path(self.settings.chroma_persist_directory).mkdir(parents=True, exist_ok=True)
        self.client = chromadb.PersistentClient(
            path=self.settings.chroma_persist_directory,
            settings=ChromaSettings(allow_reset=True),
        )
        self.collection = self.client.get_or_create_collection(name=self.collection_name)

    async def record(self, payload: Mapping[str, Any]) -> str:
        request_id = str(payload.get("request_id") or uuid.uuid4())
        created_at = str(payload.get("created_at") or datetime.now(timezone.utc).isoformat())
        record = {**dict(payload), "request_id": request_id, "created_at": created_at}
        document = json.dumps(record, ensure_ascii=False, sort_keys=True, default=str)
        metadata = {
            "kind": "image_request",
            "request_id": request_id,
            "query": str(payload.get("query", "")),
            "request_source": str(payload.get("request_source") or ""),
            "conversation_id": str(payload.get("conversation_id") or ""),
            "provider": str(payload.get("provider") or "searxng"),
            "result_count": int(payload.get("result_count") or 0),
            "created_at": created_at,
        }

        await asyncio.to_thread(
            self.collection.upsert,
            ids=[request_id],
            documents=[document],
            metadatas=[metadata],
        )
        return request_id

    async def get(self, request_id: str) -> dict[str, Any] | None:
        data = await asyncio.to_thread(
            self.collection.get,
            ids=[request_id],
            include=["documents", "metadatas"],
        )
        return self._decode_single(data)

    async def list_recent(self, *, limit: int = 12) -> list[dict[str, Any]]:
        data = await asyncio.to_thread(
            self.collection.get,
            where={"kind": "image_request"},
            include=["documents", "metadatas"],
        )
        items = self._decode_many(data)
        items.sort(key=lambda item: item.get("created_at") or "", reverse=True)
        return items[:limit]

    def _decode_single(self, data: Mapping[str, Any]) -> dict[str, Any] | None:
        items = self._decode_many(data)
        return items[0] if items else None

    def _decode_many(self, data: Mapping[str, Any]) -> list[dict[str, Any]]:
        ids = list(data.get("ids") or [])
        documents = list(data.get("documents") or [])
        metadatas = list(data.get("metadatas") or [])

        results: list[dict[str, Any]] = []
        for request_id, document, metadata in zip(ids, documents, metadatas, strict=False):
            payload = self._load_payload(document)
            merged = {**payload, **(metadata or {}), "request_id": request_id}
            merged.setdefault("results", [])
            merged.setdefault("query", "")
            merged.setdefault("provider", "searxng")
            merged.setdefault("created_at", "")
            merged["result_count"] = int(merged.get("result_count") or len(merged.get("results") or []))
            results.append(merged)
        return results

    def _load_payload(self, document: Any) -> dict[str, Any]:
        if not document:
            return {}
        if isinstance(document, str):
            try:
                return json.loads(document)
            except json.JSONDecodeError:
                return {"raw_document": document}
        if isinstance(document, Mapping):
            return dict(document)
        return {"raw_document": str(document)}
