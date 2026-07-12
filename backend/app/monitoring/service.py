from __future__ import annotations

import asyncio
import logging
import time
import uuid
from collections import deque
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class MonitoringEvent:
    event_id: str
    event_type: str
    subsystem: str
    severity: str
    category: str
    title: str
    description: str
    status: str = "running"
    timestamp: float = field(default_factory=lambda: time.time() * 1000)
    correlation_id: str | None = None
    details: dict[str, Any] | None = None
    duration_ms: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "subsystem": self.subsystem,
            "severity": self.severity,
            "category": self.category,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "timestamp": self.timestamp,
            "correlation_id": self.correlation_id,
            "details": self.details or {},
            "duration_ms": self.duration_ms,
        }


class MonitoringService:
    """Central event bus for backend monitoring and telemetry."""

    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        self._events: deque[dict[str, Any]] = deque(maxlen=200)
        self._lock = asyncio.Lock()

    async def publish_event(
        self,
        *,
        event_type: str,
        subsystem: str,
        severity: str,
        category: str,
        title: str,
        description: str,
        status: str = "running",
        correlation_id: str | None = None,
        details: dict[str, Any] | None = None,
        duration_ms: int | None = None,
    ) -> dict[str, Any]:
        event = MonitoringEvent(
            event_id=str(uuid.uuid4()),
            event_type=event_type,
            subsystem=subsystem,
            severity=severity,
            category=category,
            title=title,
            description=description,
            status=status,
            correlation_id=correlation_id,
            details=details,
            duration_ms=duration_ms,
        )
        payload = event.to_dict()
        self._events.append(payload)

        async with self._lock:
            dead: list[asyncio.Queue[dict[str, Any]]] = []
            for queue in list(self._subscribers):
                try:
                    queue.put_nowait(payload)
                except asyncio.QueueFull:
                    dead.append(queue)
            for queue in dead:
                self._subscribers.discard(queue)
        return payload

    async def publish_log(
        self,
        *,
        message: str,
        subsystem: str = "backend",
        severity: str = "info",
        category: str = "terminal",
        title: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return await self.publish_event(
            event_type="log",
            subsystem=subsystem,
            severity=severity,
            category=category,
            title=title or "Backend activity",
            description=message,
            details=details,
        )

    async def track_event(
        self,
        event_type: str,
        details: dict[str, Any] | None = None,
        *,
        subsystem: str = "backend",
        severity: str = "info",
        category: str = "workflow",
        title: str | None = None,
        description: str | None = None,
        status: str = "running",
        correlation_id: str | None = None,
        duration_ms: int | None = None,
    ) -> dict[str, Any]:
        return await self.publish_event(
            event_type=event_type,
            subsystem=subsystem,
            severity=severity,
            category=category,
            title=title or event_type.replace("_", " ").title(),
            description=description or f"Monitoring event: {event_type}",
            status=status,
            correlation_id=correlation_id,
            details=details,
            duration_ms=duration_ms,
        )

    def subscribe(self) -> AsyncIterator[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=100)
        self._subscribers.add(queue)

        async def iterator() -> AsyncIterator[dict[str, Any]]:
            while True:
                payload = await queue.get()
                yield payload

        return iterator()

    def snapshot(self) -> dict[str, Any]:
        return {
            "events": list(self._events)[-50:],
        }


_monitoring_service_instance: MonitoringService | None = None


def get_monitoring_service() -> MonitoringService:
    global _monitoring_service_instance
    if _monitoring_service_instance is None:
        _monitoring_service_instance = MonitoringService()
    return _monitoring_service_instance


class MonitoringLogHandler(logging.Handler):
    def __init__(self, service: MonitoringService) -> None:
        super().__init__()
        self._service = service

    def emit(self, record: logging.LogRecord) -> None:
        try:
            message = self.format(record)
            severity = {
                logging.DEBUG: "debug",
                logging.INFO: "info",
                logging.WARNING: "warning",
                logging.ERROR: "error",
                logging.CRITICAL: "critical",
            }.get(record.levelno, "info")
            coro = self._service.publish_log(
                message=message,
                subsystem="backend",
                severity=severity,
                category="terminal",
                title=record.name or "backend",
            )
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                asyncio.run(coro)
            else:
                loop.create_task(coro)
        except Exception:
            pass
