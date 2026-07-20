from __future__ import annotations

import pytest

from app.core.container import ApplicationContainer
from app.core.settings import Settings
from app.voice.engine import VoiceEngine
from app.voice.providers import RegexWakeWordDetector


@pytest.mark.asyncio
async def test_voice_engine_publishes_monitoring_events() -> None:
    container = ApplicationContainer(settings=Settings(environment="testing"))
    engine = container.voice_engine()

    await engine.announce_started()
    await engine.wait_for_wake_word()
    await engine.wake_word_detected("Aether", session=engine.create_session())

    snapshot = container.monitoring_service().snapshot()
    titles = [event["title"] for event in snapshot["events"] if event["subsystem"] == "voice"]

    assert "Voice Engine Started" in titles
    assert "Waiting for Wake Word" in titles
    assert "Wake Word Detected" in titles


def test_voice_engine_defaults_are_created_from_settings() -> None:
    container = ApplicationContainer(settings=Settings(environment="testing"))
    engine = container.voice_engine()

    assert isinstance(engine, VoiceEngine)
    assert engine.settings.wake_word == "Aether"
    assert isinstance(engine.wake_word_detector, RegexWakeWordDetector)

