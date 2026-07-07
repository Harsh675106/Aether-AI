from datetime import datetime, timedelta, timezone
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


class FallbackProvider(FakeProvider):
    def __init__(self) -> None:
        super().__init__()
        self.stream_calls = 0

    async def complete(self, prompt: str, *, metadata: object | None = None) -> str:
        self.prompts.append(prompt)
        return '{"confidence": 28, "needs_web_search": true, "reason": "uncertain answer"}'

    async def stream_complete(self, prompt: str, *, metadata: object | None = None):
        self.prompts.append(prompt)
        self.stream_calls += 1
        if self.stream_calls == 1:
            yield "I don't know."
            return
        yield "The latest release was announced in 2026."


class StubWebSearchPipeline:
    async def run(self, query: str, *, limit: int = 5) -> tuple[str, list[dict[str, object]]]:
        return (
            "Search context: the latest release was announced in 2026.",
            [{"title": "Release notes", "url": "https://example.com", "site_name": "Example"}],
        )


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


def test_default_cors_origins_include_local_frontend_hosts() -> None:
    settings = Settings()

    assert "http://localhost:5173" in settings.cors_origins
    assert "http://127.0.0.1:5173" in settings.cors_origins


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


@pytest.mark.asyncio
async def test_orchestrator_answers_current_date_in_india_directly() -> None:
    provider = FakeProvider()
    orchestrator = ConversationOrchestrator(
        llm_provider=provider,
        settings=Settings(),
        memory_manager=FakeMemoryManager(),
    )

    response_parts: list[str] = []
    async for chunk in orchestrator.stream_response([{"role": "user", "content": "Tell me today's day and date in India"}]):
        response_parts.append(chunk)

    response_text = "".join(response_parts)
    now = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    assert now.strftime("%A") in response_text
    assert now.strftime("%d %B %Y") in response_text


@pytest.mark.asyncio
async def test_orchestrator_retries_with_web_context_when_confidence_is_low() -> None:
    provider = FallbackProvider()
    orchestrator = ConversationOrchestrator(
        llm_provider=provider,
        settings=Settings(),
        memory_manager=FakeMemoryManager(),
        web_search_pipeline=StubWebSearchPipeline(),
    )

    response_parts: list[str] = []
    async for chunk in orchestrator.stream_response([{"role": "user", "content": "When was the latest release announced?"}]):
        response_parts.append(chunk)

    assert provider.stream_calls == 2
    assert any("2026" in part for part in response_parts)
    assert any("## Sources" in part for part in response_parts)
