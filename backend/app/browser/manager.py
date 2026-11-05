"""Compatibility import for the one Aether Floating Browser manager.

This module intentionally contains no Playwright launch API.  It remains only so
older imports resolve to the authoritative embedded-browser manager.
"""
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.browser.browser_manager import BrowserManager


def __getattr__(name: str):
    if name == "BrowserManager":
        # Delayed to avoid a cycle with legacy state/context type imports.
        from app.browser.browser_manager import BrowserManager
        return BrowserManager
    raise AttributeError(name)


__all__ = ["BrowserManager"]
