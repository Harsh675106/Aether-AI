from dataclasses import dataclass

from app.core.settings import Settings


@dataclass(frozen=True)
class SecretManager:
    settings: Settings

    def get_application_secret_fingerprint(self) -> str:
        return f"configured:{len(self.settings.secret_key.get_secret_value())}"

