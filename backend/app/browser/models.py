"""
Data models and schemas for the Browser module.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Literal
from pydantic import BaseModel, Field


class BrowserLayoutMode(str, Enum):
    INTEGRATED = "integrated"
    FLOATING = "floating"
    MINI = "mini"
    EXPANDED = "expanded"
    HIDDEN = "hidden"


class SnapPosition(str, Enum):
    TOP_LEFT = "top-left"
    TOP_RIGHT = "top-right"
    BOTTOM_LEFT = "bottom-left"
    BOTTOM_RIGHT = "bottom-right"
    LEFT_HALF = "left-half"
    RIGHT_HALF = "right-half"
    CENTER = "center"
    FREE = "free"


@dataclass
class WindowGeometry:
    x: int = 120
    y: int = 80
    width: int = 1000
    height: int = 700
    always_on_top: bool = False
    is_maximized: bool = False
    is_minimized: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height,
            "always_on_top": self.always_on_top,
            "is_maximized": self.is_maximized,
            "is_minimized": self.is_minimized,
        }


@dataclass
class MediaPlaybackState:
    is_media_active: bool = False
    is_playing: bool = False
    title: str = ""
    artist_or_channel: str = ""
    duration_seconds: float = 0.0
    current_time_seconds: float = 0.0
    volume: float = 1.0
    is_muted: bool = False
    is_fullscreen: bool = False
    playback_rate: float = 1.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "is_media_active": self.is_media_active,
            "is_playing": self.is_playing,
            "title": self.title,
            "artist_or_channel": self.artist_or_channel,
            "duration_seconds": self.duration_seconds,
            "current_time_seconds": self.current_time_seconds,
            "volume": self.volume,
            "is_muted": self.is_muted,
            "is_fullscreen": self.is_fullscreen,
            "playback_rate": self.playback_rate,
        }


class BrowserActionRequest(BaseModel):
    action: Literal[
        "open", "navigate", "back", "forward", "refresh",
        "show", "hide", "minimize", "maximize", "restore", "close",
        "snap", "float", "always_on_top", "play", "pause", "seek", "volume"
    ]
    url: str | None = None
    snap_position: SnapPosition | None = None
    always_on_top: bool | None = None
    volume: float | None = Field(default=None, ge=0.0, le=1.0)
    seek_seconds: float | None = None
    layout: BrowserLayoutMode | None = None

