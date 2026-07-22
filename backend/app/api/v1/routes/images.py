from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from app.api.dependencies import get_container
from app.core.container import ApplicationContainer
from app.images.schemas import ImageSearchRequest
import httpx
from urllib.parse import urlparse

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


@router.get('/images/history')
async def list_image_history(
    limit: int = Query(default=24, ge=1, le=100),
    container: ApplicationContainer = Depends(get_container),
) -> dict[str, object]:
    entries = await container.image_search_service().list_history(limit=limit)
    return {'entries': entries}


@router.get('/images/history/{request_id}')
async def get_image_history(
    request_id: str,
    container: ApplicationContainer = Depends(get_container),
) -> dict[str, object]:
    entry = await container.image_search_service().get_history(request_id)
    if entry is None:
        raise HTTPException(status_code=404, detail='Image request history was not found')
    return entry

@router.get('/images/download')
async def download_image(url: str = Query(..., min_length=1, max_length=4096)) -> Response:
    parsed = urlparse(url)
    if parsed.scheme not in {'http', 'https'} or not parsed.netloc:
        raise HTTPException(status_code=400, detail='Only HTTP(S) image URLs are supported')
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers={'User-Agent': 'AetherAI/1.0'}) as client:
            upstream = await client.get(url)
            upstream.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail='Unable to download the image source') from exc
    content_type = upstream.headers.get('content-type', 'application/octet-stream').split(';', 1)[0]
    if not content_type.startswith('image/'):
        raise HTTPException(status_code=415, detail='The source did not return an image')
    return Response(content=upstream.content, media_type=content_type, headers={'Content-Disposition': 'attachment'})
