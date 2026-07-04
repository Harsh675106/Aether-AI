from app.web.search import CitationBuilder, SearchDecisionEngine


def test_search_decision_engine_triggers_for_current_topics() -> None:
    engine = SearchDecisionEngine()

    assert engine.should_search("What are the latest pricing changes for OpenAI?") is True
    assert engine.should_search("What does the Python documentation say about async?") is True
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
