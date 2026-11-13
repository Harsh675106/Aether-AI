from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import get_container
from app.core.container import ApplicationContainer

router = APIRouter()


@router.get("/memory")
async def list_memories(
    container: Annotated[ApplicationContainer, Depends(get_container)],
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> dict[str, object]:
    memories = await container.memory_manager().list_memories(limit=limit)
    return {"memories": memories, "count": len(memories)}


@router.get("/memory/search")
async def search_memories(
    q: Annotated[str, Query(min_length=1, max_length=500)],
    container: Annotated[ApplicationContainer, Depends(get_container)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict[str, object]:
    query = q.strip()
    if not query:
        raise HTTPException(status_code=422, detail="Memory search query must not be blank")
    results = await container.memory_manager().search_semantic(query, limit=limit)
    memories = [
        {
            "id": str(item.get("id") or ""),
            "content": str(item.get("content") or ""),
            "source": str((item.get("metadata") or {}).get("source", "conversation")),
            "conversation_id": (item.get("metadata") or {}).get("conversation_id"),
            "created_at": (item.get("metadata") or {}).get("created_at"),
            "distance": item.get("distance"),
        }
        for item in results
    ]
    return {"query": query, "memories": memories, "count": len(memories)}
