import datetime
import uuid
from pathlib import Path
from app.core.settings import Settings
from app.core.logging import get_logger
from app.browser.tab import TabManager
from app.browser.exceptions import BrowserException

logger = get_logger(__name__)


class ScreenshotService:
    """Provides screen capture capabilities for Aether browser actions."""

    def __init__(self, settings: Settings, tab_manager: TabManager) -> None:
        self._settings = settings
        self._tab_manager = tab_manager

    async def take_screenshot(
        self,
        *,
        full_page: bool = False,
        profile_name: str = "default"
    ) -> str:
        """
        Captures a screenshot of the active page.
        Returns:
            The absolute path to the saved screenshot file.
        """
        page = await self._tab_manager.get_active_page(profile_name)
        if not page:
            raise BrowserException("No active page available to take a screenshot")

        try:
            # Generate a clean timestamped filename
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            try:
                title = await page.title()
            except Exception:
                title = "page"
            
            # Make title filename safe
            safe_title = "".join(c for c in title if c.isalnum() or c in (" ", "_", "-")).strip()
            safe_title = safe_title.replace(" ", "_")[:30]
            
            suffix = f"_{safe_title}" if safe_title else f"_{str(uuid.uuid4())[:8]}"
            filename = f"screenshot_{timestamp}{suffix}.png"

            # Ensure screenshot folder exists
            screenshot_dir = Path(self._settings.browser_screenshot_dir)
            screenshot_dir.mkdir(parents=True, exist_ok=True)
            filepath = screenshot_dir / filename

            logger.info("capturing_page_screenshot", path=str(filepath), full_page=full_page)
            
            # Capture using Playwright Page API
            await page.screenshot(path=str(filepath), full_page=full_page)
            
            logger.info("screenshot_saved_successfully", path=str(filepath))
            return str(filepath)
            
        except Exception as exc:
            logger.error("failed_to_capture_screenshot", error=str(exc))
            raise BrowserException(f"Failed to capture screenshot: {exc}") from exc
