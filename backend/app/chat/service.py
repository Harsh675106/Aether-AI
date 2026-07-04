from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass

from fastapi import HTTPException

from app.chat.orchestrator import ConversationOrchestrator
from app.chat.schemas import ChatCompletionChunk, ChatCompletionRequest
from app.core.logging import get_logger
from app.core.settings import Settings
from app.llm.ollama_provider import OllamaProvider
from app.memory.history_store import ConversationHistoryStore
from app.memory.manager import PlaceholderMemoryManager
from app.monitoring.service import MonitoringService
from app.web.search import SearXNGClient, WebSearchPipeline

logger = get_logger(__name__)


@dataclass
class ChatService:
    orchestrator: ConversationOrchestrator
    monitoring_service: MonitoringService | None = None

    @classmethod
    def from_settings(
        cls,
        settings: Settings,
        *,
        history_store: ConversationHistoryStore | None = None,
        memory_manager: PlaceholderMemoryManager | None = None,
        web_search_client: SearXNGClient | None = None,
        monitoring_service: MonitoringService | None = None,
    ) -> "ChatService":
        provider = OllamaProvider(settings)
        client = web_search_client or SearXNGClient(settings.searxng_base_url)
        pipeline = WebSearchPipeline(search_client=client)
        orchestrator = ConversationOrchestrator(
            llm_provider=provider,
            settings=settings,
            history_store=history_store,
            memory_manager=memory_manager,
            web_search_client=client,
            web_search_pipeline=pipeline,
            monitoring_service=monitoring_service,
        )
        return cls(orchestrator=orchestrator, monitoring_service=monitoring_service)

    async def stream_completion(
        self,
        request: ChatCompletionRequest,
    ) -> AsyncIterator[ChatCompletionChunk]:
        if not request.messages:
            raise HTTPException(status_code=400, detail="At least one message is required")

        try:
            async for token in self.orchestrator.stream_response(
                [message.model_dump() for message in request.messages],
                conversation_id=request.conversation_id,
                system_prompt=request.system_prompt,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
                top_p=request.top_p,
            ):
                yield ChatCompletionChunk(delta=token, conversation_id=request.conversation_id)
            yield ChatCompletionChunk(delta="", conversation_id=request.conversation_id, done=True)
        except Exception as exc:  # pragma: no cover - defensive guard
            logger.exception("chat_completion_failed", exc_info=exc)
            yield ChatCompletionChunk(
                delta="Aether is currently unavailable; please ensure Ollama is running.",
                conversation_id=request.conversation_id,
                done=True,
            )
