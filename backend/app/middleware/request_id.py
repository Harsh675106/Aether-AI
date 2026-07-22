import time
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import get_logger
from app.monitoring.service import get_monitoring_service

logger = get_logger(__name__)


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[no-untyped-def]
        request_id = request.headers.get("x-request-id", str(uuid4()))
        started_at = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
        response.headers["x-request-id"] = request_id
        logger.info(
            "request_completed",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
        )

        container = getattr(getattr(request.app, 'state', None), 'container', None)
        monitoring = container.monitoring_service() if container is not None else get_monitoring_service()
        await monitoring.publish_event(event_type='api.request_completed', subsystem='api', severity='success' if response.status_code < 400 else 'error', category='terminal', title=f'{request.method} {request.url.path}', description=f'API request completed with HTTP {response.status_code}.', status='complete' if response.status_code < 400 else 'error', details={'request_id': request_id, 'method': request.method, 'path': request.url.path, 'status_code': response.status_code, 'duration_ms': duration_ms})
        return response

