"""
Unified Browser Controller coordinating window state, navigation, events, and backend services.
"""
from __future__ import annotations

from typing import Any
from app.browser.browser_config import BrowserConfig
from app.browser.browser_events import BrowserEventDispatcher
from app.browser.browser_state import BrowserSystemState
from app.browser.models import BrowserActionRequest, BrowserLayoutMode, SnapPosition
from app.browser.service import BrowserService
from app.browser.window_manager import WindowManager
from app.core.settings import Settings
from app.monitoring.service import MonitoringService


class BrowserController:
    """Master controller orchestrating browser state, layouts, and automation."""

    def __init__(
        self,
        settings: Settings,
        monitoring_service: MonitoringService | None = None,
        browser_service: BrowserService | None = None,
    ) -> None:
        self.settings = settings
        self.config = BrowserConfig.from_settings(settings)
        self.event_dispatcher = BrowserEventDispatcher(monitoring_service)
        self.window_manager = WindowManager(self.event_dispatcher)
        self.browser_service = browser_service

    async def handle_action(self, request: BrowserActionRequest) -> BrowserSystemState:
        """Processes high-level browser actions (voice, UI, or API driven)."""
        action = request.action

        if action in ("open", "navigate"):
            target_url = request.url or self.config.default_url
            self.window_manager.state.current_url = target_url
            self.window_manager.state.is_open = True
            self.window_manager.state.is_visible = True
            self.window_manager.state.history.append(target_url)

            await self.event_dispatcher.emit("navigated", {
                "url": target_url,
                "action": action,
            })

            # If Playwright browser service is attached, also load in background session
            if self.browser_service and self.browser_service.browser_manager.is_running():
                try:
                    await self.browser_service.open_url(target_url)
                except Exception:
                    pass

        elif action == "show":
            self.window_manager.state.is_open = True
            self.window_manager.state.is_visible = True
            await self.event_dispatcher.emit("shown", {})

        elif action in ("hide", "minimize"):
            self.window_manager.state.is_visible = False
            await self.event_dispatcher.emit("hidden", {})

        elif action == "restore":
            self.window_manager.state.is_visible = True
            await self.event_dispatcher.emit("restored", {})

        elif action == "maximize":
            await self.window_manager.set_layout(BrowserLayoutMode.EXPANDED)

        elif action == "close":
            self.window_manager.state.is_open = False
            self.window_manager.state.is_visible = False
            await self.event_dispatcher.emit("closed", {})

        elif action == "snap" and request.snap_position:
            await self.window_manager.snap(request.snap_position)

        elif action == "float":
            await self.window_manager.set_layout(BrowserLayoutMode.FLOATING)

        elif action == "always_on_top" and request.always_on_top is not None:
            await self.window_manager.set_always_on_top(request.always_on_top)

        elif action == "play":
            self.window_manager.state.media.is_playing = True
            await self.event_dispatcher.emit("media_play", {})

        elif action == "pause":
            self.window_manager.state.media.is_playing = False
            await self.event_dispatcher.emit("media_pause", {})

        elif action == "volume" and request.volume is not None:
            self.window_manager.state.media.volume = request.volume
            await self.event_dispatcher.emit("media_volume", {"volume": request.volume})

        return self.window_manager.state

    def get_state(self) -> dict[str, Any]:
        return self.window_manager.state.to_dict()

