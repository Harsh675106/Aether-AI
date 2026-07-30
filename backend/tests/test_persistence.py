import sqlite3
from pathlib import Path

import pytest

from app.core.settings import Settings
from app.memory.chroma_manager import ChromaMemoryManager
from app.memory.history_store import ConversationHistoryStore
from app.web.search import WebContentExtractor


@pytest.mark.asyncio
async def test_memory_store_and_search(tmp_path: Path) -> None:
    settings = Settings(
        chroma_persist_directory=str(tmp_path / "chroma"), chroma_collection_name="test-memory"
    )
    manager = ChromaMemoryManager(settings=settings)

    await manager.record_event(
        {
            "content": "User prefers concise answers and likes Python.",
            "source": "conversation",
            "conversation_id": "conv-1",
        }
    )

    results = await manager.search_semantic("What programming language does the user like?", limit=3)

    assert results
    assert any("Python" in item["content"] for item in results)


@pytest.mark.asyncio
async def test_conversation_history_store_round_trip(tmp_path: Path) -> None:
    db_path = tmp_path / "history.sqlite3"
    store = ConversationHistoryStore(str(db_path))

    conversation_id = await store.create_conversation("demo")
    await store.append_message(conversation_id, "user", "Hello")
    await store.append_message(conversation_id, "assistant", "Hi there")

    history = await store.get_conversation(conversation_id)

    assert history is not None
    assert [message["content"] for message in history] == ["Hello", "Hi there"]


def test_web_content_extractor_removes_noise() -> None:
    html = """
    <html><body>
    <header>Skip me</header>
    <main>
        <h1>Article title</h1>
        <p>This is the main article content.</p>
        <p>It should be preserved.</p>
    </main>
    <footer>Ignore this</footer>
    </body></html>
    """

    extractor = WebContentExtractor()
    text = extractor.extract_from_html(html)

    assert "Article title" in text
    assert "main article content" in text
    assert "Skip me" not in text
    assert "Ignore this" not in text
