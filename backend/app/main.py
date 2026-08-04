from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.container import ApplicationContainer
from app.core.logging import configure_logging, get_logger
from app.core.settings import get_settings
from app.database.session import init_db
from app.middleware.exception_handler import register_exception_handlers
from app.middleware.request_id import RequestIdMiddleware

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings)
    container = ApplicationContainer(settings=settings)
    app.state.container = container
    
    # Initialize database tables
    await init_db(container.database_engine())
    
    logger.info("application_started", environment=settings.environment)
    yield
    if hasattr(container, "_browser_service"):
        await container.browser_service().close()
    logger.info("application_shutdown")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Aether AI API",
        version="0.1.0",
        description="Backend foundation for the Aether AI desktop system agent.",
        lifespan=lifespan,
    )
    app.state.container = ApplicationContainer(settings=settings)

    register_exception_handlers(app)
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()

