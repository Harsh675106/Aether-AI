"""
Floating Window Geometry & Always-on-top Manager.
"""
from __future__ import annotations

from app.browser.models import SnapPosition, WindowGeometry


class FloatingWindowManager:
    """Calculates coordinates, dimensions, bounds, and layout geometry for floating windows."""

    # Default monitor assumptions if OS monitor dimensions are not injected
    DEFAULT_SCREEN_WIDTH = 1920
    DEFAULT_SCREEN_HEIGHT = 1080

    def __init__(self, screen_width: int = 1920, screen_height: int = 1080) -> None:
        self.screen_width = screen_width
        self.screen_height = screen_height
        self._saved_geometry = WindowGeometry(x=120, y=80, width=1000, height=700)

    def calculate_snap_geometry(
        self,
        position: SnapPosition,
        current_geom: WindowGeometry,
    ) -> WindowGeometry:
        """Returns new WindowGeometry for a requested snap anchor."""
        w, h = self.screen_width, self.screen_height

        if position == SnapPosition.TOP_LEFT:
            return WindowGeometry(x=20, y=20, width=int(w * 0.48), height=int(h * 0.46), always_on_top=current_geom.always_on_top)
        elif position == SnapPosition.TOP_RIGHT:
            width = int(w * 0.48)
            return WindowGeometry(x=int(w - width - 20), y=20, width=width, height=int(h * 0.46), always_on_top=current_geom.always_on_top)
        elif position == SnapPosition.BOTTOM_LEFT:
            height = int(h * 0.46)
            return WindowGeometry(x=20, y=int(h - height - 40), width=int(w * 0.48), height=height, always_on_top=current_geom.always_on_top)
        elif position == SnapPosition.BOTTOM_RIGHT:
            width = int(w * 0.48)
            height = int(h * 0.46)
            return WindowGeometry(x=int(w - width - 20), y=int(h - height - 40), width=width, height=height, always_on_top=current_geom.always_on_top)
        elif position == SnapPosition.LEFT_HALF:
            return WindowGeometry(x=10, y=10, width=int(w * 0.5) - 20, height=h - 50, always_on_top=current_geom.always_on_top)
        elif position == SnapPosition.RIGHT_HALF:
            width = int(w * 0.5) - 20
            return WindowGeometry(x=int(w * 0.5) + 10, y=10, width=width, height=h - 50, always_on_top=current_geom.always_on_top)
        elif position == SnapPosition.CENTER:
            width = min(1200, int(w * 0.75))
            height = min(800, int(h * 0.75))
            return WindowGeometry(x=int((w - width) / 2), y=int((h - height) / 2), width=width, height=height, always_on_top=current_geom.always_on_top)

        return current_geom

    def save_state(self, geom: WindowGeometry) -> None:
        if not geom.is_maximized and not geom.is_minimized:
            self._saved_geometry = WindowGeometry(
                x=geom.x, y=geom.y, width=geom.width, height=geom.height, always_on_top=geom.always_on_top
            )

    def restore_state(self) -> WindowGeometry:
        return self._saved_geometry

