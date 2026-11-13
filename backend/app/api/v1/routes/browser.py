"""
Browser control API route.
Exposes a unified REST interface connecting directly to the Centralized BrowserManager
and the Aether Floating Browser.
"""
from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from app.api.dependencies import get_container
from app.core.container import ApplicationContainer
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()


class BrowserOpenRequest(BaseModel):
    url: str
    profile_name: str = "default"

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith(("http://", "https://")) and "." in v:
            v = f"https://{v}"
        return v


class BrowserActivePageRequest(BaseModel):
    url: str
    tab_id: str | None = None

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        value = value.strip()
        if not value.startswith(("http://", "https://")):
            raise ValueError("An active browser page must use http or https")
        return value


class BrowserCommandRequest(BaseModel):
    command: str  # "navigate", "search", "screenshot", "click", "type", "scroll", "back", "forward", "reload", "minimize", "restore", "close", "state"
    target: str | None = None
    selector: str | None = None
    text: str | None = None
    direction: str = "down"
    full_page: bool = False
    profile_name: str = "default"


@router.post("/browser/open")
async def browser_open(
    body: BrowserOpenRequest,
    container: Annotated[ApplicationContainer, Depends(get_container)],
) -> dict[str, Any]:
    """Opens or navigates the active Aether Floating Browser to a URL."""
    manager = container.browser_manager()
    try:
        current_url = await manager.open_browser(body.url)
        return {
            "success": True,
            "url": body.url,
            "current_url": current_url,
        }
    except Exception as exc:
        logger.error("browser_open_api_failed", exc_info=exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/browser/active-page")
async def set_active_browser_page(
    body: BrowserActivePageRequest,
    container: Annotated[ApplicationContainer, Depends(get_container)],
) -> dict[str, Any]:
    """Keeps backend CDP automation aligned with the selected floating-browser tab."""
    manager = container.browser_manager()
    manager.set_active_page(body.url, body.tab_id)
    return {"success": True, "url": body.url, "tab_id": body.tab_id}


@router.post("/browser/command")
async def browser_command(
    body: BrowserCommandRequest,
    container: Annotated[ApplicationContainer, Depends(get_container)],
) -> dict[str, Any]:
    """Executes a browser command on the centralized Aether Floating Browser."""
    manager = container.browser_manager()
    try:
        result: dict[str, Any] = {"success": True, "command": body.command}

        if body.command == "navigate":
            if not body.target:
                raise HTTPException(status_code=400, detail="target URL is required for navigate")
            result["current_url"] = await manager.navigate(body.target)

        elif body.command == "search":
            query = body.target or body.text or ""
            result["current_url"] = await manager.search(query)

        elif body.command == "screenshot":
            filepath = await manager.capture_screenshot(full_page=body.full_page)
            result["filepath"] = filepath

        elif body.command == "click":
            sel = body.selector or body.target
            if not sel:
                raise HTTPException(status_code=400, detail="selector is required for click")
            await manager.click_element(sel)
            result["clicked"] = sel

        elif body.command == "type":
            sel = body.selector or body.target
            if not sel or body.text is None:
                raise HTTPException(status_code=400, detail="selector and text are required for type")
            await manager.type_text(sel, body.text)
            result["typed"] = True

        elif body.command == "scroll":
            await manager.scroll(direction=body.direction)
            result["scrolled"] = body.direction

        elif body.command == "back":
            await manager.go_back()

        elif body.command == "forward":
            await manager.go_forward()

        elif body.command == "reload":
            await manager.refresh()

        elif body.command == "minimize":
            await manager.minimize()

        elif body.command == "restore":
            await manager.restore()

        elif body.command == "maximize":
            await manager.maximize()

        elif body.command == "close":
            await manager.close_browser()
            result["message"] = "Browser closed"

        elif body.command == "state":
            st = await manager.get_state()
            result["state"] = {
                "current_url": st.current_url,
                "page_title": st.page_title,
                "tab_count": st.tab_count,
                "is_running": manager.is_running(),
            }

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown command: {body.command}",
            )

        return result

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("browser_command_api_failed", exc_info=exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/browser/state")
async def browser_state(
    container: Annotated[ApplicationContainer, Depends(get_container)],
) -> dict[str, Any]:
    """Returns current centralized browser state."""
    manager = container.browser_manager()
    try:
        st = await manager.get_state()
        return {
            "is_running": manager.is_running(),
            "current_url": st.current_url,
            "page_title": st.page_title,
            "tab_count": st.tab_count,
        }
    except Exception as exc:
        logger.warning("browser_state_check_failed", exc_info=exc)
        return {"is_running": False, "current_url": None, "page_title": None, "tab_count": 0}
