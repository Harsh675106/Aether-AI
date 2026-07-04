from collections.abc import Sequence


class PlaceholderPluginManager:
    async def list_plugins(self) -> Sequence[str]:
        return []

