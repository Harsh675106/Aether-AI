from abc import ABC, abstractmethod
from typing import Generic, TypeVar

T = TypeVar("T")


class Repository(ABC, Generic[T]):
    @abstractmethod
    async def add(self, entity: T) -> T:
        """Persist an entity."""

