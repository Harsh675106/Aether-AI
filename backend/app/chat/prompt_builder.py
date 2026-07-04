from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from app.chat.schemas import ChatMessage


@dataclass(frozen=True)
class PromptContext:
    system_instructions: str | None = None
    history: Sequence[ChatMessage] = ()
    user_message: str | None = None
    memory_context: str | None = None
    web_context: str | None = None
    tool_outputs: str | None = None


class PromptBuilder:
    """Assemble a reusable prompt from chat, context, and future modules."""

    def build(self, context: PromptContext) -> str:
        parts: list[str] = []
        if context.system_instructions:
            parts.append(f"System: {context.system_instructions}")
        if context.memory_context:
            parts.append(f"Memory: {context.memory_context}")
        if context.web_context:
            parts.append(f"Web: {context.web_context}")
        if context.tool_outputs:
            parts.append(f"Tools: {context.tool_outputs}")
        if context.history:
            history_text = "\n".join(
                f"{message.role}: {message.content}" for message in context.history
            )
            parts.append(f"Conversation history:\n{history_text}")
        if context.user_message:
            parts.append(f"User: {context.user_message}")
        return "\n\n".join(parts)
