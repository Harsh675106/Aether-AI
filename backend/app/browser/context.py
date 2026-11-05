import os
import asyncio
from pathlib import Path
from playwright.async_api import BrowserContext, Browser

from app.core.settings import Settings
from app.core.logging import get_logger
from app.browser.manager import BrowserManager
from app.browser.exceptions import BrowserException

logger = get_logger(__name__)


class BrowserContextManager:
    """Manages browser contexts (profiles, cookies, localStorage, sessionStorage)."""

    def __init__(self, settings: Settings, browser_manager: BrowserManager) -> None:
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

            # Ensure browser is running
            browser = await self._browser_manager.check_health_and_recover()

            logger.info("creating_browser_context", profile=profile_name)
            state_path = self.get_profile_path(profile_name)
            storage_state = str(state_path) if state_path.exists() else None

            # Visible Chromium should use the maximized native window. Headless runs
            # retain a deterministic viewport for automation and screenshots.
            context_kwargs: dict[str, object] = {
                "user_agent": self._settings.browser_user_agent,
                "accept_downloads": True,
            }
            if self._settings.browser_headless:
                context_kwargs["viewport"] = {
                    "width": self._settings.browser_viewport_width,
                    "height": self._settings.browser_viewport_height,
                }
            else:
                context_kwargs["no_viewport"] = True
            if storage_state:
                context_kwargs["storage_state"] = storage_state
                logger.info("loading_context_from_storage_state", path=storage_state)

            try:
                context = await browser.new_context(**context_kwargs)
                
                # Set default timeouts
                context.set_default_timeout(self._settings.browser_timeout)
                context.set_default_navigation_timeout(self._settings.browser_timeout)

                self._contexts[profile_name] = context
                return context
            except Exception as exc:
                logger.error("failed_to_create_context", error=str(exc))
                raise BrowserException(f"Failed to create context for profile '{profile_name}': {exc}") from exc

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
