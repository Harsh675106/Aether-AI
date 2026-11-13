from __future__ import annotations

import asyncio
import hashlib
import json
from collections.abc import Mapping
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.core.settings import Settings


def canonical_video_url(url: str) -> str:
    parsed = urlsplit(url.strip())
    query = [
        (key, value)
        for key, value in parse_qsl(parsed.query)
        if not key.lower().startswith("utm_")
    ]
    host = (parsed.hostname or "").lower()
    if host in {"youtu.be", "www.youtube.com", "youtube.com", "m.youtube.com"}:
        path_parts = parsed.path.strip("/").split("/")
        video_id = path_parts[0] if host == "youtu.be" else dict(query).get("v", "")
        if not video_id and len(path_parts) > 1 and path_parts[0] in {"shorts", "embed", "live"}:
            video_id = path_parts[1]
        if video_id:
            return f"https://www.youtube.com/watch?v={video_id}"
    if host.startswith("www."):
        host = host[4:]
    port = parsed.port
    if port and not (parsed.scheme.lower() == "https" and port == 443) and not (
        parsed.scheme.lower() == "http" and port == 80
    ):
        host = f"{host}:{port}"
    if ":" in host and not host.startswith("["):
        host = f"[{host}]"
    return urlunsplit(
        (
            parsed.scheme.lower(),
            host,
            parsed.path.rstrip("/"),
            urlencode(query),
            "",
        )
    )


def video_id_for_url(url: str) -> str:
    return hashlib.sha256(canonical_video_url(url).encode("utf-8")).hexdigest()


class SavedVideoStore:
    """Persist saved video metadata in a dedicated ChromaDB collection."""

    collection_name = "aether_saved_videos"

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or Settings()
        Path(self.settings.chroma_persist_directory).mkdir(parents=True, exist_ok=True)
        client = chromadb.PersistentClient(
            path=self.settings.chroma_persist_directory,
            settings=ChromaSettings(allow_reset=True),
        )
        self.collection = client.get_or_create_collection(name=self.collection_name)

    async def save(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        video_url = str(payload["video_url"])
        video_id = video_id_for_url(video_url)
        existing = await self.get(video_id)
        saved_at = (
            str(existing["saved_at"])
            if existing
            else datetime.now(UTC).isoformat()
        )
        record = {
            **dict(payload),
            "id": video_id,
            "video_url": canonical_video_url(video_url),
            "saved_at": saved_at,
        }
        await asyncio.to_thread(
            self.collection.upsert,
            ids=[video_id],
            documents=[json.dumps(record, ensure_ascii=False, sort_keys=True, default=str)],
            metadatas=[
                {
                    "kind": "saved_video",
                    "video_id": video_id,
                    "title": str(payload.get("title", "")),
                    "video_url": record["video_url"],
                    "saved_at": saved_at,
                }
            ],
        )
        return record

    async def get(self, video_id: str) -> dict[str, Any] | None:
        data = await asyncio.to_thread(
            self.collection.get,
            ids=[video_id],
            include=["documents"],
        )
        documents = list(data.get("documents") or [])
        if not documents or not documents[0]:
            return None
        return self._decode(documents[0])

    async def list(
        self,
        *,
        query: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        data = await asyncio.to_thread(
            self.collection.get,
            where={"kind": "saved_video"},
            include=["documents"],
        )
        videos = [self._decode(document) for document in data.get("documents") or [] if document]
        if query:
            needle = query.casefold()
            videos = [
                video
                for video in videos
                if needle
                in " ".join(
                    str(video.get(key) or "")
                    for key in ("title", "description", "platform", "creator")
                ).casefold()
            ]
        videos.sort(key=lambda video: str(video.get("saved_at") or ""), reverse=True)
        return videos if limit is None else videos[:limit]

    async def remove(self, video_id: str) -> bool:
        existing = await self.get(video_id)
        if existing is None:
            return False
        await asyncio.to_thread(self.collection.delete, ids=[video_id])
        return True

    @staticmethod
    def _decode(document: Any) -> dict[str, Any]:
        if isinstance(document, str):
            payload = json.loads(document)
            if isinstance(payload, dict):
                return payload
        raise ValueError("Saved video record is invalid")
