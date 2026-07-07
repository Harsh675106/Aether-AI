import pytest

from app.web.search import (
    CitationBuilder,
    QueryClassifier,
    ResponseConfidenceAnalyzer,
    SearchDecisionEngine,
    WebSearchPipeline,
)


def test_search_decision_engine_triggers_for_current_topics() -> None:
    engine = SearchDecisionEngine()

    assert engine.should_search("What are the latest pricing changes for OpenAI?") is True
    assert engine.should_search("What does the Python documentation say about async?") is True
    assert engine.should_search("Tell me the next India men’s T20 match details vs England") is True
    assert engine.should_search("Explain recursion in simple terms") is False


def test_citation_builder_formats_markdown_sources() -> None:
    builder = CitationBuilder()
    sources = [
        {"title": "Python Docs", "url": "https://docs.python.org/", "site_name": "Python"},
        {"title": "FastAPI Docs", "url": "https://fastapi.tiangolo.com/", "site_name": "FastAPI"},
    ]

    rendered = builder.build_markdown(sources)

    assert "## Sources" in rendered
    assert "Python Docs" in rendered
    assert "https://docs.python.org/" in rendered
    assert "FastAPI Docs" in rendered


def test_response_confidence_analyzer_flags_uncertain_answers() -> None:
    analyzer = ResponseConfidenceAnalyzer()

    analysis = analyzer.analyze(
        "When was GPT-5.5 released?",
        "I'm not sure, it might have been released recently.",
    )

    assert analysis.confidence < 60
    assert analysis.needs_web_search is True


def test_query_classifier_routes_dynamic_and_static_queries() -> None:
    classifier = QueryClassifier()

    static = classifier.classify("Explain recursion in simple terms")
    dynamic = classifier.classify("Who owns Cursor right now?")
    likely_dynamic = classifier.classify("Tell me about Apple")

    assert static.category == "static"
    assert static.requires_search is False
    assert dynamic.category == "dynamic"
    assert dynamic.requires_search is True
    assert likely_dynamic.category == "likely_dynamic"
    assert likely_dynamic.requires_search is True


@pytest.mark.asyncio
async def test_web_search_pipeline_caches_successful_queries() -> None:
    class CountingSearchClient:
        def __init__(self) -> None:
            self.calls = 0

        async def search(self, query: str, *, limit: int = 5) -> list[dict[str, object]]:
            self.calls += 1
            return [
                {
                    "title": "Example",
                    "url": "https://example.com",
                    "content": "The latest release was announced in 2026.",
                }
            ]

    client = CountingSearchClient()
    pipeline = WebSearchPipeline(search_client=client)

    first_context, first_citations = await pipeline.run("What is the latest release of Aether?")
    second_context, second_citations = await pipeline.run("What is the latest release of Aether?")

    assert first_context
    assert first_context == second_context
    assert first_citations == second_citations
    assert client.calls == 1


@pytest.mark.asyncio
async def test_web_search_pipeline_uses_search_result_summaries_when_retrieval_fails() -> None:
    class SearchOnlyClient:
        async def search(self, query: str, *, limit: int = 5) -> list[dict[str, object]]:
            return [
                {
                    "title": "OpenAI Pricing Update",
                    "url": "https://example.com/openai-pricing",
                    "content": "OpenAI announced a new pricing tier for API usage in 2026.",
                }
            ]

    class RetrievalThatAlwaysFails:
        async def retrieve(self, results: object, *, concurrency: int = 4) -> list[object]:
            return []

    pipeline = WebSearchPipeline(
        search_client=SearchOnlyClient(),
        retrieval_service=RetrievalThatAlwaysFails(),
    )

    context, citations = await pipeline.run("What are the latest pricing changes for OpenAI?")

    assert "OpenAI announced a new pricing tier" in context
    assert len(citations) == 1
    assert citations[0]["title"] == "OpenAI Pricing Update"


@pytest.mark.asyncio
async def test_web_search_pipeline_returns_verification_fallback_when_evidence_is_missing() -> None:
    class EmptySearchClient:
        async def search(self, query: str, *, limit: int = 5) -> list[dict[str, object]]:
            return []

    pipeline = WebSearchPipeline(search_client=EmptySearchClient())

    context, citations = await pipeline.run("Who owns Cursor right now?")

    assert context.startswith("I couldn't verify")
    assert citations == []
