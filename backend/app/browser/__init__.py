"""
Aether AI Centralized Browser Subsystem.

Provides centralized web automation, window control, navigation, interactions,
and event monitoring for the single Aether Floating Browser.
"""
from app.browser.browser_automation import BrowserAutomation
from app.browser.browser_config import BrowserConfig
from app.browser.browser_controller import BrowserController
from app.browser.browser_events import BrowserEventDispatcher
from app.browser.browser_interaction import BrowserInteraction
from app.browser.browser_manager import BrowserManager
from app.browser.browser_navigation import BrowserNavigation
from app.browser.browser_registry import get_global_browser_manager, set_global_browser_manager
from app.browser.browser_session import BrowserSessionManager
from app.browser.browser_state import BrowserSystemState
from app.browser.floating_manager import FloatingWindowManager
from app.browser.models import BrowserActionRequest, BrowserLayoutMode, SnapPosition, WindowGeometry
from app.browser.service import BrowserService
from app.browser.window_manager import WindowManager

__all__ = [
    "BrowserAutomation",
    "BrowserConfig",
    "BrowserController",
    "BrowserEventDispatcher",
    "BrowserInteraction",
    "BrowserManager",
    "BrowserNavigation",
    "BrowserRegistry",
    "BrowserSessionManager",
    "BrowserSystemState",
    "FloatingWindowManager",
    "BrowserActionRequest",
    "BrowserLayoutMode",
    "SnapPosition",
    "WindowGeometry",
    "BrowserService",
    "WindowManager",
    "get_global_browser_manager",
    "set_global_browser_manager",
]
