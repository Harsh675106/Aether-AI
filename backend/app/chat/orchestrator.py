from __future__ import annotations

from collections.abc import AsyncIterator, Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from app.chat.prompt_builder import PromptBuilder, PromptContext
from app.chat.schemas import ChatMessage
from app.core.interfaces import LLMProvider, MemoryManager
from app.core.logging import get_logger
from app.core.settings import Settings
from app.memory.history_store import ConversationHistoryStore
from app.memory.manager import PlaceholderMemoryManager
from app.monitoring.service import MonitoringService
from app.web.search import (
    CitationBuilder,
    ConfidenceAnalysis,
    EvidenceValidationResult,
    ResponseConfidenceAnalyzer,
    SearchDecisionEngine,
    SearXNGClient,
    WebContentExtractor,
    WebSearchPipeline,
)

logger = get_logger(__name__)


@dataclass(frozen=True)
class OrchestrationDecision:
    use_memory: bool = False
    use_web_search: bool = False
    use_tools: bool = False


class ConversationOrchestrator:
    """Select the minimal execution path for each request."""

    # Keywords that indicate questions needing real-time/current information
    REALTIME_KEYWORDS = {
        "today", "tomorrow", "now", "current", "latest", "recent", "breaking",
        "live", "this week", "this month", "schedule", "date", "time", "next",
        "upcoming", "weather", "news", "score", "result", "match", "game",
        "fixture", "series", "t20", "ipl", "world cup", "premier league", "nba",
        "epl", "cricket", "football", "basketball", "tennis", "election", "stock",
        "price", "bitcoin", "crypto", "rate", "exchange", "today's",
        "2024", "2025", "2026", "event", "conference", "release", "launch"
    }

    def __init__(
        self,
        llm_provider: LLMProvider,
        memory_manager: MemoryManager | None = None,
        settings: Settings | None = None,
        prompt_builder: PromptBuilder | None = None,
        history_store: ConversationHistoryStore | None = None,
        web_search_client: SearXNGClient | None = None,
        web_content_extractor: WebContentExtractor | None = None,
        web_search_pipeline: WebSearchPipeline | None = None,
        search_decision_engine: SearchDecisionEngine | None = None,
        monitoring_service: MonitoringService | None = None,
    ) -> None:
        self._llm_provider = llm_provider
        self._memory_manager = memory_manager or PlaceholderMemoryManager()
        self._settings = settings
        self._prompt_builder = prompt_builder or PromptBuilder()
        self._history_store = history_store
        self._web_search_client = web_search_client
        self._web_content_extractor = web_content_extractor or WebContentExtractor()
        self._search_decision_engine = search_decision_engine or SearchDecisionEngine()
        self._web_search_pipeline = web_search_pipeline or WebSearchPipeline(search_client=self._web_search_client)
        self._confidence_analyzer = ResponseConfidenceAnalyzer()
        self._monitoring_service = monitoring_service

    def decide(self, messages: list[dict[str, str]]) -> OrchestrationDecision:
        """Decide which augmentations to use based on the user message."""
        last_user_message = next(
            (message["content"] for message in reversed(messages) if message.get("role") == "user"),
            "",
        ).lower()

        classification = self._search_decision_engine.classify(last_user_message)
        use_web_search = classification.requires_search or self._search_decision_engine.should_search(last_user_message)
        if not use_web_search:
            use_web_search = any(keyword in last_user_message for keyword in ["search", "look", "find", "news"])

        if not use_web_search:
            use_web_search = any(keyword in last_user_message for keyword in self.REALTIME_KEYWORDS)

        use_memory = any(keyword in last_user_message for keyword in ["remember", "memory", "recall", "previous", "earlier"])

        return OrchestrationDecision(
            use_web_search=use_web_search,
            use_memory=use_memory,
        )

    def _is_current_datetime_query(self, query: str) -> bool:
        normalized = query.lower()
        if any(phrase in normalized for phrase in (
            "today's day and date",
            "today's date",
            "day and date today",
            "current date",
            "current time",
            "what day is it",
            "what date is it",
            "what is today's date",
        )):
            return True
        return any(term in normalized for term in ("today", "date", "day", "time")) and "india" in normalized

    def _build_current_datetime_response(self, query: str) -> str | None:
        if not self._is_current_datetime_query(query):
            return None

        normalized_query = query.lower()
        utc_now = datetime.now(timezone.utc)
        if "india" in normalized_query:
            now = utc_now + timedelta(hours=5, minutes=30)
            date_label = now.strftime("%A, %d %B %Y")
            if "time" in normalized_query:
                return f"In India, it is {now.strftime('%H:%M:%S IST')} on {date_label}."
            return f"Today in India is {date_label}."

        now = utc_now
        date_label = now.strftime("%A, %d %B %Y")
        if "time" in normalized_query:
            return f"It is {now.strftime('%H:%M:%S UTC')} on {date_label}."
        return f"Today is {date_label}."

    def _is_live_information_query(self, query: str) -> bool:
        normalized = query.lower()
        return any(term in normalized for term in (
            "today",
            "current",
            "latest",
            "recent",
            "breaking",
            "live",
            "upcoming",
            "next",
            "schedule",
            "match",
            "fixture",
            "series",
            "result",
            "score",
            "news",
            "weather",
            "date",
            "time",
            "release",
            "version",
            "price",
            "stock",
            "crypto",
            "bitcoin",
        ))

    async def _perform_web_search(self, query: str, limit: int = 5) -> tuple[str, list[dict[str, Any]], EvidenceValidationResult]:
        """Perform web search and format results with evidence validation."""
        if not self._web_search_pipeline:
            logger.warning("Web search requested but client not configured")
            return "", [], EvidenceValidationResult(supported=False, reason="web search not configured")

        try:
            if hasattr(self._web_search_pipeline, "run_with_evidence"):
                return await self._web_search_pipeline.run_with_evidence(query, limit=limit)
            context, citations = await self._web_search_pipeline.run(query, limit=limit)
            return context, citations, EvidenceValidationResult(supported=bool(context), reason="legacy pipeline fallback")
        except Exception as e:
            logger.error(f"web_search_failed: {e}")
            return "", [], EvidenceValidationResult(supported=False, reason=str(e))

    async def _evaluate_answer(self, query: str, answer: str) -> ConfidenceAnalysis:
        heuristic_analysis = self._confidence_analyzer.analyze(query, answer)
        should_run_self_evaluation = (
            heuristic_analysis.needs_web_search
            or heuristic_analysis.confidence < 60
            or self._search_decision_engine.should_search(query)
            or self._confidence_analyzer._is_factual_query(query)
        )
        if not should_run_self_evaluation:
            return heuristic_analysis

        self_evaluation_json = ""
        try:
            prompt = (
                "You are an internal confidence evaluator. "
                "Rate your confidence from 0-100. Can this answer be wrong? "
                "Does this require current information? Would web search improve accuracy? "
                "Reply only JSON: {\"confidence\": 82, \"needs_web_search\": false, \"reason\": \"...\"}"
            )
            self_evaluation_json = await self._llm_provider.complete(
                f"{prompt}\n\nUser question: {query}\nAnswer: {answer}",
                metadata={"mode": "confidence_eval"},
            )
        except Exception as exc:
            logger.warning(f"confidence_eval_failed: {exc}")

        self_evaluation: dict[str, Any] | None = None
        if self_evaluation_json:
            try:
                import json

                self_evaluation = json.loads(self_evaluation_json)
            except Exception:
                self_evaluation = None

        return self._confidence_analyzer.analyze(query, answer, self_evaluation=self_evaluation)

    def _build_fallback_prompt(self, query: str, web_context: str) -> str:
        return (
            "You are Aether answering with fresh search context. "
            "Treat the provided web context as the primary source of truth. "
            "Use it to answer the user's question directly and cite it when possible. "
            "Do not fall back to generic prior knowledge when web context is present. "
            "If the context is insufficient, say that clearly and avoid guessing.\n\n"
            f"User question: {query}\n\n"
            f"Search context:\n{web_context}"
        )

    def _build_sources_section(self, citations: list[dict[str, Any]]) -> str:
        builder = CitationBuilder()
        return builder.build_markdown(citations)

    async def stream_response(
        self,
        messages: list[dict[str, str]],
        *,
        conversation_id: str | None = None,
        system_prompt: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        top_p: float | None = None,
    ) -> AsyncIterator[str]:
        """Stream the response with optional augmentations."""
        if self._monitoring_service is not None:
            await self._monitoring_service.publish_event(
                event_type="chat.request",
                subsystem="backend",
                severity="info",
                category="conversation",
                title="Chat request received",
                description="A new conversation request is being processed.",
                correlation_id=conversation_id,
                details={"message_count": len(messages)},
            )

        # Make the orchestration decision
        decision = self.decide(messages)
        
        history_messages: list[ChatMessage] = []
        if conversation_id and self._history_store is not None:
            stored_history = self._history_store.get_conversation(conversation_id)
            if stored_history:
                history_messages.extend(
                    ChatMessage(role=message["role"], content=message["content"])
                    for message in stored_history
                )

        user_query = messages[-1]["content"] if messages else ""
        classification = self._search_decision_engine.classify(user_query)
        should_use_live_evidence = classification.requires_search or decision.use_web_search or self._is_live_information_query(user_query)

        memory_context = ""
        if messages:
            memory_results = await self._memory_manager.search_semantic(messages[-1]["content"], limit=2)
            memory_context = "\n".join(item["content"] for item in memory_results if item.get("content"))
            if not memory_context and decision.use_memory:
                memory_context = ""

        direct_response = self._build_current_datetime_response(user_query)
        if direct_response is not None:
            if conversation_id and self._history_store is not None:
                self._history_store.ensure_conversation(conversation_id, title="conversation")
                self._history_store.append_message(conversation_id, "user", user_query)
                self._history_store.append_message(conversation_id, "assistant", direct_response)
            yield direct_response
            return

        web_context = ""
        citations: list[dict[str, Any]] = []
        validation = EvidenceValidationResult(supported=False, reason="no search performed")
        if should_use_live_evidence and self._web_search_pipeline and messages:
            web_context, citations, validation = await self._perform_web_search(user_query, limit=5)

        if should_use_live_evidence and not web_context and self._web_search_pipeline:
            yield "I couldn't verify this from reliable sources."
            return

        prompt = self._prompt_builder.build(
            PromptContext(
                system_instructions=(system_prompt or "You are Aether, a helpful self-hosted AI assistant.") + "\n\nAlways respond with clean GitHub Flavored Markdown. Structure answers with concise sections, headings, bullet lists, numbered steps, tables when useful, callouts, code fences, and short paragraphs. Avoid HTML, avoid raw wall-of-text responses, and keep formatting polished, professional, and easy to read. For questions about current, recent, upcoming, or changing information, prefer the provided web context and cite sources when available.",
                history=[*history_messages, *[ChatMessage(role=message["role"], content=message["content"]) for message in messages[:-1]]],
                user_message=user_query,
                memory_context=memory_context or None,
                web_context=web_context or None,
            )
        )
        response_parts: list[str] = []
        initial_answer = ""
        async for chunk in self._llm_provider.stream_complete(
            prompt,
            metadata={
                "conversation_id": conversation_id,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "top_p": top_p,
            },
        ):
            response_parts.append(chunk)
            initial_answer = "".join(response_parts)
            yield chunk

        analysis = self._confidence_analyzer.analyze(user_query, initial_answer)
        should_use_internal_evaluation = (
            analysis.needs_web_search
            or analysis.confidence < 40
            or decision.use_web_search
            or self._search_decision_engine.should_search(user_query)
            or self._confidence_analyzer._is_factual_query(user_query)
        )
        if should_use_internal_evaluation and not should_use_live_evidence:
            analysis = await self._evaluate_answer(user_query, initial_answer)

        should_retry_with_web_context = (
            should_use_live_evidence
            or analysis.needs_web_search
            or (decision.use_web_search and not web_context and self._web_search_pipeline)
            or (analysis.confidence < 85 and self._search_decision_engine.should_search(user_query))
        )

        if should_retry_with_web_context and self._web_search_pipeline and user_query:
            fallback_context, fallback_citations, _ = await self._perform_web_search(user_query, limit=5)
            if fallback_context and fallback_citations:
                web_context = fallback_context
                citations = fallback_citations
                fallback_prompt = self._build_fallback_prompt(user_query, web_context)
                fallback_parts: list[str] = []
                async for chunk in self._llm_provider.stream_complete(
                    fallback_prompt,
                    metadata={
                        "conversation_id": conversation_id,
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                        "top_p": top_p,
                    },
                ):
                    fallback_parts.append(chunk)
                    yield chunk
                response_parts = fallback_parts

        if citations:
            yield self._build_sources_section(citations)

        if conversation_id and self._history_store is not None:
            self._history_store.ensure_conversation(conversation_id, title="conversation")
            self._history_store.append_message(conversation_id, "user", user_query)
            self._history_store.append_message(conversation_id, "assistant", "".join(response_parts))

        if self._monitoring_service is not None:
            await self._monitoring_service.publish_event(
                event_type="chat.response",
                subsystem="backend",
                severity="success",
                category="conversation",
                title="Chat response ready",
                description="The assistant response has been generated.",
                correlation_id=conversation_id,
                details={
                    "token_count": len("".join(response_parts)),
                    "confidence": analysis.confidence,
                    "needs_web_search": analysis.needs_web_search,
                    "reason": analysis.reason,
                    "semantic_score": analysis.semantic_score,
                    "freshness_score": analysis.freshness_score,
                    "entity_coverage": analysis.entity_coverage,
                    "completeness_score": analysis.completeness_score,
                    "uncertainty_score": analysis.uncertainty_score,
                    "source": "web" if should_retry_with_web_context and web_context else "ollama",
                },
            )

        if citations:
            yield self._build_sources_section(citations)

        if conversation_id and self._history_store is not None:
            self._history_store.ensure_conversation(conversation_id, title="conversation")
            self._history_store.append_message(conversation_id, "user", messages[-1]["content"] if messages else "")
            self._history_store.append_message(conversation_id, "assistant", "".join(response_parts))

        if self._monitoring_service is not None:
            await self._monitoring_service.publish_event(
                event_type="chat.response",
                subsystem="backend",
                severity="success",
                category="conversation",
                title="Chat response ready",
                description="The assistant response has been generated.",
                correlation_id=conversation_id,
                details={"token_count": len("".join(response_parts))},
            )
