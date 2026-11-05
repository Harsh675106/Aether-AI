"""
Centralized Browser Session Manager.
Connects directly to the existing Aether Floating Browser embedded Chromium instance
over Chrome DevTools Protocol (CDP) without launching external browser applications.
"""
from __future__ import annotations

import asyncio
from typing import Any
from playwright.async_api import Browser, BrowserContext, Page, async_playwright

from app.core.logging import get_logger
from app.core.settings import Settings

logger = get_logger(__name__)


class BrowserSessionManager:
    """Manages the active session and CDP connection to the Aether Floating Browser."""

    def __init__(self, settings: Settings, cdp_url: str = "http://127.0.0.1:9222") -> None:
        self.settings = settings
        self.cdp_url = cdp_url
        self._playwright: Any = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None
        self._is_cdp_connected: bool = False
        self._lock = asyncio.Lock()
        self._current_url: str = "https://www.google.com"
        self._page_title: str = "Google"

    @property
    def is_connected(self) -> bool:
        return self._is_cdp_connected and self._page is not None

    @property
    def current_url(self) -> str:
        if self._page and not self._page.is_closed():
            try:
                return self._page.url
            except Exception:
                pass
        return self._current_url

    @property
    def page_title(self) -> str:
        return self._page_title

    async def get_page(self) -> Page | None:
        """Returns the active Page connected to the floating browser, attempting connection if needed."""
        if self._page and not self._page.is_closed():
            return self._page
        await self.connect()
        return self._page

    async def connect(self) -> bool:
        """Connects to the embedded Chromium WebView2 instance via CDP port 9222."""
        async with self._lock:
            if self._page and not self._page.is_closed():
                return True

            try:
                if not self._playwright:
                    self._playwright = await async_playwright().start()

                logger.info("connecting_to_floating_browser_cdp", cdp_url=self.cdp_url)
                # Connect to the existing embedded Chromium instance — NO external browser launched!
                self._browser = await self._playwright.chromium.connect_over_cdp(
                    self.cdp_url,
                    timeout=2500,
                )
                self._is_cdp_connected = True

                contexts = self._browser.contexts
                if contexts:
                    self._context = contexts[0]
                else:
                    self._context = await self._browser.new_context()

                pages = self._context.pages
                if pages:
                    self._page = pages[0]
                else:
                    self._page = await self._context.new_page()

                self._current_url = self._page.url
                self._page_title = await self._page.title()
                logger.info(
                    "connected_to_floating_browser_successfully",
                    current_url=self._current_url,
                    title=self._page_title,
                )
                return True

            except Exception as exc:
                self._is_cdp_connected = False
                logger.debug("cdp_connection_not_available_using_controller_bridge", error=str(exc))
                return False

    def update_url(self, url: str, title: str | None = None) -> None:
        """Updates internal URL & title tracking (used when synchronized via API or events)."""
        self._current_url = url
        if title:
            self._page_title = title

    async def get_cookies(self) -> list[dict[str, Any]]:
        """Returns cookies from the active browser session."""
        if self._context:
            try:
                return await self._context.cookies()
            except Exception as exc:
                logger.warning("failed_to_get_cookies", exc_info=exc)
        return []

    async def disconnect(self) -> None:
        """Gracefully disconnects from the CDP session without closing the user's floating browser."""
        async with self._lock:
            self._is_cdp_connected = False
            self._page = None
            self._context = None
            if self._browser:
                try:
                    await self._browser.close()
                except Exception:
                    pass
                self._browser = None
            if self._playwright:
                try:
                    await self._playwright.stop()
                except Exception:
                    pass
                self._playwright = None
            logger.info("disconnected_from_floating_browser_session")

