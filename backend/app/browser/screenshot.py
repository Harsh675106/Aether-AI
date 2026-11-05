from __future__ import annotations

import base64
import datetime
import uuid
from typing import Any

from app.browser.exceptions import BrowserException
from app.browser.screenshot_store import ScreenshotStore
from app.browser.tab import TabManager
from app.core.logging import get_logger
from app.core.settings import Settings

logger = get_logger(__name__)


class ScreenshotService:
    """Provides screen capture capabilities for Aether browser actions.
    
    Stores screenshots in memory/database (similar to image search), 
    avoiding cluttering codebase files on disk.
    """

    def __init__(
        self,
        settings: Settings,
        tab_manager: TabManager,
        store: ScreenshotStore | None = None,
    ) -> None:
        self._settings = settings
        self._tab_manager = tab_manager
        self._store = store or ScreenshotStore(settings=settings)

    @property
    def store(self) -> ScreenshotStore:
        return self._store

    async def take_screenshot(
        self,
        *,
        full_page: bool = False,
        profile_name: str = "default",
    ) -> str:
        """Captures a screenshot of the active page directly in memory without saving to the codebase disk.
        
        Returns:
            Friendly confirmation message indicating the screenshot is stored in memory.
        """
        page = await self._tab_manager.get_active_page(profile_name)
        if not page:
            raise BrowserException("No active page available to take a screenshot")

        try:
            try:
                title = (await page.title()) or "Active Browser Page"
            except Exception:
                title = "Active Browser Page"

            try:
                current_url = page.url or ""
            except Exception:
                current_url = ""

            logger.info("capturing_page_screenshot_in_memory", title=title, url=current_url, full_page=full_page)

            # Capture directly into memory bytes via Playwright
            screenshot_bytes: bytes = await page.screenshot(full_page=full_page)

            # Encode as base64 data URL
            base64_str = base64.b64encode(screenshot_bytes).decode("utf-8")
            image_data = f"data:image/png;base64,{base64_str}"

            screenshot_id = str(uuid.uuid4())
            await self._store.record(
                {
                    "id": screenshot_id,
                    "title": title,
                    "url": current_url,
                    "image_data": image_data,
                    "full_page": full_page,
                    "size_bytes": len(screenshot_bytes),
                }
            )

            logger.info(
                "screenshot_saved_in_memory_successfully",
                id=screenshot_id,
                size_bytes=len(screenshot_bytes),
            )
            return f"Screenshot of '{title}' successfully captured and saved in memory. You can view and manage it under Files in the bottom dock."

        except Exception as exc:
            logger.error("failed_to_capture_screenshot", error=str(exc))
            raise BrowserException(f"Failed to capture screenshot: {exc}") from exc

    async def list_screenshots(self, limit: int = 50) -> list[dict[str, Any]]:
        """Lists captured screenshots from memory."""
        return await self._store.list_recent(limit=limit)

    async def get_screenshot(self, screenshot_id: str) -> dict[str, Any] | None:
        """Retrieves a single captured screenshot from memory."""
        return await self._store.get(screenshot_id)

    async def delete_screenshot(self, screenshot_id: str) -> bool:
        """Deletes a captured screenshot from memory."""
        return await self._store.delete(screenshot_id)
