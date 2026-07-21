from dataclasses import dataclass

from app.core.settings import Settings
from app.schemas.system import SystemSnapshot


@dataclass(frozen=True)
class SystemService:
    settings: Settings

    async def snapshot(self) -> SystemSnapshot:
        return SystemSnapshot(
            environment=self.settings.environment,
            model="Aether Provider Router",
            memory="placeholder",
            database="configured",
            vision="disabled",
            internet="restricted",
            tools="idle",
        )

