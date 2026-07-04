from collections.abc import Sequence

from app.core.interfaces import ToolManager


class PlaceholderToolManager(ToolManager):
    async def list_tools(self) -> Sequence[str]:
        return []

