"""Voice engine primitives for Aether."""

from .engine import VoiceEngine, VoiceEngineState
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

__all__ = [
    "NullSpeechToTextProvider",
    "NullTextToSpeechProvider",
    "RegexWakeWordDetector",
    "SpeechToTextProvider",
    "TextToSpeechProvider",
    "VoiceChatResponder",
    "VoiceEngine",
    "VoiceEngineState",
    "VoicePhase",
    "VoiceSession",
    "VoiceSettings",
    "WakeWordDetector",
]
