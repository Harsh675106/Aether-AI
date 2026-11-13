"""
Centralized Browser Session Manager.
Connects directly to the existing Aether Floating Browser embedded Chromium instance
over Chrome DevTools Protocol (CDP) without launching external browser applications.
"""
from __future__ import annotations

import asyncio
from typing import Any
from urllib.parse import urlsplit, urlunsplit
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
        self._active_url: str | None = None
        self._active_tab_id: str | None = None

    @property
    def is_connected(self) -> bool:
        return self._is_cdp_connected and self._page is not None

    @property
    def current_url(self) -> str:
        if self._active_url:
            return self._active_url
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
        """Returns the page matching the active floating-browser tab."""
        if not self._browser or not self._is_cdp_connected:
            if not await self.connect():
                return None

        if self._active_url:
            active_key = self._url_key(self._active_url)
            for attempt in range(10):
                pages = self._open_pages()
                matching_page = next(
                    (page for page in pages if self._url_key(page.url) == active_key),
                    None,
                )
                if matching_page:
                    self._set_active_page(matching_page)
                    return matching_page
                if attempt < 9:
                    await asyncio.sleep(0.1)
            logger.error(
                "active_browser_tab_not_found",
                url=self._active_url,
                tab_id=self._active_tab_id,
            )
            return None

        pages = self._open_pages()
        if not pages:
            self._page = None
            self._context = None
            return None

        if self._page in pages:
            return self._page

        browser_pages = [
            page
            for page in pages
            if not page.url.startswith(("http://localhost", "tauri://", "about:blank"))
        ]
        if not browser_pages:
            return None

        self._set_active_page(browser_pages[-1])
        return self._page

    def _open_pages(self) -> list[Page]:
        if not self._browser:
            return []
        return [
            page
            for context in self._browser.contexts
            for page in context.pages
            if not page.is_closed()
        ]

    def set_active_page(self, url: str, tab_id: str | None = None) -> None:
        """Sets the floating-browser tab that subsequent automation should target."""
        self._active_url = url
        self._active_tab_id = tab_id
        page = self._find_page_for_url(url)
        if page is not None:
            self._set_active_page(page)

    def _find_page_for_url(self, url: str) -> Page | None:
        if not self._browser:
            return None
        url_key = self._url_key(url)
        return next(
            (
                page
                for context in self._browser.contexts
                for page in context.pages
                if not page.is_closed() and self._url_key(page.url) == url_key
            ),
            None,
        )

    def _set_active_page(self, page: Page) -> None:
        self._page = page
        self._context = page.context
        self._current_url = page.url
        self._active_url = page.url

    @staticmethod
    def _url_key(url: str) -> str:
        parsed = urlsplit(url)
        path = parsed.path.rstrip("/") or "/"
        return urlunsplit(
            (
                parsed.scheme.lower(),
                parsed.netloc.lower(),
                path,
                parsed.query,
                "",
            )
        )

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

                # A CDP attachment is observation/control of the *already rendered*
                # Aether webview.  Creating a context or page here would be a second
                # automation surface, which is expressly forbidden.
                contexts = self._browser.contexts
                pages = [page for context in contexts for page in context.pages if not page.is_closed()]
                if not pages:
                    raise RuntimeError("Aether Floating Browser has no active embedded page")

                # WebView2 exposes both Aether's UI and its child browser view over
                # CDP.  The external page is the authoritative floating browser.
                if self._active_url:
                    self._page = next(
                        (
                            page
                            for page in pages
                            if self._url_key(page.url) == self._url_key(self._active_url)
                        ),
                        None,
                    )
                if self._page is None:
                    self._page = next(
                        (
                            page
                            for page in pages
                            if not page.url.startswith(
                                ("http://localhost", "tauri://", "about:blank")
                            )
                        ),
                        pages[-1],
                    )
                self._context = self._page.context

                self._current_url = self._page.url
                self._page_title = await self._page.title()
                logger.info(
                    "[BROWSER_MANAGER] Active instance: Aether Floating Browser",
                    current_url=self._current_url,
                    title=self._page_title,
                    execution_target="Embedded Chromium",
                    external_browser_launch="DISABLED",
                )
                return True

            except Exception as exc:
                self._is_cdp_connected = False
                logger.warning(
                    "[BROWSER_MANAGER] Embedded Chromium unavailable; external browser launch is DISABLED",
                    error=str(exc),
                )
                return False

    def update_url(self, url: str, title: str | None = None) -> None:
        """Updates internal URL & title tracking (used when synchronized via API or events)."""
        self._current_url = url
        self._active_url = url
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
