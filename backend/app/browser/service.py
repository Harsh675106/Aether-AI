from typing import Any
from app.core.settings import Settings
from app.core.logging import get_logger
from app.monitoring.service import MonitoringService
from app.browser.browser_manager import BrowserManager
from app.browser.schemas import BrowserState, TabInfo

logger = get_logger(__name__)


class BrowserService:
    """Compatibility facade for the one embedded Aether Floating Browser.

    This class intentionally creates no Playwright browser, context, tab, or
    renderer.  New callers should depend on ``BrowserManager`` directly.
    """

    def __init__(
        self,
        settings: Settings,
        monitoring_service: MonitoringService | None = None,
        screenshot_store: Any = None,
    ) -> None:
        self.settings = settings
        self.monitoring_service = monitoring_service

        self.browser_manager = BrowserManager.get_instance(
            settings, monitoring_service, screenshot_store
        )

    async def initialize(self, profile_name: str = "default") -> None:
        """Initializes the browser and ensures a context and active tab exist."""
        logger.info("[BROWSER_MANAGER] Attaching to Aether Floating Browser", external_browser_launch="DISABLED")
        await self.browser_manager.initialize(profile_name)

    async def open_url(self, url_or_query: str, *, profile_name: str = "default") -> BrowserState:
        """Opens a URL or triggers search query fallback in the active browser tab."""
        return await self.browser_manager.open_url(url_or_query, profile_name=profile_name)

    async def screenshot(self, *, full_page: bool = False, profile_name: str = "default") -> str:
        """Captures a screenshot of the active browser tab and returns the saved file path."""
        return await self.browser_manager.screenshot(full_page=full_page, profile_name=profile_name)

    async def get_state(self, profile_name: str = "default") -> BrowserState:
        """Returns the consolidated state metrics of the browser."""
        return await self.browser_manager.get_state(profile_name)

    async def close(self) -> None:
        """Saves states and shuts down the browser and contexts completely."""
        await self.browser_manager.stop()

    # --- Interaction Utilities for Future Modules ---

    async def click(self, selector: str, *, profile_name: str = "default") -> None:
        """Clicks an element matching the selector on the active page."""
        await self.browser_manager.click(selector)

    async def type(self, selector: str, text: str, *, profile_name: str = "default") -> None:
        """Types text into an element matching the selector on the active page."""
        await self.browser_manager.type(selector, text)

    async def get_page_content(self, *, profile_name: str = "default") -> str:
        """Returns the text content of the active page."""
        return await self.browser_manager.get_page_content(text_only=False)

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
