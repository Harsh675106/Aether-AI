from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class ProviderDescriptor:
    id: str
    label: str
    enabled: bool = False


class ProviderManager:
    def available_providers(self) -> Sequence[ProviderDescriptor]:
        return [
            ProviderDescriptor(id="openai", label="OpenAI"),
            ProviderDescriptor(id="anthropic", label="Anthropic"),
            ProviderDescriptor(id="google", label="Google"),
            ProviderDescriptor(id="ollama", label="Ollama"),
            ProviderDescriptor(id="llama", label="Llama"),
            ProviderDescriptor(id="qwen", label="Qwen"),
            ProviderDescriptor(id="mistral", label="Mistral"),
            ProviderDescriptor(id="gemma", label="Gemma"),
        ]

