from fastapi import APIRouter

from app.api.v1.routes import browser, chat, health, images, monitoring, screenshots, system

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(chat.router, tags=["chat"])
api_router.include_router(images.router, tags=["images"])
api_router.include_router(monitoring.router, tags=["monitoring"])
api_router.include_router(screenshots.router, tags=["screenshots"])
api_router.include_router(browser.router, tags=["browser"])

