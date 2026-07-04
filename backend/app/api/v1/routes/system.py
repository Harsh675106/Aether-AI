from fastapi import APIRouter, Depends

from app.api.dependencies import get_container
from app.core.container import ApplicationContainer
from app.schemas.system import SystemSnapshot

router = APIRouter()


@router.get("/snapshot", response_model=SystemSnapshot)
async def snapshot(container: ApplicationContainer = Depends(get_container)) -> SystemSnapshot:
    return await container.system_service().snapshot()

