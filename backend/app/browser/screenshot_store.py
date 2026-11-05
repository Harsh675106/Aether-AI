from __future__ import annotations

import json
import sqlite3
import uuid
from collections.abc import Mapping
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.logging import get_logger
from app.core.settings import Settings

logger = get_logger(__name__)


class ScreenshotStore:
    """Stores browser screenshots in-memory with lightweight database persistence.
    
    Avoids saving raw .png image files into the codebase file directory.
    Stores metadata and base64 image data in-memory and in an SQLite store.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or Settings()
        self._memory_cache: dict[str, dict[str, Any]] = {}
        
        # Database persistence path
        backend_dir = Path(__file__).resolve().parents[2]
        self._db_path = backend_dir / "data" / "screenshots.sqlite3"
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
        self._load_from_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self._db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        try:
            with self._get_connection() as conn:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS screenshots (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        url TEXT NOT NULL,
                        image_data TEXT NOT NULL,
                        full_page INTEGER NOT NULL DEFAULT 0,
                        size_bytes INTEGER NOT NULL DEFAULT 0,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                conn.commit()
        except Exception as exc:
            logger.warning("failed_to_init_screenshot_db", error=str(exc))

    def _load_from_db(self) -> None:
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("SELECT * FROM screenshots ORDER BY created_at DESC LIMIT 100")
                for row in cursor.fetchall():
                    item = {
                        "id": row["id"],
                        "title": row["title"],
                        "url": row["url"],
                        "image_data": row["image_data"],
                        "full_page": bool(row["full_page"]),
                        "size_bytes": row["size_bytes"],
                        "created_at": row["created_at"],
                    }
                    self._memory_cache[item["id"]] = item
            logger.info("screenshot_store_loaded_from_db", count=len(self._memory_cache))
        except Exception as exc:
            logger.warning("failed_to_load_screenshots_from_db", error=str(exc))

    async def record(self, payload: Mapping[str, Any]) -> str:
        """Stores a screenshot into memory and the database."""
        screenshot_id = str(payload.get("id") or uuid.uuid4())
        created_at = str(payload.get("created_at") or datetime.now(timezone.utc).isoformat())

        record: dict[str, Any] = {
            "id": screenshot_id,
            "title": str(payload.get("title") or "Page Screenshot"),
            "url": str(payload.get("url") or ""),
            "image_data": str(payload.get("image_data") or ""),
            "full_page": bool(payload.get("full_page", False)),
            "size_bytes": int(payload.get("size_bytes") or len(str(payload.get("image_data") or ""))),
            "created_at": created_at,
        }

        # Store in memory
        self._memory_cache[screenshot_id] = record

        # Persist to SQLite
        try:
            with self._get_connection() as conn:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO screenshots (id, title, url, image_data, full_page, size_bytes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        record["id"],
                        record["title"],
                        record["url"],
                        record["image_data"],
                        1 if record["full_page"] else 0,
                        record["size_bytes"],
                        record["created_at"],
                    ),
                )
                conn.commit()
        except Exception as exc:
            logger.warning("failed_to_persist_screenshot_to_db", error=str(exc))

        logger.info("screenshot_recorded_in_memory", id=screenshot_id, title=record["title"])
        return screenshot_id

    async def get(self, screenshot_id: str) -> dict[str, Any] | None:
        """Retrieves a single screenshot by ID."""
        return self._memory_cache.get(screenshot_id)

    async def list_recent(self, *, limit: int = 50) -> list[dict[str, Any]]:
        """Lists recent screenshots from memory."""
        items = list(self._memory_cache.values())
        items.sort(key=lambda item: item.get("created_at") or "", reverse=True)
        return items[:limit]

    async def delete(self, screenshot_id: str) -> bool:
        """Deletes a screenshot from memory and database."""
        removed = self._memory_cache.pop(screenshot_id, None) is not None

        try:
            with self._get_connection() as conn:
                cursor = conn.execute("DELETE FROM screenshots WHERE id = ?", (screenshot_id,))
                conn.commit()
                if cursor.rowcount > 0:
                    removed = True
        except Exception as exc:
            logger.warning("failed_to_delete_screenshot_from_db", error=str(exc))

        logger.info("screenshot_deleted", id=screenshot_id, success=removed)
        return removed

    async def clear_all(self) -> int:
        """Clears all stored screenshots."""
        count = len(self._memory_cache)
        self._memory_cache.clear()

        try:
            with self._get_connection() as conn:
                conn.execute("DELETE FROM screenshots")
                conn.commit()
        except Exception as exc:
            logger.warning("failed_to_clear_screenshots_from_db", error=str(exc))

        return count
