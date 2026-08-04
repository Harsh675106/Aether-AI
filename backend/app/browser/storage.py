from typing import Any
from app.core.logging import get_logger
from app.browser.context import BrowserContextManager
from app.browser.tab import TabManager
from app.browser.exceptions import BrowserException

logger = get_logger(__name__)


class StorageManager:
    """Provides read/write interfaces to Cookies, LocalStorage, and SessionStorage."""

    def __init__(self, context_manager: BrowserContextManager, tab_manager: TabManager) -> None:
        self._context_manager = context_manager
        self._tab_manager = tab_manager

    # --- Cookies ---

    async def get_cookies(self, profile_name: str = "default") -> list[dict[str, Any]]:
        """Retrieves all cookies from the context associated with the profile."""
        context = await self._context_manager.get_or_create_context(profile_name)
        cookies = await context.cookies()
        return [dict(c) for c in cookies]

    async def set_cookies(self, cookies: list[dict[str, Any]], profile_name: str = "default") -> None:
        """Sets cookies on the context associated with the profile."""
        context = await self._context_manager.get_or_create_context(profile_name)
        logger.info("setting_browser_cookies", count=len(cookies), profile=profile_name)
        await context.add_cookies(cookies)
        # Force persist to state file
        await self._context_manager.save_context_state(profile_name)

    async def clear_cookies(self, profile_name: str = "default") -> None:
        """Clears all cookies from the context associated with the profile."""
        context = await self._context_manager.get_or_create_context(profile_name)
        logger.info("clearing_browser_cookies", profile=profile_name)
        await context.clear_cookies()
        # Force persist to state file
        await self._context_manager.save_context_state(profile_name)

    # --- LocalStorage ---

    async def get_local_storage(self, profile_name: str = "default") -> dict[str, str]:
        """Evaluates and returns the active page's localStorage key-value dictionary."""
        page = await self._tab_manager.get_active_page(profile_name)
        if not page:
            raise BrowserException("No active page to read localStorage from")
        
        try:
            items = await page.evaluate("() => ({ ...localStorage })")
            return {str(k): str(v) for k, v in items.items()}
        except Exception as exc:
            logger.error("failed_to_get_local_storage", error=str(exc))
            raise BrowserException(f"Failed to read localStorage: {exc}") from exc

    async def set_local_storage(self, items: dict[str, str], profile_name: str = "default") -> None:
        """Sets key-value pairs in the active page's localStorage."""
        page = await self._tab_manager.get_active_page(profile_name)
        if not page:
            raise BrowserException("No active page to write localStorage to")
        
        try:
            logger.info("writing_local_storage_items", count=len(items))
            await page.evaluate(
                """(data) => {
                    for (const [key, value] of Object.entries(data)) {
                        localStorage.setItem(key, value);
                    }
                }""",
                items
            )
        except Exception as exc:
            logger.error("failed_to_set_local_storage", error=str(exc))
            raise BrowserException(f"Failed to write localStorage: {exc}") from exc

    # --- SessionStorage ---

    async def get_session_storage(self, profile_name: str = "default") -> dict[str, str]:
        """Evaluates and returns the active page's sessionStorage key-value dictionary."""
        page = await self._tab_manager.get_active_page(profile_name)
        if not page:
            raise BrowserException("No active page to read sessionStorage from")
        
        try:
            items = await page.evaluate("() => ({ ...sessionStorage })")
            return {str(k): str(v) for k, v in items.items()}
        except Exception as exc:
            logger.error("failed_to_get_session_storage", error=str(exc))
            raise BrowserException(f"Failed to read sessionStorage: {exc}") from exc

    async def set_session_storage(self, items: dict[str, str], profile_name: str = "default") -> None:
        """Sets key-value pairs in the active page's sessionStorage."""
        page = await self._tab_manager.get_active_page(profile_name)
        if not page:
            raise BrowserException("No active page to write sessionStorage to")
        
        try:
            logger.info("writing_session_storage_items", count=len(items))
            await page.evaluate(
                """(data) => {
                    for (const [key, value] of Object.entries(data)) {
                        sessionStorage.setItem(key, value);
                    }
                }""",
                items
            )
        except Exception as exc:
            logger.error("failed_to_set_session_storage", error=str(exc))
            raise BrowserException(f"Failed to write sessionStorage: {exc}") from exc
