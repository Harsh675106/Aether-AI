from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import get_container
from app.core.container import ApplicationContainer
from app.videos.schemas import SaveVideoRequest, VideoSearchRequest

router = APIRouter()


@router.post("/videos/search")
async def search_videos(
    request: VideoSearchRequest,
    container: Annotated[ApplicationContainer, Depends(get_container)],
) -> dict[str, object]:
    try:
        response = await container.video_search_service().search(
            request.query,
            limit=request.limit,
            page=request.page,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return response.model_dump(mode="json")


@router.get("/videos/saved")
async def list_saved_videos(
    container: Annotated[ApplicationContainer, Depends(get_container)],
    limit: Annotated[int | None, Query(ge=1, le=5000)] = None,
) -> dict[str, object]:
    videos = await container.saved_video_store().list(limit=limit)
    return {"videos": videos}


@router.get("/videos/saved/search")
async def search_saved_videos(
    q: Annotated[str, Query(min_length=1, max_length=200)],
    container: Annotated[ApplicationContainer, Depends(get_container)],
    limit: Annotated[int | None, Query(ge=1, le=5000)] = None,
) -> dict[str, object]:
    if not q.strip():
        raise HTTPException(status_code=422, detail="Saved video search query must not be blank")
    videos = await container.saved_video_store().list(query=q.strip(), limit=limit)
    return {"videos": videos}


@router.post("/videos/save")
async def save_video(
    request: SaveVideoRequest,
    container: Annotated[ApplicationContainer, Depends(get_container)],
) -> dict[str, object]:
    saved = await container.saved_video_store().save(request.model_dump(mode="json"))
    return {"video": saved}


@router.delete("/videos/saved/{video_id}")
async def remove_saved_video(
    video_id: str,
    container: Annotated[ApplicationContainer, Depends(get_container)],
) -> dict[str, bool]:
    if len(video_id) != 64 or any(char not in "0123456789abcdef" for char in video_id):
        raise HTTPException(status_code=400, detail="Invalid saved video ID")
    if not await container.saved_video_store().remove(video_id):
        raise HTTPException(status_code=404, detail="Saved video was not found")
    return {"deleted": True}
