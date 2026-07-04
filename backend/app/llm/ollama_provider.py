from __future__ import annotations

import json
from collections.abc import AsyncIterator, Mapping
from typing import Any

import httpx

from app.core.interfaces import LLMProvider
from app.core.settings import Settings


class OllamaProvider(LLMProvider):
    """Async Ollama provider using the local REST API."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.base_url = settings.ollama_base_url.rstrip("/")

    def _build_payload(self, prompt: str, *, metadata: Mapping[str, Any] | None = None) -> dict[str, Any]:
        return {
            "model": self.settings.llm_model,
            "prompt": prompt,
            "stream": True,
            "options": {
                "temperature": self.settings.temperature,
                "top_p": self.settings.top_p,
                "num_predict": self.settings.max_tokens,
            },
            "metadata": dict(metadata or {}),
        }

    async def complete(self, prompt: str, *, metadata: Mapping[str, Any] | None = None) -> str:
        chunks: list[str] = []
        async for chunk in self.stream_complete(prompt, metadata=metadata):
            chunks.append(chunk)
        return "".join(chunks)

    async def stream_complete(
        self, prompt: str, *, metadata: Mapping[str, Any] | None = None
    ) -> AsyncIterator[str]:
        payload = self._build_payload(prompt, metadata=metadata)
        async with httpx.AsyncClient(timeout=self.settings.llm_timeout) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/generate",
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if isinstance(data, dict):
                        chunk = data.get("response", "")
                        if chunk:
                            yield chunk
