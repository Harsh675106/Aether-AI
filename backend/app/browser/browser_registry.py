"""
Centralized Browser Registry.
Maintains the master singleton reference to BrowserManager so that all routes,
agents, tools, and background tasks communicate with the same browser instance.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from app.browser.browser_manager import BrowserManager

_GLOBAL_BROWSER_MANAGER: BrowserManager | None = None


def get_global_browser_manager() -> BrowserManager | None:
    """Returns the globally registered active BrowserManager instance."""
    return _GLOBAL_BROWSER_MANAGER


def set_global_browser_manager(manager: BrowserManager) -> None:
    """Registers the active master BrowserManager."""
    global _GLOBAL_BROWSER_MANAGER
    _GLOBAL_BROWSER_MANAGER = manager

