import pytest

from app.web.search import (
    CitationBuilder,
    EvidenceValidator,
    QueryClassifier,
    RankingService,
    ResponseConfidenceAnalyzer,
    RetrievedDocument,
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

def test_query_classifier_skips_greetings_identity_and_empty_queries() -> None:
    classifier = QueryClassifier()

    assert classifier.classify("").requires_search is False
    assert classifier.classify("Hello").requires_search is False
    assert classifier.classify("What is your name?").requires_search is False


def test_evidence_validator_allows_multiple_years_in_relevant_sources() -> None:
    validator = EvidenceValidator()
    documents = [
        RetrievedDocument(
            title="Official profile",
            url="https://example.gov/profile",
            content="Updated in 2026. The minister was born in 1970 and won elections in 2022.",
        ),
        RetrievedDocument(
            title="News profile",
            url="https://news.example/profile",
            content="The current minister took office in 2022 and the page was reviewed in 2026.",
        ),
    ]

    result = validator.validate(documents, "Who is the current minister?")

    assert result.supported is True
    assert result.conflict_count == 0


@pytest.mark.asyncio
async def test_web_search_pipeline_does_not_cache_failed_queries() -> None:
    class FlakySearchClient:
        def __init__(self) -> None:
            self.calls = 0

        async def search(self, query: str, *, limit: int = 5) -> list[dict[str, object]]:
            self.calls += 1
            if self.calls <= 3:
                return []
            return [
                {
                    "title": "Verified result",
                    "url": "https://example.com/verified",
                    "content": "The latest verified result is available in 2026.",
                }
            ]

    client = FlakySearchClient()
    pipeline = WebSearchPipeline(search_client=client)

    first_context, first_citations = await pipeline.run("Latest verified result")
    second_context, second_citations = await pipeline.run("Latest verified result")

    assert first_context.startswith("I couldn't verify")
    assert first_citations == []
    assert "latest verified result" in second_context.lower()
    assert len(second_citations) == 1
    assert client.calls == 4


def test_search_optimizer_adds_context_for_sensitive_live_queries() -> None:
    engine = SearchDecisionEngine()

    assert "India" in engine.optimize_query("Current CM of Punjab")
    assert "python.org" in engine.optimize_query("Latest Python version")
    assert "BCCI" in engine.optimize_query("Tell me mens t20 India Captain Now")
    assert "24k" in engine.optimize_query("Gold rate today in India")


def test_ranking_penalizes_pakistan_punjab_for_india_cm_query() -> None:
    ranking = RankingService()
    results = [
        {
            "title": "Chief Minister of Punjab Pakistan",
            "url": "https://punjab.gov.pk/cm",
            "content": "Maryam Nawaz is Chief Minister in Lahore Pakistan.",
        },
        {
            "title": "Office of Chief Minister Punjab India",
            "url": "https://cmoffice.punjab.gov.in/",
            "content": "Official Government of Punjab India Chief Minister information.",
        },
    ]

    ranked = ranking.rank_results(results, "Current CM of Punjab")

    assert ranked[0].url == "https://cmoffice.punjab.gov.in/"


def test_searxng_client_determines_dynamic_categories() -> None:
    from app.web.search import SearXNGClient

    client = SearXNGClient()

    assert client._determine_categories("Latest breaking news today") == "general,news"
    assert client._determine_categories("Current Education Minister India 2026") == "general,news"
    assert client._determine_categories("Python FastAPI async docker setup") == "general,it"
    assert client._determine_categories("ArXiv physics quantum theorem paper") == "general,science"


def test_searxng_client_merges_and_deduplicates_multi_engine_results() -> None:
    from app.web.search import SearXNGClient

    client = SearXNGClient()
    existing = [
        {
            "title": "India Education Ministry",
            "url": "https://education.gov.in/",
            "content": "Ministry of Education official portal.",
            "engine": "bing",
            "engines": ["bing"],
            "score": 1.0,
        }
    ]
    incoming = [
        {
            "title": "Ministry of Education - Government of India",
            "url": "https://education.gov.in",
            "content": "Updated official details.",
            "engine": "google news",
            "engines": ["google news"],
            "score": 1.5,
        },
        {
            "title": "Wikipedia Minister Profile",
            "url": "https://en.wikipedia.org/wiki/Ministry_of_Education_(India)",
            "content": "Wikipedia article on education ministry.",
            "engine": "wikipedia",
            "engines": ["wikipedia"],
            "score": 1.2,
        },
    ]

    merged = client._merge_results(existing, incoming)

    assert len(merged) == 2
    gov_result = next(r for r in merged if "education.gov.in" in r["url"])
    assert "bing" in gov_result["engines"]
    assert "google news" in gov_result["engines"]
    assert gov_result["score"] > 1.0






