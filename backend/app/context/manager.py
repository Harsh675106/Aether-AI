from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from app.chat.schemas import ChatMessage


@dataclass(frozen=True)
class ContextWindow:
    messages: Sequence[ChatMessage]
    token_estimate: int


class ContextManager:
    """Manage prompt history and token budgets for future summarization."""

    def __init__(self, max_context_tokens: int = 4096) -> None:
        self._max_context_tokens = max_context_tokens

    def prepare(self, messages: Sequence[ChatMessage]) -> ContextWindow:
        token_estimate = sum(len(message.content.split()) for message in messages)
        if token_estimate > self._max_context_tokens:
            truncated = list(messages)[-8:]
            token_estimate = sum(len(message.content.split()) for message in truncated)
            messages = truncated
        return ContextWindow(messages=messages, token_estimate=token_estimate)
