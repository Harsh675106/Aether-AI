from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from app.monitoring.service import MonitoringService, get_monitoring_service

from .models import VoicePhase, VoiceSession, VoiceSettings
from .providers import (
    NullSpeechToTextProvider,
    NullTextToSpeechProvider,
    RegexWakeWordDetector,
    SpeechToTextProvider,
    TextToSpeechProvider,
    VoiceChatResponder,
    WakeWordDetector,
)


@dataclass(slots=True)
class VoiceEngineState:
    phase: VoicePhase = "idle"
    session_id: str | None = None
    correlation_id: str | None = None
    wake_word: str = "Aether"
    transcript: str = ""
    response: str = ""
    supported: bool = True
    error: str | None = None
    listening: bool = False
    active: bool = False
    updated_at: float = field(default_factory=lambda: time.time() * 1000)


@dataclass
class VoiceEngine:
    monitoring_service: MonitoringService | None = None
    settings: VoiceSettings = field(default_factory=VoiceSettings)
    wake_word_detector: WakeWordDetector = field(default_factory=RegexWakeWordDetector)
    stt_provider: SpeechToTextProvider = field(default_factory=NullSpeechToTextProvider)
    tts_provider: TextToSpeechProvider = field(default_factory=NullTextToSpeechProvider)

    def __post_init__(self) -> None:
        self._monitoring_service = self.monitoring_service or get_monitoring_service()
        self._state = VoiceEngineState(wake_word=self.settings.wake_word)

    @property
    def state(self) -> VoiceEngineState:
        return self._state

    @classmethod
    def from_settings(
        cls,
        *,
        settings: Any,
        monitoring_service: MonitoringService | None = None,
    ) -> "VoiceEngine":
        defaults = VoiceSettings()
        voice_settings = VoiceSettings(
            wake_word=getattr(settings, "voice_wake_word", defaults.wake_word),
            continuous_listening=getattr(
                settings,
                "voice_continuous_listening",
                defaults.continuous_listening,
            ),
            auto_restart=getattr(settings, "voice_auto_restart", defaults.auto_restart),
            language=getattr(settings, "voice_language", defaults.language),
            speech_rate=getattr(settings, "voice_speech_rate", defaults.speech_rate),
            speech_pitch=getattr(settings, "voice_speech_pitch", defaults.speech_pitch),
            speech_volume=getattr(settings, "voice_speech_volume", defaults.speech_volume),
            silence_timeout_ms=getattr(
                settings,
                "voice_silence_timeout_ms",
                defaults.silence_timeout_ms,
            ),
        )
        return cls(monitoring_service=monitoring_service, settings=voice_settings)

    async def describe(self) -> str:
        return (
            f"Voice engine ready for wake word '{self.settings.wake_word}' "
            f"with continuous listening={self.settings.continuous_listening}."
        )

    def _touch_state(self, **updates: Any) -> VoiceEngineState:
        self._state = VoiceEngineState(
            phase=updates.get("phase", self._state.phase),
            session_id=updates.get("session_id", self._state.session_id),
            correlation_id=updates.get("correlation_id", self._state.correlation_id),
            wake_word=updates.get("wake_word", self._state.wake_word),
            transcript=updates.get("transcript", self._state.transcript),
            response=updates.get("response", self._state.response),
            supported=updates.get("supported", self._state.supported),
            error=updates.get("error", self._state.error),
            listening=updates.get("listening", self._state.listening),
            active=updates.get("active", self._state.active),
            updated_at=time.time() * 1000,
        )
        return self._state

    async def _publish(
        self,
        *,
        event_type: str,
        title: str,
        description: str,
        severity: str = "info",
        status: str = "running",
        correlation_id: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return await self._monitoring_service.track_event(
            event_type,
            details or {},
            subsystem="voice",
            severity=severity,
            category="voice",
            title=title,
            description=description,
            status=status,
            correlation_id=correlation_id,
        )

    def create_session(self, *, correlation_id: str | None = None) -> VoiceSession:
        return VoiceSession(correlation_id=correlation_id, wake_word=self.settings.wake_word)

    async def announce_started(self, session: VoiceSession | None = None) -> dict[str, Any]:
        current_session = session or self.create_session()
        self._touch_state(
            phase="started",
            session_id=current_session.session_id,
            correlation_id=current_session.correlation_id,
            wake_word=current_session.wake_word,
            listening=False,
            active=False,
            error=None,
        )
        return await self._publish(
            event_type="voice_started",
            title="Voice Engine Started",
            description="Voice services are initializing.",
            correlation_id=current_session.correlation_id,
            details={"wake_word": current_session.wake_word, "session_id": current_session.session_id},
        )

    async def wait_for_wake_word(self, session: VoiceSession | None = None) -> dict[str, Any]:
        current_session = session or self.create_session()
        self._touch_state(
            phase="waiting_for_wake_word",
            session_id=current_session.session_id,
            correlation_id=current_session.correlation_id,
            wake_word=current_session.wake_word,
            listening=True,
            active=False,
        )
        return await self._publish(
            event_type="voice_waiting_for_wake_word",
            title="Waiting for Wake Word",
            description=f"Listening for '{current_session.wake_word}'.",
            correlation_id=current_session.correlation_id,
            details={"wake_word": current_session.wake_word, "session_id": current_session.session_id},
        )

    async def wake_word_detected(
        self,
        transcript: str,
        *,
        session: VoiceSession | None = None,
    ) -> dict[str, Any]:
        current_session = session or self.create_session()
        self._touch_state(
            phase="wake_word_detected",
            session_id=current_session.session_id,
            correlation_id=current_session.correlation_id,
            transcript=transcript,
            listening=True,
            active=True,
        )
        return await self._publish(
            event_type="voice_wake_word_detected",
            title="Wake Word Detected",
            description=f"'{self.settings.wake_word}' activated voice mode.",
            correlation_id=current_session.correlation_id,
            details={"transcript": transcript, "session_id": current_session.session_id},
        )

    async def listening(
        self,
        transcript: str = "",
        *,
        session: VoiceSession | None = None,
    ) -> dict[str, Any]:
        current_session = session or self.create_session()
        self._touch_state(
            phase="listening",
            session_id=current_session.session_id,
            correlation_id=current_session.correlation_id,
            transcript=transcript or self._state.transcript,
            listening=True,
            active=True,
        )
        return await self._publish(
            event_type="voice_listening",
            title="Listening",
            description="Capturing speech input.",
            correlation_id=current_session.correlation_id,
            details={"transcript": transcript, "session_id": current_session.session_id},
        )

    async def processing_speech(
        self,
        transcript: str,
        *,
        session: VoiceSession | None = None,
    ) -> dict[str, Any]:
        current_session = session or self.create_session()
        self._touch_state(
            phase="processing_speech",
            session_id=current_session.session_id,
            correlation_id=current_session.correlation_id,
            transcript=transcript,
            listening=False,
            active=True,
        )
        return await self._publish(
            event_type="voice_processing_speech",
            title="Processing Speech",
            description="Speech input is being prepared for the chatbot.",
            correlation_id=current_session.correlation_id,
            details={"transcript": transcript, "session_id": current_session.session_id},
        )

    async def sending_to_chatbot(
        self,
        transcript: str,
        *,
        session: VoiceSession | None = None,
    ) -> dict[str, Any]:
        current_session = session or self.create_session()
        self._touch_state(
            phase="sending_to_chatbot",
            session_id=current_session.session_id,
            correlation_id=current_session.correlation_id,
            transcript=transcript,
            listening=False,
            active=True,
        )
        return await self._publish(
            event_type="voice_sending_to_chatbot",
            title="Sending to Chatbot",
            description="User speech is being routed through the current AI chat pipeline.",
            correlation_id=current_session.correlation_id,
            details={"transcript": transcript, "session_id": current_session.session_id},
        )

    async def receiving_ai_response(
        self,
        *,
        session: VoiceSession | None = None,
    ) -> dict[str, Any]:
        current_session = session or self.create_session()
        self._touch_state(
            phase="receiving_ai_response",
            session_id=current_session.session_id,
            correlation_id=current_session.correlation_id,
            listening=False,
            active=True,
        )
        return await self._publish(
            event_type="voice_receiving_ai_response",
            title="Receiving AI Response",
            description="The chatbot is streaming a spoken answer.",
            correlation_id=current_session.correlation_id,
            details={"session_id": current_session.session_id},
        )

    async def converting_to_speech(
        self,
        response: str,
        *,
        session: VoiceSession | None = None,
    ) -> dict[str, Any]:
        current_session = session or self.create_session()
        self._touch_state(
            phase="converting_to_speech",
            session_id=current_session.session_id,
            correlation_id=current_session.correlation_id,
            response=response,
            listening=False,
            active=True,
        )
        return await self._publish(
            event_type="voice_converting_to_speech",
            title="Converting to Speech",
            description="Preparing the AI response for playback.",
            correlation_id=current_session.correlation_id,
            details={"response_length": len(response), "session_id": current_session.session_id},
        )

    async def speaking(
        self,
        response: str,
        *,
        session: VoiceSession | None = None,
    ) -> dict[str, Any]:
        current_session = session or self.create_session()
        self._touch_state(
            phase="speaking",
            session_id=current_session.session_id,
            correlation_id=current_session.correlation_id,
            response=response,
            listening=False,
            active=True,
        )
        return await self._publish(
            event_type="voice_speaking",
            title="Speaking",
            description="The response is being spoken aloud.",
            correlation_id=current_session.correlation_id,
            details={"response_length": len(response), "session_id": current_session.session_id},
        )

    async def completed(
        self,
        *,
        session: VoiceSession | None = None,
    ) -> dict[str, Any]:
        current_session = session or self.create_session()
        self._touch_state(
            phase="completed",
            session_id=current_session.session_id,
            correlation_id=current_session.correlation_id,
            listening=False,
            active=False,
        )
        return await self._publish(
            event_type="voice_completed",
            title="Completed",
            description="Voice interaction cycle completed successfully.",
            status="complete",
            correlation_id=current_session.correlation_id,
            details={"session_id": current_session.session_id},
        )

    async def error(
        self,
        message: str,
        *,
        session: VoiceSession | None = None,
        details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        current_session = session or self.create_session()
        self._touch_state(
            phase="error",
            session_id=current_session.session_id,
            correlation_id=current_session.correlation_id,
            error=message,
            listening=False,
            active=False,
        )
        return await self._publish(
            event_type="voice_error",
            title="Voice Error",
            description=message,
            severity="error",
            status="error",
            correlation_id=current_session.correlation_id,
            details={"session_id": current_session.session_id, **(details or {})},
        )

    async def process_transcript(
        self,
        transcript: str,
        *,
        responder: VoiceChatResponder,
        session: VoiceSession | None = None,
        conversation_id: str | None = None,
    ) -> str:
        current_session = session or self.create_session(correlation_id=conversation_id)
        cleaned = transcript.strip()
        if not cleaned:
            await self.error("No speech was captured from the transcript.", session=current_session)
            return ""

        await self.processing_speech(cleaned, session=current_session)
        await self.sending_to_chatbot(cleaned, session=current_session)

        response = await responder.respond(
            cleaned,
            conversation_id=conversation_id,
        )

        await self.receiving_ai_response(session=current_session)
        await self.converting_to_speech(response, session=current_session)
        await self.speaking(response, session=current_session)
        self._touch_state(response=response, transcript=cleaned)
        await self.completed(session=current_session)
        return response

