from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import get_container
from app.core.container import ApplicationContainer

router = APIRouter()


@router.get("/screenshots")
async def list_screenshots(
    limit: int = Query(default=50, ge=1, le=100),
    container: ApplicationContainer = Depends(get_container),
) -> dict[str, object]:
    """Lists screenshots currently stored in memory/database."""
    store = container.screenshot_store()
    entries = await store.list_recent(limit=limit)
    return {"entries": entries, "count": len(entries)}


@router.get("/screenshots/{screenshot_id}")
async def get_screenshot(
    screenshot_id: str,
    container: ApplicationContainer = Depends(get_container),
) -> dict[str, object]:
    """Retrieves a single screenshot by ID."""
    store = container.screenshot_store()
    screenshot = await store.get(screenshot_id)
    if screenshot is None:
        raise HTTPException(status_code=404, detail="Screenshot not found in memory")
    return screenshot


@router.delete("/screenshots/{screenshot_id}")
async def delete_screenshot(
    screenshot_id: str,
    container: ApplicationContainer = Depends(get_container),
) -> dict[str, object]:
    """Deletes a screenshot from memory/database."""
    store = container.screenshot_store()
    success = await store.delete(screenshot_id)
    if not success:
        raise HTTPException(status_code=404, detail="Screenshot not found in memory")
    return {"success": True, "id": screenshot_id, "message": "Screenshot deleted successfully"}


@router.delete("/screenshots")
async def clear_screenshots(
    container: ApplicationContainer = Depends(get_container),
) -> dict[str, object]:
    """Clears all screenshots stored in memory."""
    store = container.screenshot_store()
    count = await store.clear_all()
    return {"success": True, "cleared_count": count, "message": f"Cleared {count} screenshots"}

