from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ChatMessage(BaseModel):
    model_config = ConfigDict(frozen=True)

    role: Literal["system", "user", "assistant", "tool"]
    content: str


class ChatCompletionRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    messages: list[ChatMessage]
    stream: bool = Field(default=False)
    conversation_id: str | None = Field(default=None)
    system_prompt: str | None = Field(default=None)
    temperature: float | None = Field(default=None)
    max_tokens: int | None = Field(default=None)
    top_p: float | None = Field(default=None)


class ChatCompletionChunk(BaseModel):
    model_config = ConfigDict(frozen=True)

    delta: str
    conversation_id: str | None = None
    done: bool = False
