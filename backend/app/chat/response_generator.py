from __future__ import annotations

from collections.abc import AsyncIterator, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from app.chat.prompt_builder import PromptBuilder, PromptContext
from app.chat.schemas import ChatMessage
from app.core.interfaces import LLMProvider


SYSTEM_PROMPT = """You are Aether, a modern self-hosted AI assistant.

Core rules:
- Never hallucinate, invent facts, fabricate dates, fabricate names, or fabricate software versions.
- If current or changing facts are needed, rely on provided web context. If it is missing or insufficient, say you could not verify it.
- If memory context is provided, use only relevant memory and do not expose internal retrieval details.
- For stable concepts, coding help, math, writing, and casual conversation, answer directly without pretending to browse.
- Keep answers concise, useful, and formatted as clean GitHub Flavored Markdown.
- Do not show internal pipeline metadata in the chat response."""


@dataclass(frozen=True)
class GenerationContext:
    user_query: str
    history: Sequence[ChatMessage]
    memory_context: str | None = None
    web_context: str | None = None
    system_prompt: str | None = None
    metadata: Mapping[str, Any] | None = None


class ResponseGenerator:
    def __init__(self, llm_provider: LLMProvider, prompt_builder: PromptBuilder | None = None) -> None:
        self._llm_provider = llm_provider
        self._prompt_builder = prompt_builder or PromptBuilder()

    async def stream(self, context: GenerationContext) -> AsyncIterator[str]:
        prompt = self._prompt_builder.build(
            PromptContext(
                system_instructions=self._system_prompt(context.system_prompt),
                history=context.history,
                user_message=context.user_query,
                memory_context=context.memory_context,
                web_context=context.web_context,
            )
        )
        async for chunk in self._llm_provider.stream_complete(prompt, metadata=context.metadata):
            yield chunk

    def _system_prompt(self, override: str | None) -> str:
        if not override:
            return SYSTEM_PROMPT
        return f"{SYSTEM_PROMPT}\n\nAdditional developer/user system instructions:\n{override}"
