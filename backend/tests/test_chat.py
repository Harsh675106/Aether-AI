from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.chat.orchestrator import ConversationOrchestrator
from app.chat.schemas import ChatMessage
from app.core.settings import Settings
from app.main import create_app
from app.memory.history_store import ConversationHistoryStore


class FakeProvider:
    def __init__(self) -> None:
        self.prompts: list[str] = []

    async def complete(self, prompt: str, *, metadata: object | None = None) -> str:
        self.prompts.append(prompt)
        return "hello"

    async def stream_complete(self, prompt: str, *, metadata: object | None = None):
        self.prompts.append(prompt)
        yield "hello"


class FakeMemoryManager:
    async def record_event(self, event: object) -> None:
        return None

    async def search_semantic(self, query: str, *, limit: int = 3) -> list[dict[str, object]]:
        return [{"content": "User likes Python", "metadata": {}}]


def test_chat_streaming_endpoint_returns_sse_events() -> None:
    client = TestClient(create_app())
    response = client.post(
        "/api/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Say hello from Aether."}],
            "stream": True,
            "conversation_id": "conv-test",
        },
        headers={"accept": "text/event-stream"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    body = response.text.lower()
    assert "data:" in body
    assert "aether" in body or "hello" in body


@pytest.mark.asyncio
async def test_orchestrator_uses_history_and_memory(tmp_path: Path) -> None:
    history_store = ConversationHistoryStore(str(tmp_path / "history.sqlite3"))
    conversation_id = history_store.create_conversation("demo")
    history_store.append_message(conversation_id, "user", "Earlier question")
    history_store.append_message(conversation_id, "assistant", "Earlier answer")

    provider = FakeProvider()
    orchestrator = ConversationOrchestrator(
        llm_provider=provider,
        history_store=history_store,
        memory_manager=FakeMemoryManager(),
        settings=Settings(),
    )

    async for _ in orchestrator.stream_response(
        [{"role": "user", "content": "What language do I like?"}],
        conversation_id=conversation_id,
    ):
        continue

    prompt = provider.prompts[-1]
    assert "Earlier question" in prompt
    assert "User likes Python" in prompt
