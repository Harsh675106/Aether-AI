from __future__ import annotations

import re
from typing import Protocol


class WakeWordDetector(Protocol):
    def matches(self, transcript: str, wake_word: str) -> bool: ...

    def strip(self, transcript: str, wake_word: str) -> str: ...


class SpeechToTextProvider(Protocol):
    async def transcribe(self, audio: bytes, *, language: str = "en-US") -> str: ...


class TextToSpeechProvider(Protocol):
    async def synthesize(
        self,
        text: str,
        *,
        language: str = "en-US",
        voice: str | None = None,
        rate: float = 1.0,
        pitch: float = 1.0,
        volume: float = 1.0,
    ) -> bytes | str: ...


class VoiceChatResponder(Protocol):
    async def respond(
        self,
        transcript: str,
        *,
        conversation_id: str | None = None,
    ) -> str: ...


class RegexWakeWordDetector:
    def matches(self, transcript: str, wake_word: str) -> bool:
        pattern = rf"\b{re.escape(wake_word)}\b"
        return bool(re.search(pattern, transcript, flags=re.IGNORECASE))

    def strip(self, transcript: str, wake_word: str) -> str:
        pattern = re.compile(rf"\b{re.escape(wake_word)}\b", flags=re.IGNORECASE)
        cleaned = pattern.sub("", transcript)
        return re.sub(r"\s+", " ", cleaned).strip(" ,.!?;:")


class NullSpeechToTextProvider:
    async def transcribe(self, audio: bytes, *, language: str = "en-US") -> str:
        _ = audio, language
        return ""


class NullTextToSpeechProvider:
    async def synthesize(
        self,
        text: str,
        *,
        language: str = "en-US",
        voice: str | None = None,
        rate: float = 1.0,
        pitch: float = 1.0,
        volume: float = 1.0,
    ) -> bytes | str:
        _ = language, voice, rate, pitch, volume
        return text

