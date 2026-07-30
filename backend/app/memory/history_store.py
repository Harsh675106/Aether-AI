from __future__ import annotations

import uuid
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models.conversation import Conversation, Message


class ConversationHistoryStore:
    """Persist chat history in a lightweight SQLite/PostgreSQL store using SQLAlchemy."""

    def __init__(self, session_factory_or_db_path: async_sessionmaker[AsyncSession] | str) -> None:
        if isinstance(session_factory_or_db_path, str):
            db_path = session_factory_or_db_path
            if not (db_path.startswith("sqlite") or db_path.startswith("postgresql")):
                db_path = f"sqlite+aiosqlite:///{db_path}"
            self._engine = create_async_engine(db_path)
            self.session_factory = async_sessionmaker(self._engine, expire_on_commit=False)
            self._needs_init = True
        else:
            self.session_factory = session_factory_or_db_path
            self._engine = None
            self._needs_init = False

    async def _ensure_initialized(self) -> None:
        if self._needs_init and self._engine is not None:
            from app.database.base import Base
            async with self._engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            self._needs_init = False

    async def create_conversation(self, title: str) -> str:
        await self._ensure_initialized()
        conversation_id = str(uuid.uuid4())
        async with self.session_factory() as session:
            async with session.begin():
                conversation = Conversation(id=conversation_id, title=title)
                session.add(conversation)
        return conversation_id

    async def ensure_conversation(self, conversation_id: str, *, title: str = "conversation") -> None:
        await self._ensure_initialized()
        async with self.session_factory() as session:
            async with session.begin():
                result = await session.execute(
                    select(Conversation).where(Conversation.id == conversation_id)
                )
                if result.scalar_one_or_none() is None:
                    conversation = Conversation(id=conversation_id, title=title)
                    session.add(conversation)

    async def append_message(self, conversation_id: str, role: str, content: str) -> None:
        await self._ensure_initialized()
        await self.ensure_conversation(conversation_id)
        async with self.session_factory() as session:
            async with session.begin():
                message = Message(conversation_id=conversation_id, role=role, content=content)
                session.add(message)

    async def get_conversation(self, conversation_id: str) -> list[dict[str, Any]] | None:
        await self._ensure_initialized()
        async with self.session_factory() as session:
            result = await session.execute(
                select(Message)
                .where(Message.conversation_id == conversation_id)
                .order_by(Message.id.asc())
            )
            messages = result.scalars().all()
            if not messages:
                return None
            return [{"role": msg.role, "content": msg.content} for msg in messages]
