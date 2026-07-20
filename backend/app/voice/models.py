from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Literal

VoicePhase = Literal[
    "idle",
    "started",
    "waiting_for_wake_word",
    "wake_word_detected",
    "listening",
    "processing_speech",
    "sending_to_chatbot",
    "receiving_ai_response",
    "converting_to_speech",
    "speaking",
    "completed",
    "error",
]


@dataclass(slots=True)
class VoiceSettings:
    wake_word: str = "Aether"
    continuous_listening: bool = True
    auto_restart: bool = True
    language: str = "en-US"
    speech_rate: float = 1.0
    speech_pitch: float = 1.0
    speech_volume: float = 1.0
    silence_timeout_ms: int = 1200


@dataclass(slots=True)
class VoiceSession:
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    correlation_id: str | None = None
    wake_word: str = "Aether"
    started_at: float = field(default_factory=lambda: time.time() * 1000)
    transcript: str = ""
    response: str = ""
    active: bool = False

