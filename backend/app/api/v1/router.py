from fastapi import APIRouter

from app.api.v1.routes import chat, health, images, monitoring, system

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(chat.router, tags=["chat"])
api_router.include_router(images.router, tags=["images"])
api_router.include_router(monitoring.router, tags=["monitoring"])

