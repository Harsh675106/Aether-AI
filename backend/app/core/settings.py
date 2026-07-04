from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["development", "testing", "production"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    environment: Environment = Field(default="development", alias="AETHER_ENV")
    log_level: str = Field(default="INFO", alias="AETHER_LOG_LEVEL")
    api_host: str = Field(default="0.0.0.0", alias="AETHER_API_HOST")
    api_port: int = Field(default=8000, alias="AETHER_API_PORT")
    cors_origins_raw: str = Field(default="http://localhost:5173", alias="AETHER_CORS_ORIGINS")
    secret_key: SecretStr = Field(default=SecretStr("change-me"), alias="AETHER_SECRET_KEY")
    postgres_dsn: str = Field(
        default="postgresql+asyncpg://aether:aether@localhost:5432/aether",
        alias="POSTGRES_DSN",
    )
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    chroma_host: str = Field(default="localhost", alias="CHROMA_HOST")
    chroma_port: int = Field(default=8001, alias="CHROMA_PORT")
    chroma_persist_directory: str = Field(default="./data/chroma", alias="CHROMA_PERSIST_DIRECTORY")
    chroma_collection_name: str = Field(default="aether_memories", alias="CHROMA_COLLECTION_NAME")
    searxng_base_url: str = Field(default="http://localhost:8080", alias="SEARXNG_BASE_URL")
    conversation_history_db: str = Field(default="./data/conversations.sqlite3", alias="CONVERSATION_HISTORY_DB")
    ollama_base_url: str = Field(default="http://localhost:11434", alias="OLLAMA_BASE_URL")
    llm_model: str = Field(default="qwen2.5:7b-instruct", alias="AETHER_LLM_MODEL")
    temperature: float = Field(default=0.2, alias="AETHER_TEMPERATURE")
    top_p: float = Field(default=0.9, alias="AETHER_TOP_P")
    max_tokens: int = Field(default=512, alias="AETHER_MAX_TOKENS")
    llm_timeout: int = Field(default=120, alias="AETHER_LLM_TIMEOUT")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

