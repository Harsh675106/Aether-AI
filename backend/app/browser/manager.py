import asyncio
from typing import Any
from playwright.async_api import async_playwright, Browser, Playwright

from app.core.settings import Settings
from app.core.logging import get_logger
from app.browser.exceptions import BrowserCrashException, BrowserException
from app.browser.schemas import BrowserStatus

logger = get_logger(__name__)


class BrowserManager:
    """Manages the lifecycle, startup, shutdown, and health recovery of the Playwright browser process."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None
        self._status: BrowserStatus = "closed"
        self._lock = asyncio.Lock()

    @property
    def status(self) -> BrowserStatus:
        return self._status

    @property
    def browser(self) -> Browser | None:
        return self._browser

    async def start(self) -> Browser:
        """Launches the Playwright browser process if it is not already running."""
        async with self._lock:
            if self._browser and self._browser.is_connected():
                return self._browser

            self._status = "starting"
            logger.info("browser_launching", headless=self._settings.browser_headless)
            try:
                if not self._playwright:
                    self._playwright = await async_playwright().start()

                # Launch Chromium (default) with standard robust options
                self._browser = await self._playwright.chromium.launch(
                    headless=self._settings.browser_headless,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-gpu",
                    ],
                    timeout=self._settings.browser_timeout,
                )
                self._status = "running"
                logger.info("browser_launched_successfully", status=self._status)

                # Set up a listener for disconnection/crashes
                self._browser.on("disconnected", self._handle_disconnection)

                return self._browser
            except Exception as exc:
                self._status = "closed"
                logger.error("browser_launch_failed", error=str(exc))
                raise BrowserException(f"Failed to launch browser: {exc}") from exc

    async def stop(self) -> None:
        """Closes the browser and stops Playwright."""
        async with self._lock:
            self._status = "closed"
            if self._browser:
                try:
                    logger.info("closing_browser_instance")
                    await self._browser.close()
                except Exception as exc:
                    logger.warning("error_closing_browser", error=str(exc))
                finally:
                    self._browser = None

            if self._playwright:
                try:
                    logger.info("stopping_playwright_instance")
                    await self._playwright.stop()
                except Exception as exc:
                    logger.warning("error_stopping_playwright", error=str(exc))
                finally:
                    self._playwright = None

    async def restart(self) -> Browser:
        """Stops the current browser process and launches a new one."""
        logger.info("restarting_browser_process")
        await self.stop()
        return await self.start()

    async def check_health_and_recover(self) -> Browser:
        """Verifies if the browser is still running and recovers it if it crashed."""
        if self._browser is None or not self._browser.is_connected() or self._status == "recovering":
            async with self._lock:
                if self._status == "recovering":
                    # Wait for concurrent recovery
                    while self._status == "recovering":
                        await asyncio.sleep(0.1)
                    if self._browser and self._browser.is_connected():
                        return self._browser

                logger.warning("browser_crash_or_disconnect_detected_initiating_recovery")
                self._status = "recovering"
                try:
                    # Clean up old references
                    if self._browser:
                        try:
                            await self._browser.close()
                        except Exception:
                            pass
                        self._browser = None

                    # Re-launch
                    if not self._playwright:
                        self._playwright = await async_playwright().start()

                    self._browser = await self._playwright.chromium.launch(
                        headless=self._settings.browser_headless,
                        args=["--no-sandbox", "--disable-dev-shm-usage"],
                        timeout=self._settings.browser_timeout,
                    )
                    self._browser.on("disconnected", self._handle_disconnection)
                    self._status = "running"
                    logger.info("browser_recovered_successfully")
                    return self._browser
                except Exception as exc:
                    self._status = "closed"
                    logger.error("browser_recovery_failed", error=str(exc))
                    raise BrowserCrashException(f"Browser crashed and recovery failed: {exc}") from exc

        return self._browser

    def _handle_disconnection(self, _: Any) -> None:
        """Internal callback when Playwright fires a disconnected event."""
        if self._status != "closed" and self._status != "recovering":
            logger.error("browser_disconnected_unexpectedly")
            self._status = "closed"
