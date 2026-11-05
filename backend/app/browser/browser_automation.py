"""
Centralized Browser Automation module.
JavaScript execution, scrolling, DOM inspection, text extraction, and screenshots
running directly on the active Aether Floating Browser session.
"""
from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any

from app.core.logging import get_logger
from app.core.settings import Settings

logger = get_logger(__name__)


class BrowserAutomation:
    """Provides centralized automation capabilities on the active floating browser instance."""

    def __init__(self, session_manager: Any, settings: Settings, screenshot_store: Any | None = None) -> None:
        self.session = session_manager
        self.settings = settings
        self.screenshot_store = screenshot_store

    async def execute_javascript(self, script: str) -> Any:
        """Executes JavaScript safely in the context of the active floating webpage."""
        logger.debug("executing_browser_javascript", script_length=len(script))
        page = await self.session.get_page()
        if page and not page.is_closed():
            return await page.evaluate(script)
        logger.warning("no_active_page_for_javascript_execution")
        return None

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
        return ""

    async def capture_screenshot(
        self,
        full_page: bool = False,
        filename: str | None = None,
    ) -> str:
        """
        Captures a screenshot of the active floating browser.
        Saves locally and registers with ScreenshotStore if available.
        """
        out_dir = Path(self.settings.browser_screenshot_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        if not filename:
            filename = f"browser_{int(time.time() * 1000)}.png"
        filepath = out_dir / filename

        page = await self.session.get_page()
        if page and not page.is_closed():
            try:
                await page.screenshot(path=str(filepath), full_page=full_page)
                logger.info("browser_screenshot_saved", filepath=str(filepath))

                if self.screenshot_store:
                    try:
                        await self.screenshot_store.add_screenshot(
                            filename=filename,
                            url=self.session.current_url,
                            metadata={"full_page": full_page, "title": self.session.page_title},
                        )
                    except Exception as exc:
                        logger.warning("failed_to_register_screenshot_in_store", error=str(exc))

                return str(filepath)
            except Exception as exc:
                logger.error("screenshot_capture_failed", error=str(exc))
                raise

        # Fallback dummy 1x1 png if browser not attached via CDP
        try:
            import base64
            # 1x1 transparent png
            dummy_png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")
            filepath.write_bytes(dummy_png)
            return str(filepath)
        except Exception:
            return str(filepath)

