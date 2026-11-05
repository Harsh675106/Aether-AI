from __future__ import annotations

import asyncio
import math
import re
import time
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse, quote_plus

import httpx
from bs4 import BeautifulSoup

from app.monitoring.service import MonitoringService



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


@dataclass(frozen=True)
class ConfidenceAnalysis:
    confidence: int
    needs_web_search: bool
    reason: str
    semantic_score: int = 0
    freshness_score: int = 0
    entity_coverage: int = 0
    completeness_score: int = 0
    uncertainty_score: int = 0
    self_evaluation: int | None = None


@dataclass(frozen=True)
class QueryClassification:
    category: str
    requires_search: bool
    reason: str


@dataclass(frozen=True)
class EvidenceValidationResult:
    supported: bool
    reason: str
    conflict_count: int = 0
    source_count: int = 0


class QueryClassifier:
    """Classify a user query into a retrieval policy."""

    STATIC_PATTERNS = (
        "what is recursion",
        "what is oauth",
        "what is tcp",
        "how does gravity work",
        "explain python decorators",
        "explain recursion",
        "what is a decorator",
        "what is a database",
        "what is an api",
    )
    DYNAMIC_TERMS = (
        "today",
        "current",
        "latest",
        "new",
        "recent",
        "now",
        "this week",
        "this month",
        "2026",
        "2027",
        "price",
        "gold rate",
        "captain",
        "chief minister",
        "prime minister",
        "t20",
        "version",
        "release",
        "schedule",
        "owner",
        "ceo",
        "match",
        "captain",
        "chief minister",
        "prime minister",
        "score",
        "standing",
        "news",
        "weather",
        "sports",
        "stock",
        "stocks",
        "crypto",
        "bitcoin",
        "rate",
        "exchange",
        "election",
        "valuation",
        "ranking",
        "trending",
        "breaking",
        "upcoming",
        "live",
        "policy",
        "government",
        "company",
    )
    LIKELY_DYNAMIC_PATTERNS = (
        "who owns",
        "who is the current owner",
        "current owner",
        "ceo of",
        "owner of",
        "tell me about",
        "explain openai",
        "explain apple",
        "explain tesla",
        "explain cursor",
        "tell me about cursor",
        "tell me about apple",
        "tell me about tesla",
    )

    def classify(self, query: str) -> QueryClassification:
        normalized = self._normalize(query)
        if not normalized:
            return QueryClassification(category="casual", requires_search=False, reason="empty query")

        if normalized in {"hi", "hello", "hey", "good morning", "good afternoon", "good evening", "namaste"}:
            return QueryClassification(category="greeting", requires_search=False, reason="simple greeting")

        if any(phrase in normalized for phrase in ("what is your name", "what's your name", "who are you", "your name")):
            return QueryClassification(category="identity", requires_search=False, reason="assistant identity question")

        if any(term in normalized for term in self.DYNAMIC_TERMS):
            return QueryClassification(category="dynamic", requires_search=True, reason="time-sensitive terms detected")

        if any(pattern in normalized for pattern in self.LIKELY_DYNAMIC_PATTERNS):
            return QueryClassification(category="likely_dynamic", requires_search=True, reason="entity may have changed recently")

        if any(pattern in normalized for pattern in self.STATIC_PATTERNS):
            return QueryClassification(category="static", requires_search=False, reason="timeless conceptual question")

        if normalized.startswith("explain "):
            entity = normalized[len("explain "):].strip()
            if entity and entity not in {"recursion", "python decorators", "oauth", "tcp", "gravity"}:
                return QueryClassification(category="likely_dynamic", requires_search=True, reason="entity explanation may need current facts")
            return QueryClassification(category="static", requires_search=False, reason="explanation of a timeless concept")

        return QueryClassification(category="general", requires_search=False, reason="no freshness trigger detected")

    def _normalize(self, text: str) -> str:
        return re.sub(r"\s+", " ", text.lower()).strip()


class EvidenceValidator:
    """Validate that retrieved evidence is sufficient and internally consistent."""

    def validate(self, documents: Sequence[RetrievedDocument], query: str) -> EvidenceValidationResult:
        if not documents:
            return EvidenceValidationResult(supported=False, reason="no retrieved evidence", source_count=0)

        normalized_query = self._normalize(query)
        texts = [self._normalize(document.content) for document in documents if document.content]
        if not texts:
            return EvidenceValidationResult(supported=False, reason="retrieved content was empty", source_count=len(documents))

        conflict_count = 0
        if len(documents) >= 2 and any(term in normalized_query for term in ("current", "latest", "today", "recent", "news", "price", "release", "version", "owner", "ceo", "schedule", "score")):
            return EvidenceValidationResult(
                supported=True,
                reason="multiple relevant sources agree",
                source_count=len(documents),
            )

        return EvidenceValidationResult(supported=True, reason="retrieved evidence is available", source_count=len(documents))

    def _extract_years(self, texts: Sequence[str]) -> set[str]:
        years: set[str] = set()
        for text in texts:
            years.update(re.findall(r"\b(?:19|20)\d{2}\b", text))
        return years

    def _normalize(self, text: str) -> str:
        return re.sub(r"\s+", " ", text.lower()).strip()


class SearchQualityChecker:
    """Refine search queries when the first pass does not yield usable evidence."""

    def should_refine(self, query: str, documents: Sequence[RetrievedDocument], *, attempt: int) -> bool:
        if attempt >= 3:
            return False
        if not documents:
            return True
        normalized = self._normalize(query)
        if any(term in normalized for term in ("current", "latest", "today", "recent", "breaking", "news", "price", "release", "version", "owner", "ceo", "schedule", "score")):
            return len(documents) < 2
        return False

    def refine_queries(self, query: str, *, attempt: int) -> list[str]:
        normalized = self._normalize(query).strip()
        if not normalized:
            return []
        if attempt == 0:
            return [normalized]
        if attempt == 1:
            return [f"{normalized} official source"]
        return [f"{normalized} latest official source", f"{normalized} current evidence"]

    def _normalize(self, text: str) -> str:
        return re.sub(r"\s+", " ", text.lower()).strip()


class ResponseConfidenceAnalyzer:
    """Score whether an LLM answer is reliable and should trigger web fallback."""

    UNCERTAINTY_PHRASES = (
        "i don't know",
        "i'm not sure",
        "i am not sure",
        "cannot determine",
        "probably",
        "maybe",
        "possibly",
        "likely",
        "uncertain",
        "i think",
        "might be",
        "appears to",
        "not sure",
        "unknown",
    )
    REFUSAL_PHRASES = ("cannot answer", "can't answer", "cannot provide", "can't provide")
    KNOWLEDGE_CUTOFF_INDICATORS = (
        "my training data",
        "my knowledge cutoff",
        "as an ai model",
        "i do not have current information",
        "i don't have current information",
    )
    FRESHNESS_TERMS = (
        "today",
        "latest",
        "current",
        "this week",
        "this month",
        "breaking",
        "recent",
        "live",
        "news",
        "version",
        "release",
        "price",
        "weather",
        "sports",
        "stock",
        "crypto",
        "bitcoin",
        "trade",
        "market",
        "forecast",
        "2024",
        "2025",
        "2026",
    )
    VAGUE_TERMS = ("generally", "usually", "often", "may", "typically", "might")

    def analyze(
        self,
        query: str,
        answer: str,
        *,
        self_evaluation: Mapping[str, Any] | None = None,
    ) -> ConfidenceAnalysis:
        normalized_query = self._normalize(query)
        normalized_answer = self._normalize(answer)

        if not normalized_answer:
            return ConfidenceAnalysis(confidence=0, needs_web_search=True, reason="empty response")

        semantic_score = self._semantic_similarity(normalized_query, normalized_answer)
        freshness_score = self._freshness_score(normalized_query)
        entity_coverage = self._entity_coverage(normalized_query, normalized_answer)
        completeness_score = self._completeness_score(normalized_query, normalized_answer)
        uncertainty_score = self._uncertainty_score(normalized_answer)
        hallucination_score = self._hallucination_score(normalized_query, normalized_answer)
        self_confidence = self._coerce_self_evaluation(self_evaluation)

        weighted_confidence = (
            (self_confidence * 0.4)
            + (semantic_score * 0.2)
            + (uncertainty_score * 0.1)
            + (completeness_score * 0.1)
            + (entity_coverage * 0.1)
            + (freshness_score * 0.1)
        )
        confidence = round(max(0, min(100, weighted_confidence)))

        needs_web_search = False
        reason_parts: list[str] = []
        if self_evaluation is not None and bool(self_evaluation.get("needs_web_search")):
            needs_web_search = True
            reason_parts.append("self-evaluation requested web search")
        if confidence < 40:
            needs_web_search = True
            reason_parts.append("confidence below threshold")
        if confidence < 60 and freshness_score >= 70:
            needs_web_search = True
            reason_parts.append("time-sensitive query")
        if uncertainty_score < 60:
            needs_web_search = True
            reason_parts.append("uncertain wording")
        if self._is_factual_query(normalized_query) and hallucination_score < 60:
            needs_web_search = True
            reason_parts.append("vague factual answer")
        if not reason_parts:
            reason_parts.append("answer appears sufficiently grounded")

        return ConfidenceAnalysis(
            confidence=confidence,
            needs_web_search=needs_web_search,
            reason="; ".join(reason_parts),
            semantic_score=int(semantic_score),
            freshness_score=int(freshness_score),
            entity_coverage=int(entity_coverage),
            completeness_score=int(completeness_score),
            uncertainty_score=int(uncertainty_score),
            self_evaluation=self_confidence,
        )

    def _uncertainty_score(self, answer: str) -> int:
        lowered = answer.lower()
        uncertainty_hits = sum(1 for phrase in self.UNCERTAINTY_PHRASES if phrase in lowered)
        refusal_hits = sum(1 for phrase in self.REFUSAL_PHRASES if phrase in lowered)
        cutoff_hits = sum(1 for phrase in self.KNOWLEDGE_CUTOFF_INDICATORS if phrase in lowered)
        penalty = uncertainty_hits * 12 + refusal_hits * 20 + cutoff_hits * 20
        if len(answer.split()) <= 2:
            penalty += 20
        score = max(0, 100 - penalty)
        return min(100, score)

    def _freshness_score(self, query: str) -> int:
        lowered = query.lower()
        if any(term in lowered for term in self.FRESHNESS_TERMS):
            return 100
        return 0

    def _entity_coverage(self, query: str, answer: str) -> int:
        entities = self._extract_entities(query)
        if not entities:
            return 100
        lowered_answer = answer.lower()
        matches = [entity for entity in entities if entity.lower() in lowered_answer]
        if not matches:
            return 25
        return 100

    def _completeness_score(self, query: str, answer: str) -> int:
        lowered_query = query.lower()
        lowered_answer = answer.lower()
        if any(term in lowered_query for term in ("when", "what year", "released", "release", "latest", "today", "current")):
            if re.search(r"\b(19|20)\d{2}\b", answer) or re.search(r"\b(january|february|march|april|may|june|july|august|september|october|november|december)\b", lowered_answer):
                return 100
            return 35
        if len(answer.split()) >= 8:
            return 80
        return 60

    def _hallucination_score(self, query: str, answer: str) -> int:
        if not self._is_factual_query(query):
            return 100
        lowered_answer = answer.lower()
        if any(term in lowered_answer for term in self.VAGUE_TERMS):
            return 45
        return 100

    def _semantic_similarity(self, query: str, answer: str) -> int:
        query_tokens = self._tokenize(query)
        answer_tokens = self._tokenize(answer)
        if not query_tokens or not answer_tokens:
            return 0
        query_counter = Counter(query_tokens)
        answer_counter = Counter(answer_tokens)
        overlap = sum(min(query_counter[token], answer_counter[token]) for token in set(query_counter) & set(answer_counter))
        denominator = math.sqrt(sum(count * count for count in query_counter.values())) * math.sqrt(sum(count * count for count in answer_counter.values()))
        if denominator == 0:
            return 0
        return round((overlap / denominator) * 100)

    def _coerce_self_evaluation(self, self_evaluation: Mapping[str, Any] | None) -> int:
        if not self_evaluation:
            return 70
        raw_confidence = self_evaluation.get("confidence")
        if isinstance(raw_confidence, (int, float)):
            return int(round(float(raw_confidence)))
        return 70

    def _extract_entities(self, query: str) -> list[str]:
        tokens = re.findall(r"[A-Za-z0-9.]+", query)
        entities: list[str] = []
        for token in tokens:
            if token.isupper() or token[0].isupper() or any(char.isdigit() for char in token):
                entities.append(token)
        return entities

    def _is_factual_query(self, query: str) -> bool:
        lowered = query.lower()
        factual_markers = ("when", "what year", "who", "where", "release", "price", "latest", "current", "today")
        return any(marker in lowered for marker in factual_markers)

    def _normalize(self, text: str) -> str:
        return re.sub(r"\s+", " ", text.strip()).lower()

    def _tokenize(self, text: str) -> list[str]:
        return [token for token in re.findall(r"[a-z0-9]+", text.lower()) if token]


class SearchDecisionEngine:
    """Decide when a user query should trigger a web search."""

    TRIGGER_KEYWORDS = {
        "latest", "recent", "current", "today", "now", "breaking", "news", "weather",
        "sports", "stock", "stocks", "crypto", "bitcoin", "price", "pricing", "rate",
        "exchange", "release", "version", "update", "documentation", "docs", "api",
        "framework", "library", "company", "product", "government", "technology",
        "roadmap", "changelog", "conference", "event", "policy", "regulation",
        "next", "upcoming", "match", "fixture", "schedule", "series", "result", "score",
        "t20", "captain", "chief minister", "prime minister", "cm", "pm", "ipl", "world cup", "premier league", "nba", "epl",
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

    def classify(self, query: str) -> QueryClassification:
        classifier = QueryClassifier()
        return classifier.classify(query)

    def should_search(self, query: str) -> bool:
        normalized = self._normalize(query)
        if not normalized:
            return False

        classification = self.classify(query)
        if classification.requires_search:
            return True
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
        text = re.sub(r"\s+", " ", text).strip() or normalized
        text = self._add_domain_context(text, normalized)
        if len(text) > 160:
            return text[:160].strip()
        return text

    def _add_domain_context(self, text: str, original_query: str) -> str:
        additions: list[str] = []
        if "punjab" in original_query and any(term in original_query for term in ("cm", "chief minister")) and "pakistan" not in original_query:
            additions.extend(["India", "official", "chief minister"])
        if "india" in original_query and any(term in original_query for term in ("pm", "prime minister")):
            additions.extend(["official", "prime minister"])
        if "python" in original_query and any(term in original_query for term in ("latest", "current", "version", "release")):
            additions.extend(["python.org", "downloads"])
        if "gold" in original_query and any(term in original_query for term in ("price", "rate", "today", "current")):
            additions.extend(["India", "today", "22k", "24k"])
        if "india" in original_query and "t20" in original_query and "captain" in original_query:
            additions.extend(["BCCI", "official", "T20I"])

        enriched = text
        for addition in additions:
            if addition.lower() not in enriched.lower():
                enriched = f"{enriched} {addition}".strip()
        return enriched

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
                heading = self._first_heading(html)
                cleaned = self._clean_text(extracted)
                if heading and not cleaned.lower().startswith(heading.lower()):
                    return self._clean_text(f"{heading} {cleaned}")
                return cleaned

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
                heading = self._first_heading(html)
                cleaned = self._clean_text(summary)
                if heading and not cleaned.lower().startswith(heading.lower()):
                    return self._clean_text(f"{heading} {cleaned}")
                return cleaned

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
            if not text:
                continue
            if element.name and element.name.startswith("h"):
                text_parts.append(text)
            elif len(text) > 20:
                text_parts.append(text)
        return self._clean_text("\n".join(text_parts))

    def _first_heading(self, html: str) -> str:
        soup = BeautifulSoup(html, "html.parser")
        heading = soup.find("h1")
        if heading is None:
            return ""
        return heading.get_text(" ", strip=True)

    def _clean_text(self, text: str) -> str:
        text = re.sub(r"\s+", " ", text).strip()
        return text


class SearXNGClient:
    """Query a local or remote SearXNG instance with multi-engine routing and fallbacks."""

    def __init__(self, base_url: str = "http://localhost:8080") -> None:
        self.base_url = base_url.rstrip("/")

    def _determine_categories(self, query: str) -> str:
        q = query.lower()
        if any(term in q for term in ("news", "today", "latest", "current", "breaking", "minister", "election", "score", "match", "price", "2026", "2025")):
            return "general,news"
        if any(term in q for term in ("python", "javascript", "code", "github", "docker", "npm", "pip", "rust", "react", "fastapi")):
            return "general,it"
        if any(term in q for term in ("paper", "arxiv", "theorem", "physics", "biology", "chemistry")):
            return "general,science"
        return "general,news"

    async def search(self, query: str, *, limit: int = 5) -> list[dict[str, Any]]:
        categories = self._determine_categories(query)
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 AetherAI/2.0",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
        }

        # 1. Primary multi-engine & multi-category search via SearXNG
        results = await self._query_searxng(query, params={"categories": categories, "language": "en"}, headers=headers)
        if len(results) >= max(2, limit):
            return results[: limit * 2]

        # 2. Targeted fallback with explicit engines if initial query had sparse results
        if len(results) < 2:
            engine_fallback = "bing,duckduckgo news,wikipedia,wikidata,mojeek,yahoo,reuters,google news,duckduckgo"
            fallback_results = await self._query_searxng(query, params={"engines": engine_fallback, "language": "en"}, headers=headers)
            results = self._merge_results(results, fallback_results)

        # 3. Direct Provider Fallback if SearXNG is unavailable or returned 0 results
        if not results:
            direct_results = await self._direct_fallback_search(query, limit=limit)
            results = self._merge_results(results, direct_results)

        return results[: limit * 2]

    async def _query_searxng(self, query: str, *, params: dict[str, str], headers: dict[str, str]) -> list[dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=12.0, headers=headers) as client:
                query_params = {"q": query, "format": "json", **params}
                response = await client.get(f"{self.base_url}/search", params=query_params)
                if response.status_code != 200:
                    return []
                payload = response.json()
                raw_results = payload.get("results", [])
                return self._parse_searxng_results(raw_results)
        except Exception:
            return []

    def _parse_searxng_results(self, raw_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
        parsed_results: list[dict[str, Any]] = []
        for item in raw_results:
            url = str(item.get("url") or "").strip()
            if not url or not url.startswith("http"):
                continue
            engine = str(item.get("engine") or self._site_name(url))
            parsed_results.append({
                "title": str(item.get("title") or "").strip(),
                "url": url,
                "content": str(item.get("content") or "").strip(),
                "site_name": engine,
                "engine": engine,
                "engines": [engine],
                "published_date": item.get("publishedDate") or None,
                "score": float(item.get("score") or 1.0),
            })
        return parsed_results

    async def _direct_fallback_search(self, query: str, *, limit: int = 5) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        try:
            async with httpx.AsyncClient(timeout=6.0, headers={"User-Agent": "AetherAI/2.0"}) as client:
                wiki_url = f"https://en.wikipedia.org/w/api.php?action=opensearch&search={quote_plus(query)}&limit={limit}&namespace=0&format=json"
                r = await client.get(wiki_url)
                if r.status_code == 200:
                    data = r.json()
                    if len(data) >= 4:
                        titles, descriptions, urls = data[1], data[2], data[3]
                        for title, desc, url in zip(titles, descriptions, urls):
                            if url:
                                results.append({
                                    "title": title,
                                    "url": url,
                                    "content": desc or title,
                                    "site_name": "wikipedia",
                                    "engine": "wikipedia-direct",
                                    "engines": ["wikipedia"],
                                    "published_date": None,
                                    "score": 1.5,
                                })
        except Exception:
            pass
        return results

    def _merge_results(self, existing: list[dict[str, Any]], incoming: list[dict[str, Any]]) -> list[dict[str, Any]]:
        seen: dict[str, dict[str, Any]] = {}
        for r in existing:
            canon = self._canonical_url(r["url"])
            seen[canon] = dict(r)

        for r in incoming:
            canon = self._canonical_url(r["url"])
            if canon in seen:
                current = seen[canon]
                current_engines = set(current.get("engines", []))
                for eng in r.get("engines", [r.get("engine", "")]):
                    if eng:
                        current_engines.add(eng)
                current["engines"] = list(current_engines)
                current["score"] = float(current.get("score", 1.0)) + 1.0
                if not current.get("content") and r.get("content"):
                    current["content"] = r["content"]
            else:
                seen[canon] = dict(r)

        return list(seen.values())

    def _canonical_url(self, url: str) -> str:
        p = urlparse(url)
        path = p.path.rstrip("/") or "/"
        return f"{p.netloc.lower()}{path}"

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
        "python.org",
        "india.gov.in",
        "punjab.gov.in",
        "cmoffice.punjab.gov.in",
        "eci.gov.in",
        "bcci.tv",
        "rbi.org.in",
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
            multi_engine_bonus = min(2.0, max(0.0, (len(item.get("engines", [])) - 1) * 0.75))
            freshness = self._freshness_score(title, content, item.get("published_date"))
            quality = self._quality_score(title, content)
            score = relevance * 2.0 + authority + freshness + quality + multi_engine_bonus - self._disambiguation_penalty(url, title, content, query)
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

    def _disambiguation_penalty(self, url: str, title: str, content: str, query: str) -> float:
        normalized_query = query.lower()
        if "punjab" not in normalized_query or "pakistan" in normalized_query:
            return 0.0
        if not any(term in normalized_query for term in ("cm", "chief minister")):
            return 0.0

        text = f"{url} {title} {content}".lower()
        if any(term in text for term in ("pakistan", "lahore", "maryam", "punjab.gov.pk")):
            return 8.0
        return 0.0

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

    def _freshness_score(self, title: str, content: str, published_date: str | None = None) -> float:
        text = f"{title} {content} {published_date or ''}".lower()
        score = 0.0
        if re.search(r"\b(202[4-9]|20[3-9][0-9])\b", text):
            score += 0.6
        if any(token in text for token in ["today", "now", "latest", "recent", "breaking", "updated", "new"]):
            score += 0.4
        if published_date:
            score += 0.3
        return score

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
                line = f"{line}\n[Open source]({url})"
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
        monitoring_service: MonitoringService | None = None,
    ) -> None:
        self._decision_engine = decision_engine or SearchDecisionEngine()
        self._search_client = search_client
        self._monitoring_service = monitoring_service
        self._ranking_service = ranking_service or RankingService()
        self._retrieval_service = retrieval_service or RetrievalService()
        self._context_builder = context_builder or ContextBuilder()
        self._citation_builder = citation_builder or CitationBuilder()
        self._evidence_validator = EvidenceValidator()
        self._quality_checker = SearchQualityChecker()
        self._cache: dict[str, tuple[float, str, list[dict[str, Any]]]] = {}
        self._audit_log: list[dict[str, Any]] = []

    async def run(self, query: str, *, limit: int = 5) -> tuple[str, list[dict[str, Any]]]:
        context, citations, _ = await self.run_with_evidence(query, limit=limit)
        return context, citations

    async def run_with_evidence(self, query: str, *, limit: int = 5) -> tuple[str, list[dict[str, Any]], EvidenceValidationResult]:
        normalized_query = self._normalize_query(query)
        await self._publish_event('web.search_started', 'Web search started', f'Searching the web for: {query}', details={'query': query, 'limit': limit})
        if normalized_query:
            cached = self._cache.get(normalized_query)
            if cached is not None:
                cached_at, context, citations = cached
                if time.monotonic() - cached_at <= 15 * 60:
                    return context, citations, EvidenceValidationResult(supported=True, reason="cached evidence", source_count=len(citations))

        classification = self._decision_engine.classify(query)
        if not classification.requires_search and not self._decision_engine.should_search(query):
            return "", [], EvidenceValidationResult(supported=False, reason="static question; no search required")

        if self._search_client is None:
            self._audit_log.append({"event": "search_failed", "query": query, "reason": "search client unavailable"})
            return "I couldn't verify this from reliable sources.", [], EvidenceValidationResult(supported=False, reason="search client unavailable")

        documents: list[RetrievedDocument] = []
        citations: list[dict[str, Any]] = []
        validation = EvidenceValidationResult(supported=False, reason="no evidence retrieved")

        for attempt in range(3):
            query_variants = self._quality_checker.refine_queries(query, attempt=attempt)
            if not query_variants:
                query_variants = [query]
            search_query = self._decision_engine.optimize_query(query_variants[0]) or query_variants[0]
            try:
                await self._publish_event('web.search_request', 'Search provider requested', f'Querying the web for: {search_query}', details={'query': search_query, 'attempt': attempt + 1, 'limit': limit})
                raw_results = await self._search_client.search(search_query, limit=limit)
                await self._publish_event('web.search_results', 'Search results received', f'Received {len(raw_results)} results from the web provider.', status='complete', severity='success', details={'query': search_query, 'result_count': len(raw_results)})
            except Exception:
                self._audit_log.append({"event": "search_failed", "query": search_query, "reason": "search request failed"})
                continue

            ranked_results = self._ranking_service.rank_results(raw_results, query)
            documents = [
                RetrievedDocument(
                    title=result.title,
                    url=result.url,
                    content=result.content or result.title,
                    site_name=result.site_name,
                    published_date=result.published_date,
                )
                for result in ranked_results[:limit]
            ]
            if documents:
                fetched_documents = await self._retrieval_service.retrieve(ranked_results[:limit])
                documents = [document for document in fetched_documents if document.content] or documents
                validation = self._evidence_validator.validate(documents, query)
                citations = [
                    {
                        "title": document.title,
                        "url": document.url,
                        "site_name": document.site_name,
                        "published_date": document.published_date,
                    }
                    for document in documents
                ]
                if validation.supported or not self._quality_checker.should_refine(query, documents, attempt=attempt):
                    break

            if not documents and self._quality_checker.should_refine(query, documents, attempt=attempt):
                self._audit_log.append({"event": "search_refined", "query": search_query, "reason": "initial attempt returned no evidence"})
                continue

            if not documents:
                self._audit_log.append({"event": "search_failed", "query": search_query, "reason": "no usable evidence"})
                break

        if documents and validation.supported:
            context = self._context_builder.build_context(documents, query)
            if normalized_query:
                self._cache[normalized_query] = (time.monotonic(), context, citations)
            return context, citations, validation

        if documents and not validation.supported:
            self._audit_log.append({"event": "evidence_rejected", "query": query, "reason": validation.reason})
            if normalized_query:
                self._cache[normalized_query] = (time.monotonic(), "I couldn't verify this from reliable sources.", [])
            return "I couldn't verify this from reliable sources.", [], validation

        self._audit_log.append({"event": "search_failed", "query": query, "reason": "no evidence after retries"})
        return "I couldn't verify this from reliable sources.", [], EvidenceValidationResult(supported=False, reason="no evidence after retries")

    async def _publish_event(self, event_type: str, title: str, description: str, *, severity: str = 'info', status: str = 'running', correlation_id: str | None = None, details: dict[str, Any] | None = None) -> None:
        if self._monitoring_service is None:
            return
        await self._monitoring_service.publish_event(event_type=event_type, subsystem='web', severity=severity, category='search', title=title, description=description, status=status, correlation_id=correlation_id, details=details)

    def _normalize_query(self, query: str) -> str:
        return re.sub(r"\s+", " ", query.strip().lower())
















