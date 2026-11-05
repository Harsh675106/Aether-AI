from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["development", "testing", "production"]

BACKEND_DIR = Path(__file__).resolve().parents[2]


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
    cors_origins_raw: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173", alias="AETHER_CORS_ORIGINS"
    )
    secret_key: SecretStr = Field(default=SecretStr("change-me"), alias="AETHER_SECRET_KEY")
    postgres_dsn: str = Field(
        default="postgresql+asyncpg://aether:aether@localhost:5432/aether",
        alias="POSTGRES_DSN",
    )
    database_url: str = Field(
        default=f"sqlite+aiosqlite:///{BACKEND_DIR}/data/conversations.sqlite3",
        alias="DATABASE_URL",
    )
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    chroma_host: str = Field(default="localhost", alias="CHROMA_HOST")
    chroma_port: int = Field(default=8001, alias="CHROMA_PORT")
    chroma_persist_directory: str = Field(
        default=str(BACKEND_DIR / "data" / "chroma"), alias="CHROMA_PERSIST_DIRECTORY"
    )
    chroma_collection_name: str = Field(default="aether_memories", alias="CHROMA_COLLECTION_NAME")
    chroma_mode: Literal["local", "http"] = Field(default="local", alias="CHROMA_MODE")
    searxng_base_url: str = Field(default="http://localhost:8080", alias="SEARXNG_BASE_URL")
    conversation_history_db: str = Field(
        default=str(BACKEND_DIR / "data" / "conversations.sqlite3"),
        alias="CONVERSATION_HISTORY_DB",
    )
    ollama_base_url: str = Field(default="http://localhost:11434", alias="OLLAMA_BASE_URL")
    llm_model: str = Field(default="qwen2.5:7b-instruct", alias="AETHER_LLM_MODEL")
    temperature: float = Field(default=0.2, alias="AETHER_TEMPERATURE")
    top_p: float = Field(default=0.9, alias="AETHER_TOP_P")
    max_tokens: int = Field(default=2048, alias="AETHER_MAX_TOKENS")
    llm_timeout: int = Field(default=120, alias="AETHER_LLM_TIMEOUT")

    browser_headless: bool = Field(default=True, alias="AETHER_BROWSER_HEADLESS")
    browser_channel: Literal["auto", "chrome", "msedge", "chromium"] = Field(
        default="auto", alias="AETHER_BROWSER_CHANNEL"
    )
    browser_timeout: int = Field(default=30000, alias="AETHER_BROWSER_TIMEOUT")
    browser_download_dir: str = Field(
        default=str(BACKEND_DIR / "data" / "downloads"), alias="AETHER_BROWSER_DOWNLOAD_DIR"
    )
    browser_screenshot_dir: str = Field(
        default=str(BACKEND_DIR / "data" / "screenshots"), alias="AETHER_BROWSER_SCREENSHOT_DIR"
    )
    browser_user_data_dir: str = Field(
        default=str(BACKEND_DIR / "data" / "browser" / "profiles"), alias="AETHER_BROWSER_USER_DATA_DIR"
    )
    browser_user_agent: str = Field(
        default="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        alias="AETHER_BROWSER_USER_AGENT",
    )
    browser_viewport_width: int = Field(default=1280, alias="AETHER_BROWSER_VIEWPORT_WIDTH")
    browser_viewport_height: int = Field(default=800, alias="AETHER_BROWSER_VIEWPORT_HEIGHT")
    browser_retry_count: int = Field(default=3, alias="AETHER_BROWSER_RETRY_COUNT")


    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
