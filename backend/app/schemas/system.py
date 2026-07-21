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

