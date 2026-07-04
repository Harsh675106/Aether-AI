from abc import ABC, abstractmethod
from collections.abc import Mapping, Sequence
from typing import Any, Protocol


class HealthCheck(Protocol):
    async def check(self) -> Mapping[str, str]:
        """Return component health information."""


class LLMProvider(ABC):
    @abstractmethod
    async def complete(self, prompt: str, *, metadata: Mapping[str, Any] | None = None) -> str:
        """Generate a completion for a prompt."""

    @abstractmethod
    async def stream_complete(
        self, prompt: str, *, metadata: Mapping[str, Any] | None = None
    ) -> Any:
        """Yield streamed text chunks for a prompt."""


class Planner(ABC):
    @abstractmethod
    async def create_plan(self, objective: str) -> Sequence[str]:
        """Create an ordered plan for an objective."""


class MemoryManager(ABC):
    @abstractmethod
    async def record_event(self, event: Mapping[str, Any]) -> None:
        """Store a future memory event."""

    @abstractmethod
    async def search_semantic(self, query: str, *, limit: int = 3) -> Sequence[Mapping[str, Any]]:
        """Return semantically similar memories for a query."""


class ToolManager(ABC):
    @abstractmethod
    async def list_tools(self) -> Sequence[str]:
        """List authorized tools."""


class WorkflowEngine(ABC):
    @abstractmethod
    async def describe(self) -> str:
        """Describe workflow engine state."""

