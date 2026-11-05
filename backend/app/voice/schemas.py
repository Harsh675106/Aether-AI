from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class VoiceTranscriptionResponse(BaseModel):
    text: str = Field(..., description="Recognized speech transcript")
    language: str = Field("en", description="Detected language code (e.g. 'en', 'hi')")
    language_probability: float = Field(1.0, description="Confidence in detected language")
    duration: float = Field(0.0, description="Audio duration in seconds")
    executed_command: bool = Field(False, description="Whether a system command was executed")
    command_response: str | None = Field(None, description="Command execution reply if any")
    action_type: str | None = Field(
        None,
        description="Action taken (e.g., 'app_launch', 'folder_open', 'system_query')",
    )


class VoiceHealthResponse(BaseModel):
    status: Literal["ready", "loading", "error"] = "ready"
    model_size: str = "base"
    device: str = "cpu"
    compute_type: str = "int8"
    vad_enabled: bool = True
    error: str | None = None
