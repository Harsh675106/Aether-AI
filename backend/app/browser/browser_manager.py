"""
Aether Centralized Browser Manager.
The SINGLE CENTRALIZED BROWSER ENGINE for the entire Aether AI application.
Unifies all browser automation, window management, navigation, interactions,
and state into the existing Aether Floating Browser.
"""
from __future__ import annotations

import asyncio
from typing import Any

from app.browser.browser_automation import BrowserAutomation
from app.browser.browser_config import BrowserConfig
from app.browser.browser_controller import BrowserController
from app.browser.browser_events import BrowserEventDispatcher
from app.browser.browser_interaction import BrowserInteraction
from app.browser.browser_navigation import BrowserNavigation
from app.browser.browser_registry import set_global_browser_manager
from app.browser.browser_session import BrowserSessionManager
from app.browser.browser_state import BrowserSystemState
from app.browser.models import BrowserActionRequest, BrowserLayoutMode, SnapPosition
from app.browser.schemas import BrowserState, TabInfo
from app.core.logging import get_logger
from app.core.settings import Settings
from app.monitoring.service import MonitoringService

logger = get_logger(__name__)


class BrowserManager:
    """The Single Centralized Browser Manager for Aether AI.
    
    Provides a unified interface for all browser operations across voice, chat,
    planner, AI tools, background tasks, and future YouTube agent automation.
    """

    _instance: BrowserManager | None = None

    @classmethod
    def get_instance(
        cls,
        settings: Settings,
        monitoring_service: MonitoringService | None = None,
        screenshot_store: Any | None = None,
    ) -> BrowserManager:
        """Returns or creates the master singleton BrowserManager."""
        if cls._instance is None:
            cls._instance = cls(
                settings=settings,
                monitoring_service=monitoring_service,
                screenshot_store=screenshot_store,
            )
        return cls._instance

    def __init__(
        self,
        settings: Settings,
        monitoring_service: MonitoringService | None = None,
        screenshot_store: Any | None = None,
    ) -> None:
        self.settings = settings
        self.monitoring_service = monitoring_service
        self.screenshot_store = screenshot_store
        self.config = BrowserConfig.from_settings(settings)

        # 1. Event Dispatcher & Telemetry
        self.events = BrowserEventDispatcher(monitoring_service)

        # 2. Window Controller & Layouts
        self.controller = BrowserController(settings, monitoring_service)

        # 3. Session Manager (connects directly to embedded Chromium via CDP on 9222)
        self.session = BrowserSessionManager(settings)

        # 4. Modular Sub-Components
        self.navigation = BrowserNavigation(self.session, self.controller)
        self.automation = BrowserAutomation(self.session, settings, screenshot_store)
        self.interaction = BrowserInteraction(self.session)

        # Register globally
        set_global_browser_manager(self)
        logger.info("centralized_browser_manager_initialized")

    # -------------------------------------------------------------------------
    # Core Centralized Interface (Required by Section 2 & 3)
    # -------------------------------------------------------------------------

    async def open_browser(self, url: str = "https://www.google.com") -> str:
        """Opens or navigates the active Aether Floating Browser to the requested URL."""
        logger.info("browser_open_requested", target=url)
        target = self.navigation.normalize_url(url)
        await self.controller.handle_action(BrowserActionRequest(action="open", url=target))
        return await self.navigation.navigate(target)

    async def navigate(self, url: str) -> str:
        """Navigates the existing floating browser directly to the requested URL."""
        return await self.navigation.navigate(url)

    async def search(self, query: str, engine: str = "google") -> str:
        """Searches the internet using the active floating browser."""
        return await self.navigation.search(query, engine=engine)

    async def go_back(self) -> None:
        """Navigates back in the active floating browser history."""
        await self.navigation.go_back()

    async def go_forward(self) -> None:
        """Navigates forward in the active floating browser history."""
        await self.navigation.go_forward()

    async def refresh(self) -> None:
        """Reloads the active webpage in the floating browser."""
        await self.navigation.refresh()

    async def minimize(self) -> None:
        """Hides the floating browser window without terminating the session or losing tabs."""
        await self.controller.handle_action(BrowserActionRequest(action="minimize"))

    async def restore(self) -> None:
        """Restores the floating browser window with its existing webpage and session intact."""
        await self.controller.handle_action(BrowserActionRequest(action="restore"))

    async def maximize(self) -> None:
        """Expands the floating browser to full dimensions."""
        await self.controller.handle_action(BrowserActionRequest(action="maximize"))

    async def set_floating(self, enabled: bool = True) -> None:
        """Toggles between floating layout mode and integrated docked mode."""
        mode = BrowserLayoutMode.FLOATING if enabled else BrowserLayoutMode.INTEGRATED
        await self.controller.window_manager.set_layout(mode)

    async def set_always_on_top(self, enabled: bool) -> None:
        """Controls whether the floating browser stays pinned above other windows."""
        await self.controller.handle_action(BrowserActionRequest(action="always_on_top", always_on_top=enabled))

    async def execute_javascript(self, script: str) -> Any:
        """Executes JavaScript inside the active floating browser rendering context."""
        return await self.automation.execute_javascript(script)

    async def click_element(self, selector: str) -> bool:
        """Clicks an element matching the selector in the active floating browser."""
        return await self.interaction.click_element(selector)

    async def type_text(self, selector: str, text: str) -> bool:
        """Types text into an element matching the selector in the active floating browser."""
        return await self.interaction.type_text(selector, text)

    async def scroll(self, direction: str = "down", amount: int = 500) -> None:
        """Scrolls the active floating browser webpage ('down', 'up', 'top', 'bottom')."""
        await self.automation.scroll(direction=direction, amount=amount)

    async def get_page_title(self) -> str:
        """Returns the title of the active webpage."""
        return await self.automation.get_page_title()

    async def get_current_url(self) -> str:
        """Returns the URL of the active webpage."""
        return await self.automation.get_current_url()

    def set_active_page(self, url: str, tab_id: str | None = None) -> None:
        """Synchronizes the selected native browser tab with CDP automation."""
        self.session.set_active_page(url, tab_id)

    async def get_page_content(self, text_only: bool = True) -> str:
        """Extracts text or HTML from the active floating browser page."""
        return await self.automation.get_page_content(text_only=text_only)

    async def capture_screenshot(self, full_page: bool = False, filename: str | None = None) -> str:
        """Captures a screenshot of the active floating browser."""
        return await self.automation.capture_screenshot(full_page=full_page, filename=filename)

    async def close_browser(self) -> None:
        """Closes or hides the floating browser window."""
        await self.controller.handle_action(BrowserActionRequest(action="close"))

    # -------------------------------------------------------------------------
    # YouTube Integration Compatibility (Section 8)
    # -------------------------------------------------------------------------

    async def youtube_search(self, query: str) -> str:
        """Searches YouTube directly inside the active floating browser."""
        return await self.navigation.search(query, engine="youtube")

    async def youtube_open_video(self, video_id_or_url: str) -> str:
        """Navigates the floating browser directly to a YouTube video."""
        if "youtube.com" in video_id_or_url or "youtu.be" in video_id_or_url:
            url = video_id_or_url
        else:
            url = f"https://www.youtube.com/watch?v=s{video_id_or_url}"
        return await self.navigate(url)

    async def youtube_play(self) -> bool:
        """Resumes playback of the active YouTube video via DOM control."""
        try:
            await self.execute_javascript(
                "const video = document.querySelector('video'); if (video) video.play();"
            )
            return True
        except Exception:
            return False

    async def youtube_pause(self) -> bool:
        """Pauses playback of the active YouTube video via DOM control."""
        try:
            await self.execute_javascript(
                "const video = document.querySelector('video'); if (video) video.pause();"
            )
            return True
        except Exception:
            return False

    async def get_youtube_video_info(self) -> dict[str, Any]:
        """Extracts current video metadata from the active YouTube page."""
        try:
            res = await self.execute_javascript(
                """(() => {
                    const video = document.querySelector('video');
                    const titleEl = document.querySelector('h1.ytd-watch-metadata') || document.querySelector('title');
                    return {
                        title: titleEl ? titleEl.innerText : document.title,
                        duration: video ? video.duration : 0,
                        currentTime: video ? video.currentTime : 0,
                        paused: video ? video.paused : true,
                        volume: video ? video.volume : 1,
                        muted: video ? video.muted : false
                    };
                })()"""
            )
            return res if isinstance(res, dict) else {}
        except Exception:
            return {}

    # -------------------------------------------------------------------------
    # Backward-Compatible Facade for Legacy BrowserService & Tests
    # -------------------------------------------------------------------------

    @property
    def window_manager(self) -> Any:
        return self.controller.window_manager

    @property
    def browser_manager(self) -> BrowserManager:
        return self

    def is_running(self) -> bool:
        """Returns True if the browser subsystem is ready or open."""
        return self.controller.window_manager.state.is_open or self.session.is_connected

    async def start(self) -> Any:
        """Connects to the floating browser session."""
        await self.session.connect()
        return self.session._browser

    async def stop(self) -> None:
        """Stops the session."""
        await self.session.disconnect()

    async def restart(self) -> Any:
        """Restarts the session connection."""
        await self.stop()
        return await self.start()

    async def initialize(self, profile_name: str = "default") -> None:
        """Initializes connection to the floating browser."""
        await self.session.connect()

    async def open_url(self, url_or_query: str, *, profile_name: str = "default") -> BrowserState:
        """Compatibility method for open_url returning BrowserState."""
        final_url = await self.open_browser(url_or_query)
        title = await self.get_page_title()
        return BrowserState(
            is_running=True,
            current_url=final_url,
            page_title=title,
            tab_count=1,
            active_tab_id="tab-1",
        )

    async def screenshot(self, full_page: bool = False, profile_name: str = "default") -> str:
        """Compatibility method for screenshot."""
        return await self.capture_screenshot(full_page=full_page)

    async def click(self, selector: str) -> None:
        """Compatibility method for click."""
        await self.click_element(selector)

    async def type(self, selector: str, text: str) -> None:
        """Compatibility method for type."""
        await self.type_text(selector, text)

    async def close(self) -> None:
        """Compatibility method for close."""
        await self.close_browser()

    async def get_state(self, profile_name: str = "default") -> BrowserState:
        """Returns the consolidated state."""
        url = await self.get_current_url()
        title = await self.get_page_title()
        return BrowserState(
            is_running=self.is_running(),
            current_url=url,
            page_title=title,
            tab_count=1,
            active_tab_id="tab-1",
        )
