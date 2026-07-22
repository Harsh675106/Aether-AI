from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from app.monitoring.service import MonitoringService


@dataclass
class PipelineMetadata:
    intent: str = "Unknown"
    memory: str = "Skipped"
    search: str = "Skipped"
    ollama: str = "Skipped"
    sources: int = 0
    latency_ms: int = 0
    confidence: int = 0
    reason: str = ""
    details: dict[str, Any] = field(default_factory=dict)


class MonitoringLogger:
    def __init__(self, service: MonitoringService | None = None) -> None:
        self._service = service

    def start_timer(self) -> float:
        return time.perf_counter()

    async def request_received(self, *, conversation_id: str | None, message_count: int) -> None:
        if self._service is None:
            return
        await self._service.publish_event(
            event_type="chat.request",
            subsystem="backend",
            severity="info",
            category="conversation",
            title="Chat request received",
            description="A new conversation request is being processed.",
            correlation_id=conversation_id,
            details={"message_count": message_count},
        )

    async def pipeline_stage(self, *, event_type: str, title: str, description: str, conversation_id: str | None, details: dict[str, Any] | None = None, status: str = 'running', severity: str = 'info') -> None:
        if self._service is None:
            return
        await self._service.publish_event(event_type=event_type, subsystem='chat', severity=severity, category='conversation', title=title, description=description, status=status, correlation_id=conversation_id, details=details)

    async def response_ready(self, *, conversation_id: str | None, metadata: PipelineMetadata) -> None:
        if self._service is None:
            return
        await self._service.publish_event(
            event_type="chat.pipeline",
            subsystem="backend",
            severity="success",
            category="conversation",
            title="Chat response ready",
            description="The assistant response has been generated.",
            correlation_id=conversation_id,
            details={
                "intent": metadata.intent,
                "memory": metadata.memory,
                "search": metadata.search,
                "ollama": metadata.ollama,
                "sources": metadata.sources,
                "latency_ms": metadata.latency_ms,
                "confidence": metadata.confidence,
                "reason": metadata.reason,
                **metadata.details,
            },
        )
