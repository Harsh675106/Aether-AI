"""
Centralized Browser Navigation module.
Direct top-level navigation, URL normalization, search queries, and history control
for the Aether Floating Browser.
"""
from __future__ import annotations

import re
import urllib.parse
from typing import Any

from app.core.logging import get_logger
from app.core.settings import Settings

logger = get_logger(__name__)


class BrowserNavigation:
    """Coordinates direct top-level navigation for the Aether Floating Browser."""

    DOMAIN_REGEX = re.compile(
        r'^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}(?::\d+)?(?:/?|[/?]\S*)?$',
        re.IGNORECASE,
    )

    def __init__(self, session_manager: Any, controller: Any | None = None) -> None:
        self.session = session_manager
        self.controller = controller

    def normalize_url(self, target: str) -> str:
        """
        Normalizes a user query or website target to a direct top-level URL.
        Example:
            'youtube.com' -> 'https://www.youtube.com'
            'google' -> 'https://www.google.com'
            'python tutorials' -> 'https://www.google.com/search?q=python+tutorials'
        """
        stripped = target.strip()
        if not stripped:
            return "https://www.google.com"

        # Shortcut names
        site_shortcuts = {
            "youtube": "https://www.youtube.com",
            "youtube.com": "https://www.youtube.com",
            "google": "https://www.google.com",
            "github": "https://www.github.com",
            "github.com": "https://www.github.com",
            "wikipedia": "https://www.wikipedia.org",
            "reddit": "https://www.reddit.com",
            "twitter": "https://twitter.com",
            "x": "https://x.com",
        }
        if stripped.lower() in site_shortcuts:
            return site_shortcuts[stripped.lower()]

        # Has explicit scheme
        if stripped.startswith(("http://", "https://")):
            return stripped

        # Looks like a bare domain (e.g. youtube.com, github.com/foo)
        if self.DOMAIN_REGEX.match(stripped) or ("." in stripped and " " not in stripped):
            return f"https://{stripped}"

        # Otherwise treat as a search query
        query = urllib.parse.quote_plus(stripped)
        return f"https://www.google.com/search?q={query}"

    async def navigate(self, url_or_query: str) -> str:
        """Navigates the floating browser directly to the requested URL."""
        target_url = self.normalize_url(url_or_query)
        logger.info("[BROWSER_MANAGER] Operation: Navigate", target=target_url, execution_target="Embedded Chromium", external_browser_launch="DISABLED")

        # 1. If CDP connected to the floating browser, navigate the active page
        page = await self.session.get_page()
        if page and not page.is_closed():
            try:
                await page.goto(target_url, wait_until="domcontentloaded", timeout=15000)
                self.session.update_url(page.url, await page.title())
            except Exception as exc:
                raise RuntimeError(f"Embedded Chromium navigation failed: {exc}") from exc
        else:
            raise RuntimeError("Aether Floating Browser is unavailable; external browser launch is disabled.")

        # 2. Update controller state and history
        if self.controller:
            from app.browser.models import BrowserActionRequest
            await self.controller.handle_action(BrowserActionRequest(action="navigate", url=target_url))

        return target_url

    async def search(self, query: str, engine: str = "google") -> str:
        """Searches via Google/YouTube in the floating browser."""
        encoded = urllib.parse.quote_plus(query)
        if engine.lower() == "youtube":
            url = f"https://www.youtube.com/results?search_query={encoded}"
        else:
            url = f"https://www.google.com/search?q={encoded}"
        return await self.navigate(url)

    async def go_back(self) -> None:
        """Navigates back in history."""
        page = await self.session.get_page()
        if page and not page.is_closed():
            try:
                await page.go_back(wait_until="domcontentloaded", timeout=10000)
                self.session.update_url(page.url, await page.title())
                return
            except Exception as exc:
                raise RuntimeError(f"Embedded Chromium back navigation failed: {exc}") from exc
        raise RuntimeError("Aether Floating Browser is unavailable; external browser launch is disabled.")

    async def go_forward(self) -> None:
        """Navigates forward in history."""
        page = await self.session.get_page()
        if page and not page.is_closed():
            try:
                await page.go_forward(wait_until="domcontentloaded", timeout=10000)
                self.session.update_url(page.url, await page.title())
                return
            except Exception as exc:
                raise RuntimeError(f"Embedded Chromium forward navigation failed: {exc}") from exc
        raise RuntimeError("Aether Floating Browser is unavailable; external browser launch is disabled.")

    async def refresh(self) -> None:
        """Reloads the active page."""
        page = await self.session.get_page()
        if page and not page.is_closed():
            try:
                await page.reload(wait_until="domcontentloaded", timeout=10000)
                self.session.update_url(page.url, await page.title())
                return
            except Exception as exc:
                raise RuntimeError(f"Embedded Chromium reload failed: {exc}") from exc
        raise RuntimeError("Aether Floating Browser is unavailable; external browser launch is disabled.")

