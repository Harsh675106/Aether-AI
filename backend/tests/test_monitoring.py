import asyncio

import pytest

from app.chat.service import ChatService
from app.core.container import ApplicationContainer
from app.core.settings import Settings
from app.monitoring.service import MonitoringService


@pytest.mark.asyncio
async def test_monitoring_service_emits_live_events() -> None:
    service = MonitoringService()
    subscriber = service.subscribe()

    await service.publish_event(
        event_type="activity",
        subsystem="backend",
        severity="info",
        category="workflow",
        title="Request received",
        description="A new request was received by the backend.",
    )

    event = await asyncio.wait_for(anext(subscriber), timeout=1)

    assert event["title"] == "Request received"
    assert event["subsystem"] == "backend"


def test_chat_service_uses_shared_monitoring_service() -> None:
    container = ApplicationContainer(settings=Settings(environment="testing"))
    shared_monitoring = container.monitoring_service()

    chat_service = container.chat_service()

    assert isinstance(chat_service, ChatService)
    assert chat_service.monitoring_service is shared_monitoring
    assert chat_service.orchestrator._monitoring_service is shared_monitoring
