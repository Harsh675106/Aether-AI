from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.monitoring.service import get_monitoring_service

router = APIRouter()


@router.websocket("/monitoring/ws")
async def monitoring_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    container = getattr(getattr(websocket.app, "state", None), "container", None)
    service = container.monitoring_service() if container is not None else get_monitoring_service()

    await websocket.send_json({"type": "snapshot", "payload": service.snapshot()})

    connected_event = await service.publish_event(
        event_type="connection",
        subsystem="backend",
        severity="info",
        category="monitoring",
        title="Monitoring stream connected",
        description="The live monitoring stream is now active.",
    )
    await websocket.send_json({"type": "event", "payload": connected_event})

    try:
        async for payload in service.subscribe():
            await websocket.send_json({"type": "event", "payload": payload})
    except WebSocketDisconnect:
        return
