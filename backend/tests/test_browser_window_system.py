"""
Synchronous Unit Tests for Browser Window System.
"""
from app.browser.browser_config import BrowserConfig
from app.browser.floating_manager import FloatingWindowManager
from app.browser.models import BrowserActionRequest, BrowserLayoutMode, SnapPosition, WindowGeometry
from app.browser.window_manager import WindowManager
from app.core.settings import Settings


def test_floating_window_manager_snaps():
    fwm = FloatingWindowManager(screen_width=1920, screen_height=1080)
    current = WindowGeometry(x=100, y=100, width=800, height=600)

    # Test Left Half
    left_snap = fwm.calculate_snap_geometry(SnapPosition.LEFT_HALF, current)
    assert left_snap.x == 10
    assert left_snap.width == int(1920 * 0.5) - 20

    # Test Right Half
    right_snap = fwm.calculate_snap_geometry(SnapPosition.RIGHT_HALF, current)
    assert right_snap.x > 900

    # Test Center
    center_snap = fwm.calculate_snap_geometry(SnapPosition.CENTER, current)
    assert center_snap.width > 0
    assert center_snap.height > 0


def test_browser_config():
    cfg = BrowserConfig()
    assert cfg.default_url == "https://www.google.com"
    assert cfg.window_width == 1000
    assert cfg.window_height == 700
    assert cfg.min_width == 400
    assert cfg.min_height == 300
    assert cfg.always_on_top is False


def test_models_and_enums():
    assert BrowserLayoutMode.INTEGRATED.value == "integrated"
    assert BrowserLayoutMode.FLOATING.value == "floating"
    assert BrowserLayoutMode.MINI.value == "mini"
    assert BrowserLayoutMode.EXPANDED.value == "expanded"
    assert BrowserLayoutMode.HIDDEN.value == "hidden"

    req = BrowserActionRequest(action="snap", snap_position=SnapPosition.TOP_LEFT)
    assert req.action == "snap"
    assert req.snap_position == SnapPosition.TOP_LEFT
