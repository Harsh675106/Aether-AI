from __future__ import annotations

import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any


from fastapi import HTTPException

from app.chat.orchestrator import ConversationOrchestrator
from app.chat.schemas import ChatCompletionChunk, ChatCompletionRequest
from app.core.logging import get_logger
from app.core.settings import Settings
from app.images.service import ImageSearchService, SearXNGImageSearchProvider
from app.llm.ollama_provider import OllamaProvider
from app.memory.history_store import ConversationHistoryStore
from app.memory.manager import PlaceholderMemoryManager
from app.monitoring.service import MonitoringService
from app.web.search import SearXNGClient, WebSearchPipeline

logger = get_logger(__name__)


@dataclass(slots=True)
class RequestContext:
    conversation_id: str | None
    user_message: str
    started_at: float = field(default_factory=time.perf_counter)

    intent: str | None = None
    requires_web: bool = False
    requires_memory: bool = False

    def latency(self) -> float:
        return round(time.perf_counter() - self.started_at, 4)


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
        image_search_service: ImageSearchService | None = None,
        planner: Any = None,
        tool_manager: Any = None,
        browser_service: Any = None,
    ) -> "ChatService":
        logger.info("initializing_chat_service")

        provider = OllamaProvider(settings)
        search_client = web_search_client or SearXNGClient(settings.searxng_base_url)
        search_pipeline = WebSearchPipeline(
            search_client=search_client,
            monitoring_service=monitoring_service,
        )
        image_search_service = image_search_service or ImageSearchService(
            provider=SearXNGImageSearchProvider(settings.searxng_base_url),
            monitoring_service=monitoring_service,
        )

        orchestrator = ConversationOrchestrator(
            llm_provider=provider,
            settings=settings,
            history_store=history_store,
            memory_manager=memory_manager,
            web_search_client=search_client,
            web_search_pipeline=search_pipeline,
            image_search_service=image_search_service,
            monitoring_service=monitoring_service,
            planner=planner,
            tool_manager=tool_manager,
            browser_service=browser_service,
        )

        return cls(orchestrator=orchestrator, monitoring_service=monitoring_service)

    async def stream_completion(
        self,
        request: ChatCompletionRequest,
    ) -> AsyncIterator[ChatCompletionChunk]:
        if not request.messages:
            raise HTTPException(status_code=400, detail="At least one message is required")

        last_message = request.messages[-1].content
        request_source = None
        if isinstance(request.user_metadata, dict):
            request_source = str(request.user_metadata.get("source") or "") or None

        context = RequestContext(conversation_id=request.conversation_id, user_message=last_message)

        logger.info(
            "chat_request_started",
            extra={
                "conversation_id": context.conversation_id,
                "message_length": len(last_message),
            },
        )

        try:
            if self.monitoring_service:
                await self.monitoring_service.track_event(
                    "chat_started",
                    {"conversation_id": context.conversation_id},
                )

            async for token in self.orchestrator.stream_response(
                [message.model_dump() for message in request.messages],
                conversation_id=request.conversation_id,
                system_prompt=request.system_prompt,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
                top_p=request.top_p,
                request_source=request_source,
            ):
                image_metadata = self.orchestrator.pop_image_search_metadata()
                yield ChatCompletionChunk(
                    delta=token,
                    conversation_id=request.conversation_id,
                    metadata={"image_search": image_metadata} if image_metadata else None,
                )

            latency = context.latency()
            logger.info(
                "chat_request_completed",
                extra={
                    "latency": latency,
                    "conversation_id": context.conversation_id,
                },
            )

            if self.monitoring_service:
                await self.monitoring_service.track_event(
                    "chat_completed",
                    {
                        "conversation_id": context.conversation_id,
                        "latency": latency,
                    },
                )

            yield ChatCompletionChunk(delta="", conversation_id=request.conversation_id, done=True)

        except ConnectionError as exc:
            logger.error("dependency_connection_failed", exc_info=exc)
            yield ChatCompletionChunk(
                delta=(
                    "Aether cannot connect to a required service. "
                    "Please check Ollama and external services."
                ),
                conversation_id=request.conversation_id,
                done=True,
            )
        except TimeoutError as exc:
            logger.error("request_timeout", exc_info=exc)
            yield ChatCompletionChunk(
                delta="Aether response timed out. Please try again.",
                conversation_id=request.conversation_id,
                done=True,
            )
        except Exception as exc:
            logger.exception("chat_completion_failed", exc_info=exc)
            yield ChatCompletionChunk(
                delta=(
                    "Aether encountered an unexpected error. "
                    "Check system logs for details."
                ),
                conversation_id=request.conversation_id,
                done=True,
            )