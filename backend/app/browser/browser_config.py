"""
Browser Configuration & Session Profile Settings.

Supports configurable session modes:
- integrated: Isolated, persistent browser session within Aether.
- chrome_profile: Safe launch leveraging user's Chrome data dir if specified.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from app.core.settings import Settings


SessionMode = Literal["integrated", "chrome_profile"]


@dataclass
class BrowserConfig:
    """Configuration options for Aether browser module."""
    session_mode: SessionMode = "integrated"
    user_data_dir: Path | None = None
    headless: bool = False
    default_url: str = "https://www.google.com"
    window_width: int = 1000
    window_height: int = 700
    min_width: int = 400
    min_height: int = 300
    always_on_top: bool = False
    enable_media_controls: bool = True
    hardware_acceleration: bool = True

    @classmethod
    def from_settings(cls, settings: Settings) -> "BrowserConfig":
        """Instantiate config from application settings."""
        # Check standard Windows Chrome User Data directory
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        chrome_user_data = Path(local_app_data) / "Google" / "Chrome" / "User Data" if local_app_data else None

        user_data_dir = None
        if hasattr(settings, "browser_user_data_dir") and settings.browser_user_data_dir:
            user_data_dir = Path(settings.browser_user_data_dir)
        elif chrome_user_data and chrome_user_data.exists():
            user_data_dir = chrome_user_data

        return cls(
            session_mode=getattr(settings, "browser_session_mode", "integrated"),
            user_data_dir=user_data_dir,
            headless=getattr(settings, "browser_headless", False),
            default_url="https://www.google.com",
            always_on_top=False,
        )

