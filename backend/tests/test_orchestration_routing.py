import pytest

from app.chat.orchestrator import ConversationOrchestrator
from app.core.settings import Settings
from app.web.search import EvidenceValidationResult


class RecordingProvider:
    def __init__(self, answer: str = "model answer") -> None:
        self.answer = answer
        self.prompts: list[str] = []
        self.stream_calls = 0

    async def complete(self, prompt: str, *, metadata: object | None = None) -> str:
        self.prompts.append(prompt)
        return self.answer

    async def stream_complete(self, prompt: str, *, metadata: object | None = None):
        self.prompts.append(prompt)
        self.stream_calls += 1
        yield self.answer


class RecordingMemory:
    def __init__(self) -> None:
        self.calls: list[str] = []

    async def record_event(self, event: object) -> None:
        return None

    async def search_semantic(self, query: str, *, limit: int = 3) -> list[dict[str, object]]:
        self.calls.append(query)
        return [{"content": "The user's name is Harsh.", "score": 0.95}]


class RecordingSearch:
    def __init__(self, *, context: str = "Verified web context", fail: bool = False) -> None:
        self.calls: list[str] = []
        self.context = context
        self.fail = fail

    async def run_with_evidence(self, query: str, *, limit: int = 5):
        self.calls.append(query)
        if self.fail:
            raise RuntimeError("network unavailable")
        return (
            self.context,
            [
                {"title": "Punjab CM", "url": "https://example.com/cm", "site_name": "Example"},
                {"title": "Punjab CM duplicate", "url": "https://example.com/cm", "site_name": "Example"},
            ],
            EvidenceValidationResult(supported=True, reason="verified", source_count=1),
        )


async def collect(orchestrator: ConversationOrchestrator, messages: list[dict[str, str]]) -> str:
    chunks: list[str] = []
    async for chunk in orchestrator.stream_response(messages):
        chunks.append(chunk)
    return "".join(chunks)


@pytest.mark.asyncio
async def test_greeting_skips_memory_search_and_ollama() -> None:
    provider = RecordingProvider()
    memory = RecordingMemory()
    search = RecordingSearch()
    orchestrator = ConversationOrchestrator(
        llm_provider=provider,
        settings=Settings(),
        memory_manager=memory,
        web_search_pipeline=search,
    )

    response = await collect(orchestrator, [{"role": "user", "content": "Hello"}])

    assert "Hello" in response
    assert provider.stream_calls == 0
    assert memory.calls == []
    assert search.calls == []


@pytest.mark.asyncio
async def test_general_knowledge_uses_ollama_only() -> None:
    provider = RecordingProvider("Recursion is a function calling itself.")
    memory = RecordingMemory()
    search = RecordingSearch()
    orchestrator = ConversationOrchestrator(
        llm_provider=provider,
        settings=Settings(),
        memory_manager=memory,
        web_search_pipeline=search,
    )

    response = await collect(orchestrator, [{"role": "user", "content": "What is recursion?"}])

    assert "Recursion" in response
    assert provider.stream_calls == 1
    assert memory.calls == []
    assert search.calls == []


@pytest.mark.asyncio
async def test_current_affairs_searches_before_ollama() -> None:
    provider = RecordingProvider("The current CM is based on the verified context.")
    search = RecordingSearch(context="Bhagwant Mann is the Chief Minister of Punjab.")
    orchestrator = ConversationOrchestrator(
        llm_provider=provider,
        settings=Settings(),
        memory_manager=RecordingMemory(),
        web_search_pipeline=search,
    )

    response = await collect(orchestrator, [{"role": "user", "content": "Current CM of Punjab"}])

    assert search.calls == ["Current CM of Punjab"]
    assert "## Sources" in response
    assert response.count("https://example.com/cm") == 1
    assert "Bhagwant Mann" in provider.prompts[-1]


@pytest.mark.asyncio
async def test_personal_memory_retrieval_does_not_search() -> None:
    provider = RecordingProvider("Your name is Harsh.")
    memory = RecordingMemory()
    search = RecordingSearch()
    orchestrator = ConversationOrchestrator(
        llm_provider=provider,
        settings=Settings(),
        memory_manager=memory,
        web_search_pipeline=search,
    )

    response = await collect(orchestrator, [{"role": "user", "content": "What is my name?"}])

    assert "Harsh" in response
    assert memory.calls == ["What is my name?"]
    assert search.calls == []
    assert "The user's name is Harsh" in provider.prompts[-1]


@pytest.mark.asyncio
async def test_search_failure_falls_back_to_ollama_gracefully() -> None:
    provider = RecordingProvider("I could not verify this from reliable sources.")
    search = RecordingSearch(fail=True)
    orchestrator = ConversationOrchestrator(
        llm_provider=provider,
        settings=Settings(),
        memory_manager=RecordingMemory(),
        web_search_pipeline=search,
    )

    response = await collect(orchestrator, [{"role": "user", "content": "Latest Python version"}])

    assert search.calls
    assert "could not verify" in response.lower()
    assert provider.stream_calls == 0


@pytest.mark.asyncio
async def test_follow_up_uses_recent_context_for_search_query() -> None:
    provider = RecordingProvider("He is 75 years old.")
    search = RecordingSearch(context="Narendra Modi was born on 17 September 1950.")
    orchestrator = ConversationOrchestrator(
        llm_provider=provider,
        settings=Settings(),
        memory_manager=RecordingMemory(),
        web_search_pipeline=search,
    )

    await collect(
        orchestrator,
        [
            {"role": "user", "content": "Who is the current PM of India?"},
            {"role": "assistant", "content": "Narendra Modi is the Prime Minister of India."},
            {"role": "user", "content": "How old is he?"},
        ],
    )

    assert "Narendra Modi" in search.calls[-1]
    assert "How old is he?" in search.calls[-1]

@pytest.mark.asyncio
async def test_office_holder_question_searches_without_current_keyword() -> None:
    provider = RecordingProvider("The PM is based on verified context.")
    search = RecordingSearch(context="Narendra Modi is the Prime Minister of India.")
    orchestrator = ConversationOrchestrator(
        llm_provider=provider,
        settings=Settings(),
        memory_manager=RecordingMemory(),
        web_search_pipeline=search,
    )

    await collect(orchestrator, [{"role": "user", "content": "Who is PM of India?"}])

    assert search.calls == ["Who is PM of India?"]
    assert "Narendra Modi" in provider.prompts[-1]


@pytest.mark.asyncio
async def test_tomorrow_date_is_calculated_without_ollama_or_search() -> None:
    provider = RecordingProvider()
    search = RecordingSearch()
    orchestrator = ConversationOrchestrator(
        llm_provider=provider,
        settings=Settings(),
        memory_manager=RecordingMemory(),
        web_search_pipeline=search,
    )

    response = await collect(orchestrator, [{"role": "user", "content": "Tomorrow date"}])

    assert "Tomorrow" in response
    assert provider.stream_calls == 0
    assert search.calls == []


@pytest.mark.asyncio
async def test_gold_rate_today_routes_to_search() -> None:
    provider = RecordingProvider("The verified gold rate is in the supplied context.")
    search = RecordingSearch(context="India gold rate today: 24K gold is listed by verified market sources.")
    orchestrator = ConversationOrchestrator(
        llm_provider=provider,
        settings=Settings(),
        memory_manager=RecordingMemory(),
        web_search_pipeline=search,
    )

    await collect(orchestrator, [{"role": "user", "content": "what is the gold rate today in india"}])

    assert search.calls == ["what is the gold rate today in india"]
    assert "India gold rate today" in provider.prompts[-1]


@pytest.mark.asyncio
async def test_india_t20_captain_routes_to_search() -> None:
    provider = RecordingProvider("The captain is based on verified context.")
    search = RecordingSearch(context="BCCI profile confirms the India men's T20I captain.")
    orchestrator = ConversationOrchestrator(
        llm_provider=provider,
        settings=Settings(),
        memory_manager=RecordingMemory(),
        web_search_pipeline=search,
    )

    await collect(orchestrator, [{"role": "user", "content": "Tell me mens t20 India Captain Now"}])

    assert search.calls == ["Tell me mens t20 India Captain Now"]
    assert "BCCI profile" in provider.prompts[-1]


@pytest.mark.asyncio
async def test_unverified_live_search_does_not_call_ollama() -> None:
    provider = RecordingProvider("hallucinated live answer")
    search = RecordingSearch(fail=True)
    orchestrator = ConversationOrchestrator(
        llm_provider=provider,
        settings=Settings(),
        memory_manager=RecordingMemory(),
        web_search_pipeline=search,
    )

    response = await collect(orchestrator, [{"role": "user", "content": "Latest Python version"}])

    assert search.calls
    assert provider.stream_calls == 0
    assert "could not verify" in response.lower()


