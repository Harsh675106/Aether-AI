from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ============================================================
# Chat Message Schema
# ============================================================

class ChatMessage(BaseModel):
    """
    Individual conversation message.
    """

    model_config = ConfigDict(
        frozen=True,
        extra="ignore",
    )

    role: Literal[
        "system",
        "user",
        "assistant",
        "tool",
    ]

    content: str = Field(
        min_length=1,
        max_length=50000,
    )

    name: str | None = Field(
        default=None,
        description="Optional agent or tool name",
    )

    metadata: dict[str, Any] | None = Field(
        default=None,
        description="Additional message metadata",
    )

    @field_validator("content")
    @classmethod
    def clean_content(cls, value: str) -> str:
        cleaned = value.strip()

        if not cleaned:
            raise ValueError("Message content cannot be empty")

        return cleaned


# ============================================================
# Chat Completion Request
# ============================================================

class ChatCompletionRequest(BaseModel):
    """
    Request schema from frontend to Aether.
    """

    model_config = ConfigDict(
        extra="ignore",
    )

    messages: list[ChatMessage] = Field(
        min_length=1,
        max_length=100,
    )

    stream: bool = Field(
        default=True,
        description="Enable streaming response",
    )

    conversation_id: str | None = Field(
        default=None,
        max_length=128,
    )

    system_prompt: str | None = Field(
        default=None,
        max_length=20000,
    )

    temperature: float | None = Field(
        default=0.7,
        ge=0.0,
        le=2.0,
    )

    max_tokens: int | None = Field(
        default=2048,
        ge=1,
        le=8192,
    )

    top_p: float | None = Field(
        default=0.9,
        ge=0.0,
        le=1.0,
    )

    user_metadata: dict[str, Any] | None = Field(
        default=None,
        description="User session information",
    )

    tools_enabled: bool = Field(
        default=False,
        description="Allow Aether tools",
    )

    memory_enabled: bool = Field(
        default=True,
        description="Enable memory retrieval",
    )

    web_search_enabled: bool = Field(
        default=True,
        description="Enable web fallback search",
    )

    @field_validator("messages")
    @classmethod
    def validate_messages(
        cls,
        messages: list[ChatMessage],
    ) -> list[ChatMessage]:
        if not any(message.role == "user" for message in messages):
            raise ValueError("At least one user message is required")

        return messages


# ============================================================
# Streaming Response Chunk
# ============================================================

class ChatCompletionChunk(BaseModel):
    """
    Streaming response chunk from Aether.
    """

    model_config = ConfigDict(
        frozen=True,
    )

    delta: str

    conversation_id: str | None = None

    done: bool = False

    metadata: dict[str, Any] | None = Field(
        default=None,
        description="Pipeline monitoring data",
    )

    citations: list[dict[str, Any]] | None = Field(
        default=None,
        description="Web search citations",
    )

    confidence: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
    )


# ============================================================
# Internal Agent State
# ============================================================

class AgentState(BaseModel):
    """
    Internal Aether agent execution state.
    """

    model_config = ConfigDict(
        extra="ignore",
    )

    conversation_id: str | None = None

    query: str

    intent: str | None = None

    route: dict[str, bool] = Field(
        default_factory=dict
    )

    memory_used: bool = False

    search_used: bool = False

    tool_used: bool = False

    confidence: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
    )