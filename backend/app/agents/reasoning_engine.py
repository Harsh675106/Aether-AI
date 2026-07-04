from dataclasses import dataclass


@dataclass(frozen=True)
class ReasoningEngine:
    name: str = "placeholder-reasoning-engine"

    async def describe(self) -> str:
        return "Reasoning interface initialized."

