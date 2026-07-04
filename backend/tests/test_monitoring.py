import asyncio

import pytest

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
