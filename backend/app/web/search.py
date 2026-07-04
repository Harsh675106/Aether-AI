from __future__ import annotations

import asyncio
import re
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup



@dataclass(frozen=True)
class SearchResult:
    title: str
    url: str
    content: str = ""
    site_name: str = ""
    published_date: str | None = None
    score: float = 0.0


@dataclass(frozen=True)
class RetrievedDocument:
    title: str
    url: str
    content: str
    site_name: str = ""
    published_date: str | None = None


class SearchDecisionEngine:
    """Decide when a user query should trigger a web search."""

    TRIGGER_KEYWORDS = {
        "latest", "recent", "current", "today", "now", "breaking", "news", "weather",
        "sports", "stock", "stocks", "crypto", "bitcoin", "price", "pricing", "rate",
        "exchange", "release", "version", "update", "documentation", "docs", "api",
        "framework", "library", "company", "product", "government", "technology",
        "roadmap", "changelog", "conference", "event", "policy", "regulation",
    }
    NEGATIVE_KEYWORDS = {
        "explain", "why", "how", "describe", "summarize", "write", "brainstorm",
        "conversation", "chat", "general", "concept", "theory", "algorithm",
        "math", "mathematics", "reasoning", "proof", "philosophy",
    }
    ABBREVIATIONS = {
        "api": "application programming interface",
        "llm": "large language model",
        "ui": "user interface",
        "ux": "user experience",
        "docs": "documentation",
        "faq": "frequently asked questions",
    }

    def should_search(self, query: str) -> bool:
        normalized = self._normalize(query)
        if not normalized:
            return False
        if any(term in normalized for term in self.NEGATIVE_KEYWORDS):
            return False
        if any(term in normalized for term in self.TRIGGER_KEYWORDS):
            return True
        if re.search(r"\b(latest|recent|current|today|now|breaking|upcoming|release|version|update|news|weather|sports|stock|crypto|bitcoin|price|pricing|rate|exchange|documentation|docs|api|framework|library|company|product|government)\b", normalized):
            return True
        return False

    def optimize_query(self, query: str) -> str:
        normalized = self._normalize(query)
        if not normalized:
            return ""

        text = re.sub(r"\b(what|what's|who|when|where|why|how|can|could|please|tell|me|find|search|show|give|the|a|an|is|are|was|were|do|does|did|should|for|about|of|to|from|in|on|and|or)\b", " ", normalized)
        for abbreviation, expansion in self.ABBREVIATIONS.items():
            text = re.sub(rf"\b{re.escape(abbreviation)}\b", expansion, text)
        text = re.sub(r"\s+", " ", text).strip()
        if len(text) > 120:
            return text[:120].strip()
        return text or normalized

    def _normalize(self, text: str) -> str:
        return re.sub(r"\s+", " ", text.lower()).strip()


class WebContentExtractor:
    """Fetch and clean web content from a URL or HTML body."""

    def extract_from_html(self, html: str, *, url: str | None = None) -> str:
        if not html:
            return ""

        try:
            import trafilatura  # type: ignore
        except ImportError:
            trafilatura = None

        if trafilatura is not None:
            extracted = trafilatura.extract(html, include_comments=False, include_tables=False)
            if extracted and extracted.strip():
                return self._clean_text(extracted)

        try:
            from readability import Document  # type: ignore
        except ImportError:
            Document = None

        if Document is not None:
            try:
                summary = Document(html).summary()
            except Exception:
                summary = ""
            if summary and summary.strip():
                return self._clean_text(summary)

        soup = BeautifulSoup(html, "html.parser")
        for selector in [
            "script",
            "style",
            "noscript",
            "svg",
            "iframe",
            "form",
            "button",
            "input",
            "select",
            "textarea",
            "header",
            "footer",
            "nav",
            "aside",
        ]:
            for tag in soup.select(selector):
                tag.decompose()

        for tag in soup.find_all(True):
            classes = " ".join(tag.get("class", [])).lower() if tag.get("class") else ""
            identifier = " ".join([tag.get("id", "")]).lower() if tag.get("id") else ""
            if any(token in classes or token in identifier for token in ["ad", "ads", "banner", "cookie", "sidebar", "menu", "nav", "footer", "comment", "related"]):
                tag.decompose()

        article = soup.find(["article", "main"])
        if article is not None:
            soup = article

        text_parts = []
        for element in soup.find_all(["p", "li", "h1", "h2", "h3", "h4", "h5", "h6"]):
            text = element.get_text(" ", strip=True)
            if text and len(text) > 20:
                text_parts.append(text)
        return self._clean_text("\n".join(text_parts))

    def _clean_text(self, text: str) -> str:
        text = re.sub(r"\s+", " ", text).strip()
        return text


class SearXNGClient:
    """Query a local or remote SearXNG instance."""

    def __init__(self, base_url: str = "http://localhost:8080") -> None:
        self.base_url = base_url.rstrip("/")

    async def search(self, query: str, *, limit: int = 5) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=20, headers={"User-Agent": "AetherAI/1.0"}) as client:
            response = await client.get(
                f"{self.base_url}/search",
                params={
                    "q": query,
                    "format": "json",
                    "categories": "general",
                    "language": "en",
                },
            )
            response.raise_for_status()
            payload = response.json()

        results: list[dict[str, Any]] = []
        for item in payload.get("results", [])[: limit * 2]:
            url = item.get("url", "")
            if not url:
                continue
            results.append(
                {
                    "title": item.get("title", ""),
                    "url": url,
                    "content": item.get("content", ""),
                    "site_name": item.get("engine") or self._site_name(url),
                    "published_date": item.get("publishedDate") or None,
                }
            )
        return results

    def _site_name(self, url: str) -> str:
        parsed = urlparse(url)
        return parsed.netloc.replace("www.", "") or "web"


class RankingService:
    """Rank web results by authority, relevance, freshness, and quality."""

    OFFICIAL_DOMAINS = (
        "docs.python.org",
        "developer.mozilla.org",
        "learn.microsoft.com",
        "fastapi.tiangolo.com",
        "react.dev",
        "nodejs.org",
        "pytorch.org",
        "tensorflow.org",
        "kubernetes.io",
        "docker.com",
        "github.com",
        "githubusercontent.com",
        "w3.org",
        "openai.com",
        "anthropic.com",
        "cloud.google.com",
        "aws.amazon.com",
        "azure.microsoft.com",
        "huggingface.co",
    )

    def rank_results(self, results: Sequence[dict[str, Any]], query: str) -> list[SearchResult]:
        normalized_query = self._tokenize(query)
        seen_urls: set[str] = set()
        ranked: list[SearchResult] = []

        for item in results:
            url = str(item.get("url", "")).strip()
            if not url:
                continue
            normalized_url = self._normalize_url(url)
            if normalized_url in seen_urls:
                continue
            seen_urls.add(normalized_url)

            content = str(item.get("content", "") or "")
            title = str(item.get("title", "") or "")
            combined_text = f"{title} {content} {url}".lower()
            relevance = sum(1 for term in normalized_query if term and term in combined_text)
            authority = self._authority_score(url, title, item.get("site_name", ""))
            freshness = self._freshness_score(title, content)
            quality = self._quality_score(title, content)
            score = relevance * 2.0 + authority + freshness + quality
            ranked.append(
                SearchResult(
                    title=title,
                    url=url,
                    content=content,
                    site_name=str(item.get("site_name") or self._site_name(url)),
                    published_date=item.get("published_date"),
                    score=score,
                )
            )

        ranked.sort(key=lambda item: item.score, reverse=True)
        return ranked

    def _tokenize(self, text: str) -> set[str]:
        return {token for token in re.findall(r"[a-z0-9]+", text.lower()) if token}

    def _normalize_url(self, url: str) -> str:
        parsed = urlparse(url)
        path = parsed.path.rstrip("/") or "/"
        return f"{parsed.netloc.lower()}{path}".strip().lower()

    def _site_name(self, url: str) -> str:
        parsed = urlparse(url)
        return parsed.netloc.replace("www.", "") or "web"

    def _authority_score(self, url: str, title: str, site_name: str) -> float:
        lowered = f"{url} {title} {site_name}".lower()
        if any(domain in lowered for domain in self.OFFICIAL_DOMAINS):
            return 2.5
        if lowered.endswith(".gov") or lowered.endswith(".edu"):
            return 2.0
        if "docs" in lowered or "documentation" in lowered:
            return 1.5
        return 0.5

    def _freshness_score(self, title: str, content: str) -> float:
        text = f"{title} {content}".lower()
        if re.search(r"\b(202[4-9]|20[3-9][0-9])\b", text):
            return 0.6
        if any(token in text for token in ["today", "now", "latest", "recent", "breaking", "updated", "new"]):
            return 0.4
        return 0.0

    def _quality_score(self, title: str, content: str) -> float:
        text = f"{title} {content}".lower()
        if len(text) > 120:
            return 0.3
        return 0.0


class RetrievalService:
    """Fetch and extract content from ranked search results."""

    def __init__(self, extractor: WebContentExtractor | None = None) -> None:
        self._extractor = extractor or WebContentExtractor()

    async def retrieve(self, results: Sequence[SearchResult], *, concurrency: int = 4) -> list[RetrievedDocument]:
        if not results:
            return []

        async def _fetch_one(result: SearchResult) -> RetrievedDocument | None:
            try:
                async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers={"User-Agent": "AetherAI/1.0"}) as client:
                    response = await client.get(result.url)
                    response.raise_for_status()
                html = response.text
                extracted = self._extractor.extract_from_html(html, url=result.url)
                if not extracted.strip():
                    return None
                return RetrievedDocument(
                    title=result.title,
                    url=result.url,
                    content=extracted,
                    site_name=result.site_name,
                    published_date=result.published_date,
                )
            except Exception:
                return None

        semaphore = asyncio.Semaphore(concurrency)

        async def _bounded_fetch(result: SearchResult) -> RetrievedDocument | None:
            async with semaphore:
                return await _fetch_one(result)

        tasks = [asyncio.create_task(_bounded_fetch(result)) for result in results[:concurrency * 2]]
        completed = await asyncio.gather(*tasks)
        return [document for document in completed if document is not None]


class ContextBuilder:
    """Convert retrieved documents into a compact, LLM-safe context."""

    def build_context(self, documents: Sequence[RetrievedDocument], query: str) -> str:
        if not documents:
            return ""

        sections: list[str] = []
        for index, document in enumerate(documents[:5], start=1):
            summary = self._summarize(document.content)
            sections.append(
                f"{index}. {document.title}\n"
                f"Source: {document.site_name or self._site_name(document.url)}\n"
                f"URL: {document.url}\n"
                f"Summary: {summary}"
            )
        return (
            "Web-retrieved context for the user query. Use this information to answer accurately and cite the sources.\n\n"
            + "\n\n".join(sections)
        )

    def _summarize(self, text: str) -> str:
        cleaned = re.sub(r"\s+", " ", text).strip()
        if not cleaned:
            return ""
        if len(cleaned) <= 450:
            return cleaned
        sentences = re.split(r"(?<=[.!?])\s+", cleaned)
        selected: list[str] = []
        current = ""
        for sentence in sentences:
            if len(current) + len(sentence) > 420:
                break
            current = f"{current} {sentence}".strip()
            selected.append(sentence)
        return " ".join(selected)[:450].strip() + "..."

    def _site_name(self, url: str) -> str:
        parsed = urlparse(url)
        return parsed.netloc.replace("www.", "") or "web"


class CitationBuilder:
    """Render a Markdown source section for the frontend."""

    def build_markdown(self, sources: Sequence[dict[str, Any]]) -> str:
        if not sources:
            return ""
        lines = ["## Sources"]
        for index, source in enumerate(sources, start=1):
            title = str(source.get("title") or "Untitled source").strip()
            url = str(source.get("url") or "").strip()
            site_name = str(source.get("site_name") or self._site_name(url)).strip()
            published_date = source.get("published_date")
            line = f"{index}. {site_name} - {title}"
            if url:
                line = f"{line}\n[{url}]({url})"
            if published_date:
                line = f"{line}\nPublished: {published_date}"
            lines.append(line)
        return "\n\n".join(lines)

    def _site_name(self, url: str) -> str:
        parsed = urlparse(url)
        return parsed.netloc.replace("www.", "") or "web"


class WebSearchPipeline:
    """Coordinate the search, retrieval, extraction, and citation lifecycle."""

    def __init__(
        self,
        search_client: SearXNGClient | None = None,
        ranking_service: RankingService | None = None,
        retrieval_service: RetrievalService | None = None,
        context_builder: ContextBuilder | None = None,
        citation_builder: CitationBuilder | None = None,
        decision_engine: SearchDecisionEngine | None = None,
    ) -> None:
        self._decision_engine = decision_engine or SearchDecisionEngine()
        self._search_client = search_client
        self._ranking_service = ranking_service or RankingService()
        self._retrieval_service = retrieval_service or RetrievalService()
        self._context_builder = context_builder or ContextBuilder()
        self._citation_builder = citation_builder or CitationBuilder()

    async def run(self, query: str, *, limit: int = 5) -> tuple[str, list[dict[str, Any]]]:
        if not self._decision_engine.should_search(query):
            return "", []

        optimized_query = self._decision_engine.optimize_query(query)
        if not optimized_query:
            optimized_query = query

        if self._search_client is None:
            return "", []

        try:
            raw_results = await self._search_client.search(optimized_query, limit=limit)
        except Exception:
            return "Recent web information could not be retrieved reliably; answering from internal knowledge.", []

        ranked_results = self._ranking_service.rank_results(raw_results, query)
        documents = await self._retrieval_service.retrieve(ranked_results[:limit])
        if not documents:
            return "Recent web information could not be retrieved reliably; answering from internal knowledge.", []

        context = self._context_builder.build_context(documents, query)
        citations = [
            {
                "title": document.title,
                "url": document.url,
                "site_name": document.site_name,
                "published_date": document.published_date,
            }
            for document in documents
        ]
        return context, citations
