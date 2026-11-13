"""
Centralized Browser Automation module.
JavaScript execution, scrolling, DOM inspection, text extraction, and screenshots
running directly on the active Aether Floating Browser session.
"""
from __future__ import annotations

import base64
import uuid
from typing import Any

from app.browser.screenshot_store import ScreenshotStore
from app.core.logging import get_logger
from app.core.settings import Settings

logger = get_logger(__name__)


class BrowserAutomation:
    """Provides centralized automation capabilities on the active floating browser instance."""

    def __init__(
        self,
        session_manager: Any,
        settings: Settings,
        screenshot_store: Any | None = None,
    ) -> None:
        self.session = session_manager
        self.settings = settings
        self.screenshot_store = (
            screenshot_store
            if screenshot_store is not None
            else ScreenshotStore(settings=settings)
        )

    async def execute_javascript(self, script: str) -> Any:
        """Executes JavaScript safely in the context of the active floating webpage."""
        logger.info("[BROWSER_MANAGER] Operation: JavaScript", execution_target="Embedded Chromium", external_browser_launch="DISABLED")
        page = await self.session.get_page()
        if page and not page.is_closed():
            return await page.evaluate(script)
        raise RuntimeError("Aether Floating Browser is unavailable; external browser launch is disabled.")

    async def scroll(self, direction: str = "down", amount: int = 500) -> None:
        """Scrolls the active webpage in the specified direction ('up', 'down', 'top', 'bottom')."""
        dir_lower = direction.lower()
        if dir_lower == "top":
            script = "window.scrollTo({ top: 0, behavior: 'smooth' });"
        elif dir_lower == "bottom":
            script = "window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });"
        elif dir_lower == "up":
            script = f"window.scrollBy({{ top: -{amount}, behavior: 'smooth' }});"
        else:
            script = f"window.scrollBy({{ top: {amount}, behavior: 'smooth' }});"

        await self.execute_javascript(script)

    async def get_page_title(self) -> str:
        """Returns the title of the active webpage."""
        page = await self.session.get_page()
        if page and not page.is_closed():
            try:
                title = await page.title()
                if title:
                    return title
            except Exception:
                pass
        return self.session.page_title

    async def get_current_url(self) -> str:
        """Returns the current URL of the active webpage."""
        page = await self.session.get_page()
        if page and not page.is_closed():
            return page.url
        return self.session.current_url

    async def get_page_content(self, text_only: bool = True) -> str:
        """Extracts text or HTML content from the active webpage for AI reasoning and inspection."""
        page = await self.session.get_page()
        if page and not page.is_closed():
            try:
                if text_only:
                    text = await page.evaluate("() => document.body ? document.body.innerText : ''")
                    return str(text or "")
                return await page.content()
            except Exception as exc:
                logger.warning("failed_to_extract_page_content", error=str(exc))
        raise RuntimeError("Aether Floating Browser is unavailable; external browser launch is disabled.")

    async def capture_screenshot(
        self,
        full_page: bool = False,
        filename: str | None = None,
    ) -> str:
        """
        Captures a screenshot of the active floating browser.
        Stores the image in memory and the screenshot database for the Files panel.
        """
        page = await self.session.get_page()
        if page and not page.is_closed():
            try:
                cdp_session = await page.context.new_cdp_session(page)
                try:
                    screenshot_params: dict[str, Any] = {
                        "format": "png",
                        "fromSurface": True,
                        "captureBeyondViewport": full_page,
                    }
                    if full_page:
                        dimensions = await page.evaluate(
                            """() => ({
                                width: Math.max(
                                    document.documentElement.scrollWidth,
                                    document.body?.scrollWidth ?? 0,
                                    window.innerWidth
                                ),
                                height: Math.max(
                                    document.documentElement.scrollHeight,
                                    document.body?.scrollHeight ?? 0,
                                    window.innerHeight
                                )
                            })"""
                        )
                        screenshot_params["clip"] = {
                            "x": 0,
                            "y": 0,
                            "width": dimensions["width"],
                            "height": dimensions["height"],
                            "scale": 1,
                        }
                    screenshot = await cdp_session.send(
                        "Page.captureScreenshot",
                        screenshot_params,
                    )
                    screenshot_bytes = base64.b64decode(screenshot["data"])
                finally:
                    try:
                        await cdp_session.detach()
                    except Exception as exc:
                        logger.warning("failed_to_detach_screenshot_cdp_session", error=str(exc))
                try:
                    title = (
                        filename
                        or (await page.title())
                        or self.session.page_title
                        or "Browser Screenshot"
                    )
                except Exception:
                    title = filename or self.session.page_title or "Browser Screenshot"
                try:
                    url = page.url or self.session.current_url
                except Exception:
                    url = self.session.current_url

                screenshot_id = str(uuid.uuid4())
                image_data = base64.b64encode(screenshot_bytes).decode("utf-8")
                await self.screenshot_store.record(
                    {
                        "id": screenshot_id,
                        "title": title,
                        "url": url,
                        "image_data": f"data:image/png;base64,{image_data}",
                        "full_page": full_page,
                        "size_bytes": len(screenshot_bytes),
                    }
                )
                logger.info(
                    "browser_screenshot_saved_to_files",
                    id=screenshot_id,
                    size_bytes=len(screenshot_bytes),
                )
                return (
                    f"Screenshot of '{title}' captured and saved. "
                    "You can view it in Files in the bottom dock."
                )
            except Exception as exc:
                logger.error("screenshot_capture_failed", error=str(exc))
                raise

        logger.error("[BROWSER_MANAGER] Screenshot refused: embedded Chromium unavailable", external_browser_launch="DISABLED")
        raise RuntimeError(
            "Aether Floating Browser is unavailable for screenshot capture; "
            "external browser automation is disabled."
        )
