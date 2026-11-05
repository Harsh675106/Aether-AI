"""
Browser state tracking and synchronization.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from app.browser.models import BrowserLayoutMode, MediaPlaybackState, SnapPosition, WindowGeometry
from app.browser.state import BrowserStateManager


@dataclass
class BrowserSystemState:
    """Consolidated state of the entire browser subsystem."""
    is_open: bool = False
    is_visible: bool = False
    current_url: str = "https://www.google.com"
    page_title: str = "New Tab"
    layout: BrowserLayoutMode = BrowserLayoutMode.FLOATING
    snap_position: SnapPosition = SnapPosition.FREE
    geometry: WindowGeometry = field(default_factory=WindowGeometry)
    media: MediaPlaybackState = field(default_factory=MediaPlaybackState)
    can_go_back: bool = False
    can_go_forward: bool = False
    is_loading: bool = False
    history: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "is_open": self.is_open,
            "is_visible": self.is_visible,
            "current_url": self.current_url,
            "page_title": self.page_title,
            "layout": self.layout.value,
            "snap_position": self.snap_position.value,
            "geometry": self.geometry.to_dict(),
            "media": self.media.to_dict(),
            "can_go_back": self.can_go_back,
            "can_go_forward": self.can_go_forward,
            "is_loading": self.is_loading,
            "history": self.history[-30:],
        }

