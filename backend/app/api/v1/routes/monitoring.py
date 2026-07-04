from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.api.dependencies import get_container
from app.core.container import ApplicationContainer

router = APIRouter()


@router.websocket("/monitoring/ws")
async def monitoring_ws(websocket: WebSocket, container: ApplicationContainer = Depends(get_container)) -> None:
    await websocket.accept()
    service = container.monitoring_service()
    snapshot = service.snapshot()
    await websocket.send_json({"type": "snapshot", "payload": snapshot})

    try:
        async for event in service.subscribe():
            await websocket.send_json({"type": "event", "payload": event})
    except WebSocketDisconnect:
        return
