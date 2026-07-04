from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any


class ConversationHistoryStore:
    """Persist chat history in a lightweight SQLite store."""

    def __init__(self, db_path: str | None = None) -> None:
        self.db_path = Path(db_path or "./data/conversations.sqlite3")
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _initialize(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(conversation_id) REFERENCES conversations(id)
                )
                """
            )
            conn.commit()

    def create_conversation(self, title: str) -> str:
        import uuid

        conversation_id = str(uuid.uuid4())
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO conversations (id, title) VALUES (?, ?)",
                (conversation_id, title),
            )
            conn.commit()
        return conversation_id

    def ensure_conversation(self, conversation_id: str, *, title: str = "conversation") -> None:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT 1 FROM conversations WHERE id = ?",
                (conversation_id,),
            ).fetchone()
            if row is None:
                conn.execute(
                    "INSERT INTO conversations (id, title) VALUES (?, ?)",
                    (conversation_id, title),
                )
                conn.commit()

    def append_message(self, conversation_id: str, role: str, content: str) -> None:
        self.ensure_conversation(conversation_id)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
                (conversation_id, role, content),
            )
            conn.commit()

    def get_conversation(self, conversation_id: str) -> list[dict[str, Any]] | None:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id ASC",
                (conversation_id,),
            ).fetchall()
        if not rows:
            return None
        return [{"role": role, "content": content} for role, content in rows]
