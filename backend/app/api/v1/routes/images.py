from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.dependencies import get_container
from app.core.container import ApplicationContainer
from app.images.schemas import ImageSearchRequest

router = APIRouter()


@router.post("/images/search")
async def search_images(
    request: ImageSearchRequest,
    container: ApplicationContainer = Depends(get_container),
) -> dict[str, object]:
    service = container.image_search_service()
    response = await service.search(
        request.query,
        limit=request.limit,
        conversation_id=request.conversation_id,
        request_source=request.request_source,
    )
    return response.model_dump()