import asyncio
from pathlib import Path
from typing import TYPE_CHECKING
from playwright.async_api import BrowserContext, Browser

from app.core.settings import Settings
from app.core.logging import get_logger
from app.browser.exceptions import BrowserException

if TYPE_CHECKING:
    from app.browser.browser_manager import BrowserManager

logger = get_logger(__name__)


class BrowserContextManager:
    """Manages browser contexts (profiles, cookies, localStorage, sessionStorage)."""

    def __init__(self, settings: Settings, browser_manager: "BrowserManager") -> None:
        self._settings = settings
        self._browser_manager = browser_manager
        # Track context by profile name
        self._contexts: dict[str, BrowserContext] = {}
        self._lock = asyncio.Lock()

    def get_profile_path(self, profile_name: str) -> Path:
        """Returns the absolute file path where the storage state of a profile is stored."""
        profiles_dir = Path(self._settings.browser_user_data_dir)
        profiles_dir.mkdir(parents=True, exist_ok=True)
        return profiles_dir / f"{profile_name}_state.json"

    async def get_or_create_context(self, profile_name: str = "default") -> BrowserContext:
        """Retrieves an existing context or creates a new one, loading cookies/storage state if available."""
        async with self._lock:
            # Check if active
            context = self._contexts.get(profile_name)
            if context:
                try:
                    # Test if context is still active (e.g. check open pages)
                    context.pages
                    return context
                except Exception:
                    logger.warning("tracked_context_stale_discarding", profile=profile_name)
                    self._contexts.pop(profile_name, None)

            # A context must already belong to the embedded Floating Browser.
            # Creating one here would create an independent automation session.
            session = getattr(self._browser_manager, "session", None)
            page = await session.get_page() if session else None
            if not page or page.is_closed():
                raise BrowserException(
                    "Aether Floating Browser is unavailable; external browser launch is disabled."
                )
            context = page.context
            self._contexts[profile_name] = context
            logger.info("using_existing_embedded_browser_context", profile=profile_name)
            return context

    async def save_context_state(self, profile_name: str = "default") -> None:
        """Saves the context cookies and storage state to a persistent state file."""
        context = self._contexts.get(profile_name)
        if not context:
            logger.debug("no_active_context_to_save", profile=profile_name)
            return

        state_path = self.get_profile_path(profile_name)
        try:
            logger.info("saving_context_storage_state", profile=profile_name, path=str(state_path))
            await context.storage_state(path=str(state_path))
        except Exception as exc:
            logger.error("failed_to_save_context_state", profile=profile_name, error=str(exc))

    async def close_context(self, profile_name: str = "default") -> None:
        """Saves context state and closes the context."""
        async with self._lock:
            context = self._contexts.pop(profile_name, None)
            if not context:
                return

            try:
                # Save state before closing
                state_path = self.get_profile_path(profile_name)
                await context.storage_state(path=str(state_path))
                logger.info("saved_and_closing_context", profile=profile_name)
                await context.close()
            except Exception as exc:
                logger.warning("error_closing_context", profile=profile_name, error=str(exc))

    async def close_all_contexts(self) -> None:
        """Saves and closes all open contexts."""
        profiles = list(self._contexts.keys())
        for profile in profiles:
            await self.close_context(profile)
