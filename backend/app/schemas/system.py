from pydantic import BaseModel, ConfigDict


class SystemSnapshot(BaseModel):
    model_config = ConfigDict(frozen=True)

    environment: str
    model: str
    memory: str
    database: str
    vision: str
    internet: str
    tools: str
    cpu_percent: float
    cpu_cores: int
    ram_percent: float
    ram_used_bytes: int
    ram_total_bytes: int
    disk_percent: float
    disk_used_bytes: int
    disk_total_bytes: int
    uptime_seconds: float
    hostname: str
    platform: str
    gpu: str | None = None
