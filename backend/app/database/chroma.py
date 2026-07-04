from dataclasses import dataclass

from app.core.settings import Settings


@dataclass(frozen=True)
class ChromaConfig:
    host: str
    port: int


def get_chroma_config(settings: Settings) -> ChromaConfig:
    return ChromaConfig(host=settings.chroma_host, port=settings.chroma_port)

