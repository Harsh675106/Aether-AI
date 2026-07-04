from pydantic import BaseModel, ConfigDict


class ErrorResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    detail: str
    status: str = "error"
