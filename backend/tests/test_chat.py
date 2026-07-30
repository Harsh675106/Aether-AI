from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.chat.orchestrator import ConversationOrchestrator
from app.chat.response_generator import ResponseGenerator
from app.chat.schemas import ChatMessage
from app.core.settings import Settings
from app.llm.ollama_provider import OllamaProvider
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


class LongStreamProvider(FakeProvider):
    async def stream_complete(self, prompt: str, *, metadata: object | None = None):
        self.prompts.append(prompt)
        for index in range(60):
            yield f"chunk-{index}"


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
    conversation_id = await history_store.create_conversation("demo")
    await history_store.append_message(conversation_id, "user", "Earlier question")
    await history_store.append_message(conversation_id, "assistant", "Earlier answer")

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

    assert any("Earlier question" in prompt for prompt in provider.prompts)
    assert any("User likes Python" in prompt for prompt in provider.prompts)


def test_response_generator_prompt_requests_markdown_structure_and_emojis() -> None:
    generator = ResponseGenerator(llm_provider=FakeProvider())

    prompt = generator._system_prompt(None)

    assert "subheadings" in prompt.lower()
    assert "emojis" in prompt.lower()
    assert "markdown structure" in prompt.lower()


def test_ollama_provider_uses_metadata_generation_options() -> None:
    provider = OllamaProvider(Settings(max_tokens=128, temperature=0.2, top_p=0.7))

    payload = provider._build_payload(
        "Explain DBMS",
        metadata={
            "max_tokens": 2048,
            "temperature": 0.9,
            "top_p": 0.95,
        },
    )

    assert payload["options"]["num_predict"] == 2048
    assert payload["options"]["temperature"] == 0.9
    assert payload["options"]["top_p"] == 0.95


@pytest.mark.asyncio
async def test_orchestrator_streams_every_chunk_from_llm() -> None:
    provider = LongStreamProvider()
    orchestrator = ConversationOrchestrator(
        llm_provider=provider,
        settings=Settings(),
        memory_manager=FakeMemoryManager(),
    )

    response_chunks = [
        chunk
        async for chunk in orchestrator.stream_response(
            [{"role": "user", "content": "Explain DBMS in detail"}]
        )
    ]

    assert len(response_chunks) == 60
    assert response_chunks[-1] == "chunk-59"


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
async def test_orchestrator_searches_before_model_for_current_questions() -> None:
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

    assert provider.stream_calls == 1
    assert "Search context: the latest release was announced in 2026." in provider.prompts[-1]
    assert any("## Sources" in part for part in response_parts)


def test_is_personal_recall_helper() -> None:
    from app.chat.memory_manager import RelevantMemoryManager
    from app.memory.manager import PlaceholderMemoryManager
    
    rmm = RelevantMemoryManager(PlaceholderMemoryManager())
    assert rmm._is_personal_recall("what am I studying now?") is True
    assert rmm._is_personal_recall("what is my name?") is True
    assert rmm._is_personal_recall("What programming language does the user like?") is True
    assert rmm._is_personal_recall("Do birds fly?") is False


class RecordingMemoryManager:
    def __init__(self) -> None:
        self.events: list[dict] = []
        
    async def record_event(self, event: dict) -> None:
        self.events.append(event)
        
    async def search_semantic(self, query: str, *, limit: int = 3) -> list[dict]:
        return []


class FactsProvider:
    async def complete(self, prompt: str, *, metadata: object | None = None) -> str:
        return "The user's name is Harsh.\nThe user is studying computer science.\nNONE\n"

    async def stream_complete(self, prompt: str, *, metadata: object | None = None):
        yield "The user's name is Harsh.\nThe user is studying computer science.\nNONE\n"


@pytest.mark.asyncio
async def test_orchestrator_extracts_and_saves_memories(tmp_path: Path) -> None:
    history_store = ConversationHistoryStore(str(tmp_path / "history.sqlite3"))
    provider = FactsProvider()
    memory_manager = RecordingMemoryManager()
    orchestrator = ConversationOrchestrator(
        llm_provider=provider,
        settings=Settings(),
        memory_manager=memory_manager,
        history_store=history_store,
    )
    
    await orchestrator._persist_conversation("conv-123", "My name is Harsh and I study computer science", "Nice to meet you Harsh.")
    
    assert len(memory_manager.events) == 2
    assert memory_manager.events[0]["content"] == "The user's name is Harsh"
    assert memory_manager.events[0]["conversation_id"] == "conv-123"
    assert memory_manager.events[1]["content"] == "The user is studying computer science"


def test_should_extract_memory() -> None:
    from app.chat.intent import IntentCategory
    orchestrator = ConversationOrchestrator(
        llm_provider=FactsProvider(),
        settings=Settings(),
        memory_manager=RecordingMemoryManager(),
    )
    
    assert orchestrator._should_extract_memory(IntentCategory.GREETING, "hi") is False
    assert orchestrator._should_extract_memory(IntentCategory.WEATHER, "weather in Paris") is False
    assert orchestrator._should_extract_memory(IntentCategory.PERSONAL_MEMORY, "explain OOP") is False
    assert orchestrator._should_extract_memory(IntentCategory.PERSONAL_MEMORY, "remember that I study computer science") is True


class DuplicateMemoryManager:
    def __init__(self, distance: float) -> None:
        self.distance = distance
        self.events: list[dict] = []
        
    async def record_event(self, event: dict) -> None:
        self.events.append(event)
        
    async def search_semantic(self, query: str, *, limit: int = 3) -> list[dict]:
        return [{"content": "The user's name is Harsh", "distance": self.distance}]


@pytest.mark.asyncio
async def test_no_duplicate_memory_recording(tmp_path: Path) -> None:
    history_store = ConversationHistoryStore(str(tmp_path / "history.sqlite3"))
    provider = FactsProvider()
    
    # Under distance threshold (0.25), should skip recording
    dup_manager = DuplicateMemoryManager(distance=0.1)
    orchestrator = ConversationOrchestrator(
        llm_provider=provider,
        settings=Settings(),
        memory_manager=dup_manager,
        history_store=history_store,
    )
    await orchestrator._persist_conversation("conv-123", "My name is Harsh", "Nice to meet you Harsh.")
    assert len(dup_manager.events) == 0

    # Over distance threshold, should record
    diff_manager = DuplicateMemoryManager(distance=0.6)
    orchestrator2 = ConversationOrchestrator(
        llm_provider=provider,
        settings=Settings(),
        memory_manager=diff_manager,
        history_store=history_store,
    )
    await orchestrator2._persist_conversation("conv-123", "My name is Harsh", "Nice to meet you Harsh.")
    assert len(diff_manager.events) == 2


def test_history_cleaning_removes_filler() -> None:
    from app.chat.prompt_builder import PromptBuilder, PromptContext
    from app.chat.schemas import ChatMessage
    
    builder = PromptBuilder()
    history = [
        ChatMessage(role="user", content="hello"),
        ChatMessage(role="assistant", content="Hello! How can I help you today?"),
        ChatMessage(role="user", content="My name is Harsh"),
        ChatMessage(role="assistant", content="Nice to meet you Harsh"),
        ChatMessage(role="user", content="thanks"),
        ChatMessage(role="user", content="ok"),
    ]
    prompt = builder.build(PromptContext(history=history))
    
    assert "User: My name is Harsh" in prompt
    assert "Assistant: Nice to meet you Harsh" in prompt
    assert "User: hello" not in prompt
    assert "User: thanks" not in prompt
    assert "User: ok" not in prompt




