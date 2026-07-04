from fastapi import Request

from app.core.container import ApplicationContainer
from app.core.settings import get_settings


def get_container(request: Request) -> ApplicationContainer:
    container = getattr(request.app.state, "container", None)
    if container is None:
        container = ApplicationContainer(settings=get_settings())
        request.app.state.container = container
    return container

