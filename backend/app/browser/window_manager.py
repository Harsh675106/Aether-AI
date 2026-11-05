"""
High-Level Window Manager coordinating layouts, visibility, and snapping.
"""
from __future__ import annotations

from typing import Any
from app.browser.browser_events import BrowserEventDispatcher
from app.browser.browser_state import BrowserSystemState
from app.browser.floating_manager import FloatingWindowManager
from app.browser.models import BrowserLayoutMode, SnapPosition, WindowGeometry


class WindowManager:
    """Coordinates window layout modes (integrated, floating, mini, expanded, hidden) and snapping."""

    def __init__(self, event_dispatcher: BrowserEventDispatcher | None = None) -> None:
        self.state = BrowserSystemState()
        self.floating_mgr = FloatingWindowManager()
        self.event_dispatcher = event_dispatcher or BrowserEventDispatcher()

    async def set_layout(self, layout: BrowserLayoutMode) -> BrowserSystemState:
        """Transitions browser between Integrated, Floating, Mini, Expanded, and Hidden layouts."""
        prev_layout = self.state.layout
        self.state.layout = layout

        if layout == BrowserLayoutMode.HIDDEN:
            self.state.is_visible = False
        elif layout == BrowserLayoutMode.MINI:
            self.state.is_visible = True
            self.state.geometry.width = 480
            self.state.geometry.height = 320
        elif layout == BrowserLayoutMode.EXPANDED:
            self.state.is_visible = True
            self.state.geometry.width = 1400
            self.state.geometry.height = 900
        elif layout == BrowserLayoutMode.INTEGRATED:
            self.state.is_visible = True
        elif layout == BrowserLayoutMode.FLOATING:
            self.state.is_visible = True
            saved = self.floating_mgr.restore_state()
            self.state.geometry = saved

        await self.event_dispatcher.emit("layout_changed", {
            "previous_layout": prev_layout.value,
            "new_layout": layout.value,
            "geometry": self.state.geometry.to_dict(),
        })
        return self.state

    async def snap(self, position: SnapPosition) -> BrowserSystemState:
        """Snaps window to specified anchor position."""
        self.state.snap_position = position
        self.state.geometry = self.floating_mgr.calculate_snap_geometry(
            position, self.state.geometry
        )
        self.state.is_visible = True
        await self.event_dispatcher.emit("window_snapped", {
            "snap_position": position.value,
            "geometry": self.state.geometry.to_dict(),
        })
        return self.state

    async def toggle_visibility(self) -> BrowserSystemState:
        """Toggles between visible and hidden without destroying web session."""
        if not self.state.is_open:
            self.state.is_open = True
            self.state.is_visible = True
        else:
            self.state.is_visible = not self.state.is_visible

        await self.event_dispatcher.emit("visibility_toggled", {
            "is_visible": self.state.is_visible,
            "is_open": self.state.is_open,
        })
        return self.state

    async def set_always_on_top(self, enabled: bool) -> BrowserSystemState:
        """Toggles always on top behavior."""
        self.state.geometry.always_on_top = enabled
        await self.event_dispatcher.emit("always_on_top_changed", {"always_on_top": enabled})
        return self.state

