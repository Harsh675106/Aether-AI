import uuid
import asyncio
from typing import Any
from playwright.async_api import Page, BrowserContext

from app.core.logging import get_logger
from app.browser.context import BrowserContextManager
from app.browser.exceptions import BrowserException
from app.browser.schemas import TabInfo

logger = get_logger(__name__)


class TabManager:
    """Manages tabs (Pages) within a browser context, tracking active, closed, and pinned states."""

    def __init__(self, context_manager: BrowserContextManager) -> None:
        self._context_manager = context_manager
        # Mapping: profile_name -> {tab_id -> Page}
        self._tabs: dict[str, dict[str, Page]] = {}
        # Mapping: profile_name -> active_tab_id
        self._active_tab_ids: dict[str, str] = {}
        # Track pinned tab IDs: profile_name -> set(tab_id)
        self._pinned_tabs: dict[str, set[str]] = {}
        self._lock = asyncio.Lock()

    def _get_tabs_dict(self, profile: str) -> dict[str, Page]:
        if profile not in self._tabs:
            self._tabs[profile] = {}
        return self._tabs[profile]

    def _get_pinned_set(self, profile: str) -> set[str]:
        if profile not in self._pinned_tabs:
            self._pinned_tabs[profile] = set()
        return self._pinned_tabs[profile]

    async def open_tab(self, url: str | None = None, profile_name: str = "default") -> Page:
        """Opens a new tab (page) in the context of the given profile."""
        async with self._lock:
            context = await self._context_manager.get_or_create_context(profile_name)
            page = await context.new_page()

            tab_id = str(uuid.uuid4())
            # Attach custom attribute to playwright Page object
            setattr(page, "aether_tab_id", tab_id)

            tabs = self._get_tabs_dict(profile_name)
            tabs[tab_id] = page
            self._active_tab_ids[profile_name] = tab_id

            logger.info("tab_opened", tab_id=tab_id, profile=profile_name)

            # Auto cleanup when tab closes from browser-side
            def handle_close(_: Page) -> None:
                asyncio.create_task(self._remove_tab_async(tab_id, profile_name))

            page.on("close", handle_close)

            if url:
                try:
                    await page.goto(url)
                except Exception as exc:
                    logger.warning("tab_initial_navigation_failed", url=url, error=str(exc))

            return page

    async def _remove_tab_async(self, tab_id: str, profile_name: str) -> None:
        """Asynchronously cleans up a closed tab's tracking information."""
        async with self._lock:
            tabs = self._get_tabs_dict(profile_name)
            if tab_id in tabs:
                tabs.pop(tab_id, None)
                pinned = self._get_pinned_set(profile_name)
                pinned.discard(tab_id)
                logger.info("tab_removed_from_tracking", tab_id=tab_id, profile=profile_name)

                # Reset active tab if the closed tab was active
                if self._active_tab_ids.get(profile_name) == tab_id:
                    if tabs:
                        self._active_tab_ids[profile_name] = list(tabs.keys())[0]
                    else:
                        self._active_tab_ids.pop(profile_name, None)

    async def close_tab(self, tab_id: str | None = None, profile_name: str = "default") -> None:
        """Closes the specified tab, or the active tab if none is specified."""
        target_id = tab_id or self._active_tab_ids.get(profile_name)
        if not target_id:
            logger.warning("close_tab_called_but_no_tabs_exist", profile=profile_name)
            return

        tabs = self._get_tabs_dict(profile_name)
        page = tabs.get(target_id)
        if page:
            logger.info("closing_tab", tab_id=target_id, profile=profile_name)
            try:
                await page.close()
            except Exception as exc:
                logger.warning("error_closing_page_object", error=str(exc))

    async def switch_tab(self, tab_id: str, profile_name: str = "default") -> Page:
        """Switches the active tab pointer to the specified tab ID and focuses it."""
        async with self._lock:
            tabs = self._get_tabs_dict(profile_name)
            page = tabs.get(tab_id)
            if not page:
                raise BrowserException(f"Tab ID '{tab_id}' not found in profile '{profile_name}'")

            self._active_tab_ids[profile_name] = tab_id
            try:
                await page.bring_to_front()
            except Exception as exc:
                logger.warning("failed_to_bring_page_to_front", error=str(exc))
            return page

    async def duplicate_tab(self, tab_id: str | None = None, profile_name: str = "default") -> Page:
        """Duplicates an existing tab (opens new tab with the same URL)."""
        target_id = tab_id or self._active_tab_ids.get(profile_name)
        if not target_id:
            raise BrowserException(f"No tab available to duplicate in profile '{profile_name}'")

        tabs = self._get_tabs_dict(profile_name)
        source_page = tabs.get(target_id)
        if not source_page:
            raise BrowserException(f"Source tab '{target_id}' not found")

        current_url = source_page.url
        logger.info("duplicating_tab", tab_id=target_id, url=current_url)
        return await self.open_tab(url=current_url, profile_name=profile_name)

    async def pin_tab(self, tab_id: str, pin: bool = True, profile_name: str = "default") -> None:
        """Pins or unpins a tab."""
        tabs = self._get_tabs_dict(profile_name)
        if tab_id not in tabs:
            raise BrowserException(f"Tab ID '{tab_id}' not found")

        pinned = self._get_pinned_set(profile_name)
        if pin:
            pinned.add(tab_id)
            logger.info("tab_pinned", tab_id=tab_id)
        else:
            pinned.discard(tab_id)
            logger.info("tab_unpinned", tab_id=tab_id)

    async def list_tabs(self, profile_name: str = "default") -> list[TabInfo]:
        """Lists metadata of all open tabs in the given profile."""
        tabs = self._get_tabs_dict(profile_name)
        active_id = self._active_tab_ids.get(profile_name)
        pinned = self._get_pinned_set(profile_name)

        tab_list: list[TabInfo] = []
        for t_id, page in list(tabs.items()):
            try:
                title = page.title()
                url = page.url
                # Standard async call for title is non-blocking but let's gather safely
                tab_list.append(TabInfo(
                    id=t_id,
                    title=await title,
                    url=url,
                    is_active=(t_id == active_id),
                    is_pinned=(t_id in pinned)
                ))
            except Exception:
                # Tab might have been closed/stale
                continue
        return tab_list

    async def get_active_page(self, profile_name: str = "default") -> Page | None:
        """Returns the Playwright Page instance of the active tab."""
        active_id = self._active_tab_ids.get(profile_name)
        if not active_id:
            # Fall back to opening a tab if none exists
            logger.info("get_active_page_no_tabs_exist_creating_new_tab", profile=profile_name)
            return await self.open_tab(profile_name=profile_name)
        
        tabs = self._get_tabs_dict(profile_name)
        page = tabs.get(active_id)
        if not page or page.is_closed():
            # Clean up stale tab, try to find another tab
            self._active_tab_ids.pop(profile_name, None)
            if tabs:
                new_active = list(tabs.keys())[0]
                self._active_tab_ids[profile_name] = new_active
                return tabs[new_active]
            return await self.open_tab(profile_name=profile_name)

        return page

    async def get_active_tab_id(self, profile_name: str = "default") -> str | None:
        return self._active_tab_ids.get(profile_name)

    # Simple delegation navigation methods
    async def reload(self, profile_name: str = "default") -> None:
        page = await self.get_active_page(profile_name)
        if page:
            await page.reload()

    async def back(self, profile_name: str = "default") -> None:
        page = await self.get_active_page(profile_name)
        if page:
            await page.go_back()

    async def forward(self, profile_name: str = "default") -> None:
        page = await self.get_active_page(profile_name)
        if page:
            await page.go_forward()
