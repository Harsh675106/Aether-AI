"""
Browser Event Dispatcher & Telemetry Publisher.
"""
from __future__ import annotations

import time
from typing import Any, Callable, Coroutine
from app.core.logging import get_logger
from app.monitoring.service import MonitoringService

logger = get_logger(__name__)


class BrowserEventDispatcher:
    """Manages and publishes browser lifecycle, navigation, window, and playback events."""

    def __init__(self, monitoring_service: MonitoringService | None = None) -> None:
        self._monitoring_service = monitoring_service
        self._listeners: list[Callable[[str, dict[str, Any]], Coroutine[Any, Any, None]]] = []

    def subscribe(self, callback: Callable[[str, dict[str, Any]], Coroutine[Any, Any, None]]) -> None:
        self._listeners.append(callback)

    async def emit(self, event_type: str, data: dict[str, Any]) -> None:
        data["timestamp"] = time.time()
        logger.debug("browser_event_emitted", extra={"event_type": event_type, "data": data})

        # Broadcast to local subscribers
        for callback in self._listeners:
            try:
                await callback(event_type, data)
            except Exception as exc:
                logger.warning("browser_event_listener_failed", exc_info=exc)

        # Publish to Monitoring System
        if self._monitoring_service:
            try:
                await self._monitoring_service.publish_event(
                    event_type=f"browser.{event_type}",
                    subsystem="browser",
                    severity="info",
                    category="workflow",
                    title=f"Browser: {event_type.replace('_', ' ').title()}",
                    description=data.get("description", f"Browser event: {event_type}"),
                    status="complete",
                    details=data,
                )
            except Exception as exc:
                logger.warning("browser_monitoring_publish_failed", exc_info=exc)

