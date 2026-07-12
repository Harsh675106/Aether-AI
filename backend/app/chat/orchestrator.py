from __future__ import annotations

import re
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from app.chat.intent import IntentCategory, IntentClassifier
from app.chat.memory_manager import RelevantMemoryManager
from app.chat.monitoring_logger import MonitoringLogger, PipelineMetadata
from app.chat.response_generator import GenerationContext, ResponseGenerator
from app.chat.routing import RoutingDecision, RoutingEngine
from app.chat.schemas import ChatMessage
from app.core.interfaces import LLMProvider, MemoryManager
from app.core.logging import get_logger
from app.core.settings import Settings
from app.memory.history_store import ConversationHistoryStore
from app.memory.manager import PlaceholderMemoryManager
from app.monitoring.service import MonitoringService
from app.chat.confidence import ResponseConfidenceAnalyzer
from app.web.search import (
    CitationBuilder,
    EvidenceValidationResult,
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


class FallbackManager:
    """Gracefully degrade when optional backend components fail."""

    async def search_with_retry(
        self,
        pipeline: WebSearchPipeline | None,
        query: str,
        *,
        limit: int = 5,
    ) -> tuple[str, list[dict[str, Any]], EvidenceValidationResult]:
        if pipeline is None:
            return (
                "",
                [],
                EvidenceValidationResult(supported=False, reason="web search not configured"),
            )

        last_error = "search failed"
        for _ in range(2):
            try:
                if hasattr(pipeline, "run_with_evidence"):
                    return await pipeline.run_with_evidence(query, limit=limit)
                context, citations = await pipeline.run(query, limit=limit)
                return (
                    context,
                    citations,
                    EvidenceValidationResult(
                        supported=bool(context),
                        reason="legacy pipeline fallback",
                        source_count=len(citations),
                    ),
                )
            except Exception as exc:  # pragma: no cover - defensive guard
                last_error = str(exc)
                logger.warning("web_search_attempt_failed", exc_info=exc)
        return "", [], EvidenceValidationResult(supported=False, reason=last_error)


class ConversationOrchestrator:
    """Intent-first orchestration for memory, web search, and Ollama."""

    def __init__(
        self,
        llm_provider: LLMProvider,
        memory_manager: MemoryManager | None = None,
        settings: Settings | None = None,
        prompt_builder: object | None = None,
        history_store: ConversationHistoryStore | None = None,
        web_search_client: SearXNGClient | None = None,
        web_content_extractor: WebContentExtractor | None = None,
        web_search_pipeline: WebSearchPipeline | None = None,
        search_decision_engine: object | None = None,
        monitoring_service: MonitoringService | None = None,
        confidence_threshold: float = 0.55,
        max_history_messages: int = 20,
    ) -> None:
        self._llm_provider = llm_provider
        self._memory_manager = memory_manager or PlaceholderMemoryManager()
        self._settings = settings
        self._history_store = history_store
        self._web_search_client = web_search_client
        self._web_content_extractor = web_content_extractor or WebContentExtractor()
        self._web_search_pipeline = web_search_pipeline or WebSearchPipeline(
            search_client=self._web_search_client
        )
        self._monitoring_service = monitoring_service
        self._confidence_analyzer = ResponseConfidenceAnalyzer()

        self._intent_classifier = IntentClassifier()
        self._routing_engine = RoutingEngine()
        self._relevant_memory = RelevantMemoryManager(self._memory_manager)
        self._response_generator = ResponseGenerator(llm_provider, prompt_builder=prompt_builder)  # type: ignore[arg-type]
        self._fallback_manager = FallbackManager()
        self._monitoring_logger = MonitoringLogger(monitoring_service)
        self._citation_builder = CitationBuilder()
        self._confidence_threshold = confidence_threshold
        self._max_history_messages = max_history_messages

    def decide(self, messages: list[dict[str, str]]) -> OrchestrationDecision:
        """Compatibility shim for existing tests and callers."""
        user_query = self._last_user_message(messages)
        has_history = len(messages) > 1
        intent = self._intent_classifier.classify(user_query, has_history=has_history)
        decision = self._routing_engine.decide(intent)
        return OrchestrationDecision(
            use_memory=decision.use_memory, use_web_search=decision.use_search
        )

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
        started_at = self._monitoring_logger.start_timer()
        await self._monitoring_logger.request_received(
            conversation_id=conversation_id, message_count=len(messages)
        )

        user_query = self._last_user_message(messages)
        history_messages = self._load_history(messages, conversation_id)
        intent = self._intent_classifier.classify(user_query, has_history=bool(history_messages))
        decision = self._routing_engine.decide(intent)
        metadata = PipelineMetadata(
            intent=intent.category.value,
            memory="Skipped",
            search="Skipped",
            ollama="Skipped",
            confidence=decision.confidence,
            reason=decision.reason,
        )

        metadata.details["routing_confidence"] = decision.confidence

        response_parts: list[str] = []
        citations: list[dict[str, Any]] = []

        try:
            direct_response = self._direct_response(intent.category, user_query)
            if direct_response is not None:
                response_parts.append(direct_response)
                yield direct_response
                await self._monitoring_logger.response_ready(
                    conversation_id=conversation_id,
                    metadata=metadata,
                )
                return

            memory_result = await self._relevant_memory.retrieve(
                user_query, enabled=decision.use_memory, limit=5
            )
            metadata.memory = (
                f"Used ({memory_result.result_count})"
                if memory_result.used
                else f"Skipped ({memory_result.skipped_reason})"
            )

            web_context = ""
            if decision.use_search:
                web_context, citations, validation = await self._fallback_manager.search_with_retry(
                    self._web_search_pipeline,
                    self._resolve_follow_up_query(user_query, history_messages, decision),
                    limit=5,
                )
                metadata.search = "Used" if web_context else f"Failed ({validation.reason})"
                metadata.sources = self._unique_source_count(citations)
                metadata.details["search_validation"] = validation.reason
            else:
                validation = EvidenceValidationResult(
                    supported=False, reason="search skipped by router"
                )

            if decision.use_search and not validation.supported:
                fallback = "I could not verify this from reliable current sources, so I won't guess. Please try again when search is available or ask for a non-current explanation."
                response_parts.append(fallback)
                yield fallback
                return

            metadata.ollama = "Used" if decision.use_ollama else "Skipped"
            if decision.use_ollama:
                generated_chunks: list[str] = []
                async for chunk in self._response_generator.stream(
                    GenerationContext(
                        user_query=user_query,
                        history=history_messages,
                        memory_context=memory_result.context or None,
                        web_context=web_context or None,
                        system_prompt=system_prompt,
                        metadata={
                            "conversation_id": conversation_id,
                            "temperature": temperature,
                            "max_tokens": max_tokens,
                            "top_p": top_p,
                            "intent": intent.category.value,
                            "route": {
                                "memory": decision.use_memory,
                                "search": decision.use_search,
                                "ollama": decision.use_ollama,
                            },
                        },
                    )
                ):
                    generated_chunks.append(chunk)
                    response_parts.append(chunk)
                    yield chunk

                # Validate generated response confidence
                generated_response = "".join(generated_chunks).strip()
                if not generated_response:
                    logger.warning(
                        "empty_llm_response"
                    )
                    fallback_message = (
                        "I was unable to generate a response. Please try again."
                    )
                    response_parts.append(fallback_message)

                    yield fallback_message
                    return

                confidence = self._confidence_analyzer.analyze(
                    generated_response,
                    query=user_query,
                    citations=len(citations),
                )
                metadata.details.update(
                    {
                        "response_confidence": confidence.score,
                        "confidence_reason": confidence.reason,
                        "response_length": len(generated_response),
                    }
                )

                # Trigger fallback when Ollama response quality is low
                if confidence.should_retry and not decision.use_search:
                    logger.info(
                        "low_confidence_response_detected",
                        extra={
                            "confidence": confidence.score,
                            "reason": confidence.reason,
                        },
                    )
                    response_parts.clear()
                    retry_context, retry_citations, retry_validation = (
                        await self._fallback_manager.search_with_retry(
                            self._web_search_pipeline,
                            user_query,
                            limit=5,
                        )
                    )

                    if retry_validation.supported:

                        metadata.search = "Triggered by low confidence"
                        citations.extend(retry_citations)
                        async for retry_chunk in self._response_generator.stream(
                            GenerationContext(
                                user_query=user_query,
                                history=history_messages,
                                memory_context=memory_result.context or None,
                                web_context=retry_context,
                                system_prompt=system_prompt,
                                metadata={
                                    "conversation_id": conversation_id,
                                    "intent": intent.category.value,
                                    "reason": "confidence_fallback",
                                },
                            )
                        ):
                            response_parts.append(retry_chunk)
                            yield retry_chunk

            unique_citations = self._deduplicate_citations(citations)
            if unique_citations:
                sources_section = self._citation_builder.build_markdown(unique_citations)
                if sources_section:
                    response_parts.append(sources_section)
                    yield sources_section

        except Exception as exc:  # pragma: no cover - defensive guard
            logger.exception("conversation_orchestration_failed", exc_info=exc)
            fallback = "Aether hit a backend error while generating the response. Please try again."
            response_parts = [fallback]
            yield fallback
        finally:
            full_response = "".join(response_parts)
            self._persist_conversation(conversation_id, user_query, full_response)
            metadata.latency_ms = int((time.perf_counter() - started_at) * 1000)
            metadata.sources = self._unique_source_count(citations)
            await self._monitoring_logger.response_ready(
                conversation_id=conversation_id, metadata=metadata
            )

    def _direct_response(self, category: IntentCategory, query: str) -> str | None:
        if category == IntentCategory.GREETING:
            return "Hello! How can I help you today?"
        if category == IntentCategory.IDENTITY_QUESTION:
            return "I'm Aether, your self-hosted AI assistant."
        return self._build_current_datetime_response(query)

    def _last_user_message(self, messages: list[dict[str, str]]) -> str:
        return next(
            (
                message.get("content", "")
                for message in reversed(messages)
                if message.get("role") == "user"
            ),
            "",
        )

    def _load_history(
        self, messages: list[dict[str, str]], conversation_id: str | None
    ) -> list[ChatMessage]:
        history: list[ChatMessage] = []
        if conversation_id and self._history_store is not None:
            stored_history = self._history_store.get_conversation(conversation_id) or []
            history.extend(
                ChatMessage(role=message["role"], content=message["content"])
                for message in stored_history
            )

        inline_history = [
            message
            for message in messages[:-1]
            if message.get("role") in {"system", "user", "assistant", "tool"}
        ]
        history.extend(
            ChatMessage(role=message["role"], content=message["content"])
            for message in inline_history
        )
        return history[-self._max_history_messages:]

    def _resolve_follow_up_query(
        self, query: str, history: list[ChatMessage], decision: RoutingDecision
    ) -> str:
        if decision.intent.category != IntentCategory.FOLLOW_UP_QUESTION or not history:
            return query
        recent = " ".join(
            message.content for message in history[-4:] if message.role in {"user", "assistant"}
        )
        return f"{recent}\nFollow-up question: {query}"

    def _persist_conversation(
        self, conversation_id: str | None, user_query: str, assistant_response: str
    ) -> None:
        if not conversation_id or self._history_store is None or not user_query:
            return
        self._history_store.ensure_conversation(conversation_id, title="conversation")
        self._history_store.append_message(conversation_id, "user", user_query)
        self._history_store.append_message(conversation_id, "assistant", assistant_response)

    def _deduplicate_citations(self, citations: list[dict[str, Any]]) -> list[dict[str, Any]]:
        seen: set[str] = set()
        unique: list[dict[str, Any]] = []
        for citation in citations:
            url = str(citation.get("url") or "").strip().rstrip("/").lower()
            title = str(citation.get("title") or "").strip().lower()
            key = url or title
            if not key or key in seen:
                continue
            seen.add(key)
            unique.append(citation)
        return unique

    def _unique_source_count(self, citations: list[dict[str, Any]]) -> int:
        return len(self._deduplicate_citations(citations))

    def _is_current_datetime_query(self, query: str) -> bool:
        normalized = query.lower()
        date_phrases = (
            "today's day and date",
            "today's date",
            "tomorrow's date",
            "tomorrow date",
            "yesterday's date",
            "yesterday date",
            "day and date today",
            "current date",
            "current time",
            "what day is it",
            "what date is it",
            "what is today's date",
            "what is tomorrow's date",
            "what is yesterday's date",
        )
        if any(phrase in normalized for phrase in date_phrases):
            return True
        has_calendar_word = re.search(r"\b(date|day|time)\b", normalized) is not None
        return has_calendar_word and any(
            marker in normalized
            for marker in ("india", "ist", "current", "now", "today", "tomorrow", "yesterday")
        )

    def _build_current_datetime_response(self, query: str) -> str | None:
        if not self._is_current_datetime_query(query):
            return None

        normalized_query = query.lower()
        use_india_time = "india" in normalized_query or "ist" in normalized_query
        now = datetime.now(timezone.utc)
        if use_india_time:
            now = now + timedelta(hours=5, minutes=30)

        offset_days = 0
        label = "Today"
        if "tomorrow" in normalized_query:
            offset_days = 1
            label = "Tomorrow"
        elif "yesterday" in normalized_query:
            offset_days = -1
            label = "Yesterday"

        target = now + timedelta(days=offset_days)
        date_label = target.strftime("%A, %d %B %Y")
        zone_label = " in India" if use_india_time else ""

        if "time" in normalized_query and offset_days == 0:
            suffix = "IST" if use_india_time else "UTC"
            prefix = "In India, it" if use_india_time else "It"
            return f"{prefix} is {target.strftime('%H:%M:%S')} {suffix} on {date_label}."

        return f"{label}{zone_label} is {date_label}."
