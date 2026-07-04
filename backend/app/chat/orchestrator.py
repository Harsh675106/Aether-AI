from __future__ import annotations

from collections.abc import AsyncIterator, Mapping
from dataclasses import dataclass
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
        "cricket", "football", "basketball", "tennis", "election", "stock",
        "price", "bitcoin", "crypto", "price", "rate", "exchange", "today's",
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
        self._monitoring_service = monitoring_service
        self._web_search_pipeline = web_search_pipeline or WebSearchPipeline(search_client=self._web_search_client)

    def decide(self, messages: list[dict[str, str]]) -> OrchestrationDecision:
        """Decide which augmentations to use based on the user message."""
        last_user_message = next(
            (message["content"] for message in reversed(messages) if message.get("role") == "user"),
            "",
        ).lower()
        
        use_web_search = self._search_decision_engine.should_search(last_user_message)
        if not use_web_search:
            use_web_search = any(keyword in last_user_message for keyword in ["search", "look", "find", "news"])
        
        # Check for real-time information requests
        if not use_web_search:
            use_web_search = any(keyword in last_user_message for keyword in self.REALTIME_KEYWORDS)
        
        # Check for memory-related requests
        use_memory = any(keyword in last_user_message for keyword in ["remember", "memory", "recall", "previous", "earlier"])
        
        return OrchestrationDecision(
            use_web_search=use_web_search,
            use_memory=use_memory
        )

    async def _perform_web_search(self, query: str, limit: int = 5) -> tuple[str, list[dict[str, Any]]]:
        """Perform web search and format results."""
        if not self._web_search_pipeline:
            logger.warning("Web search requested but client not configured")
            return "", []

        try:
            return await self._web_search_pipeline.run(query, limit=limit)
        except Exception as e:
            logger.error(f"web_search_failed: {e}")
            return "", []

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

        memory_context = ""
        if messages:
            memory_results = await self._memory_manager.search_semantic(messages[-1]["content"], limit=2)
            memory_context = "\n".join(item["content"] for item in memory_results if item.get("content"))
            if not memory_context and decision.use_memory:
                memory_context = ""

        # Perform web search if needed
        web_context = ""
        citations: list[dict[str, Any]] = []
        if decision.use_web_search and self._web_search_pipeline and messages:
            user_query = messages[-1]["content"]
            if self._monitoring_service is not None:
                await self._monitoring_service.publish_event(
                    event_type="activity",
                    subsystem="search",
                    severity="info",
                    category="retrieval",
                    title="Searching web",
                    description="The assistant started a web search for the latest information.",
                )
            web_context, citations = await self._perform_web_search(user_query, limit=5)

        prompt = self._prompt_builder.build(
            PromptContext(
                system_instructions=(system_prompt or "You are Aether, a helpful self-hosted AI assistant.") + "\n\nAlways respond with clean GitHub Flavored Markdown. Structure answers with concise sections, headings, bullet lists, numbered steps, tables when useful, callouts, code fences, and short paragraphs. Avoid HTML, avoid raw wall-of-text responses, and keep formatting polished, professional, and easy to read.",
                history=[*history_messages, *[ChatMessage(role=message["role"], content=message["content"]) for message in messages[:-1]]],
                user_message=messages[-1]["content"] if messages else None,
                memory_context=memory_context or None,
                web_context=web_context or None,
            )
        )
        response_parts: list[str] = []
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
            yield chunk

        if citations:
            yield self._build_sources_section(citations)

        if conversation_id and self._history_store is not None:
            self._history_store.ensure_conversation(conversation_id, title="conversation")
            self._history_store.append_message(conversation_id, "user", messages[-1]["content"] if messages else "")
            self._history_store.append_message(conversation_id, "assistant", "".join(response_parts))
