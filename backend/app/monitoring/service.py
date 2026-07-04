from __future__ import annotations

import asyncio
import json
import time
import uuid
from collections import deque
from collections.abc import AsyncIterator, Iterator
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
    timestamp: float = field(default_factory=time.time)
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
        self._stats: dict[str, Any] = {
            "events": 0,
            "errors": 0,
            "warnings": 0,
            "successes": 0,
        }
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
        self._stats["events"] += 1
        if severity.lower() in {"error", "critical"}:
            self._stats["errors"] += 1
        elif severity.lower() == "warning":
            self._stats["warnings"] += 1
        elif severity.lower() in {"success", "info"}:
            self._stats["successes"] += 1

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
            "stats": dict(self._stats),
        }
