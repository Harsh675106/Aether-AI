from typing import Any
from playwright.async_api import Page, BrowserContext

from app.core.settings import Settings
from app.core.logging import get_logger
from app.monitoring.service import MonitoringService
from app.browser.manager import BrowserManager
from app.browser.context import BrowserContextManager
from app.browser.tab import TabManager
from app.browser.navigation import NavigationManager
from app.browser.state import BrowserStateManager
from app.browser.screenshot import ScreenshotService
from app.browser.download import DownloadManager
from app.browser.storage import StorageManager
from app.browser.schemas import BrowserState, TabInfo

logger = get_logger(__name__)


class BrowserService:
    """The unified entry point and facade for all browser actions in Aether AI.
    
    Coordinates browser lifecycle, tabs, navigation, cookies, screenshots, downloads, and storage.
    """

    def __init__(self, settings: Settings, monitoring_service: MonitoringService | None = None) -> None:
        self.settings = settings
        self.monitoring_service = monitoring_service

        # Instantiate modular sub-managers
        self.browser_manager = BrowserManager(settings)
        self.context_manager = BrowserContextManager(settings, self.browser_manager)
        self.tab_manager = TabManager(self.context_manager)
        self.navigation_manager = NavigationManager(settings, self.tab_manager)
        self.state_manager = BrowserStateManager(self.browser_manager, self.tab_manager)
        self.screenshot_service = ScreenshotService(settings, self.tab_manager)
        self.download_manager = DownloadManager(settings)
        self.storage_manager = StorageManager(self.context_manager, self.tab_manager)

    async def initialize(self, profile_name: str = "default") -> None:
        """Initializes the browser and ensures a context and active tab exist."""
        logger.info("initializing_browser_service", profile=profile_name)
        
        # Publish monitoring event
        await self._publish_monitor_event(
            event_type="browser.initialize",
            title="Browser Service Initializing",
            description="Launching Playwright Chromium process...",
            details={"profile": profile_name}
        )

        try:
            # 1. Start browser
            await self.browser_manager.start()
            
            # 2. Start context
            context = await self.context_manager.get_or_create_context(profile_name)
            
            # 3. Register download manager on context
            self.download_manager.register_context(context)

            # 4. Open initial tab if no tabs are currently open
            tabs = await self.tab_manager.list_tabs(profile_name)
            if not tabs:
                await self.tab_manager.open_tab(profile_name=profile_name)

            await self._publish_monitor_event(
                event_type="browser.initialize",
                title="Browser Service Ready",
                description="Chromium instance launched and default context created.",
                status="complete",
                details={"profile": profile_name}
            )
        except Exception as exc:
            await self._publish_monitor_event(
                event_type="browser.initialize",
                title="Browser Service Launch Failed",
                description=f"Initialization error: {exc}",
                status="error",
                severity="critical"
            )
            raise

    async def open_url(self, url_or_query: str, *, profile_name: str = "default") -> BrowserState:
        """Opens a URL or triggers search query fallback in the active browser tab."""
        # Ensure browser is initialized
        await self.initialize(profile_name)

        await self._publish_monitor_event(
            event_type="browser.navigation",
            title="Browser Navigating",
            description=f"Opening address or query: {url_or_query}",
            details={"target": url_or_query, "profile": profile_name}
        )

        try:
            await self.navigation_manager.open_url(url_or_query, profile_name=profile_name)
            
            state = await self.state_manager.get_state(profile_name)
            await self._publish_monitor_event(
                event_type="browser.navigation",
                title="Browser Navigation Completed",
                description=f"Successfully loaded page: {state.current_title or state.current_url}",
                status="complete",
                details=state.model_dump()
            )
            return state
        except Exception as exc:
            await self._publish_monitor_event(
                event_type="browser.navigation",
                title="Browser Navigation Failed",
                description=f"Error navigating: {exc}",
                status="error",
                severity="error"
            )
            raise

    async def screenshot(self, *, full_page: bool = False, profile_name: str = "default") -> str:
        """Captures a screenshot of the active browser tab and returns the saved file path."""
        await self._publish_monitor_event(
            event_type="browser.screenshot",
            title="Browser Capturing Screenshot",
            description=f"Taking {'full page' if full_page else 'viewport'} screenshot...",
            details={"full_page": full_page, "profile": profile_name}
        )
        try:
            filepath = await self.screenshot_service.take_screenshot(full_page=full_page, profile_name=profile_name)
            await self._publish_monitor_event(
                event_type="browser.screenshot",
                title="Browser Screenshot Saved",
                description=f"Saved to disk: {filepath}",
                status="complete",
                details={"filepath": filepath}
            )
            return filepath
        except Exception as exc:
            await self._publish_monitor_event(
                event_type="browser.screenshot",
                title="Browser Screenshot Failed",
                description=f"Error capturing: {exc}",
                status="error",
                severity="error"
            )
            raise

    async def get_state(self, profile_name: str = "default") -> BrowserState:
        """Returns the consolidated state metrics of the browser."""
        return await self.state_manager.get_state(profile_name)

    async def close(self) -> None:
        """Saves states and shuts down the browser and contexts completely."""
        logger.info("shutting_down_browser_service")
        await self._publish_monitor_event(
            event_type="browser.shutdown",
            title="Browser Service Shutting Down",
            description="Closing all pages, persistent contexts, and browser threads."
        )
        try:
            await self.context_manager.close_all_contexts()
            await self.browser_manager.stop()
            await self._publish_monitor_event(
                event_type="browser.shutdown",
                title="Browser Service Offline",
                description="Browser process shutdown complete.",
                status="complete"
            )
        except Exception as exc:
            logger.warning("error_during_browser_shutdown", error=str(exc))

    # --- Interaction Utilities for Future Modules ---

    async def click(self, selector: str, *, profile_name: str = "default") -> None:
        """Clicks an element matching the selector on the active page."""
        page = await self.tab_manager.get_active_page(profile_name)
        if not page:
            raise Exception("No active page to click on")
        
        await self._publish_monitor_event(
            event_type="browser.click",
            title="Browser Element Click",
            description=f"Clicking element: {selector}",
            details={"selector": selector}
        )
        await page.click(selector, timeout=self.settings.browser_timeout)

    async def type(self, selector: str, text: str, *, profile_name: str = "default") -> None:
        """Types text into an element matching the selector on the active page."""
        page = await self.tab_manager.get_active_page(profile_name)
        if not page:
            raise Exception("No active page to type on")

        await self._publish_monitor_event(
            event_type="browser.type",
            title="Browser Element Type",
            description=f"Typing into element: {selector}",
            details={"selector": selector, "text_len": len(text)}
        )
        await page.fill(selector, text, timeout=self.settings.browser_timeout)

    async def get_page_content(self, *, profile_name: str = "default") -> str:
        """Returns the text content of the active page."""
        page = await self.tab_manager.get_active_page(profile_name)
        if not page:
            return ""
        return await page.content()

    # --- Helper Monitoring Publisher ---

    async def _publish_monitor_event(
        self,
        event_type: str,
        title: str,
        description: str,
        status: str = "running",
        severity: str = "info",
        details: dict[str, Any] | None = None
    ) -> None:
        if self.monitoring_service:
            await self.monitoring_service.publish_event(
                event_type=event_type,
                subsystem="browser",
                severity=severity,
                category="workflow",
                title=title,
                description=description,
                status=status,
                details=details
            )
