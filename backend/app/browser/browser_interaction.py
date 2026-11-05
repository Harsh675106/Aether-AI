"""
Centralized Browser Interaction module.
Direct element clicking, typing, form input, and selection on the Aether Floating Browser.
"""
from __future__ import annotations

from typing import Any
from app.core.logging import get_logger

logger = get_logger(__name__)


class BrowserInteraction:
    """Handles DOM interactions, clicks, and text inputs for the floating browser."""

    def __init__(self, session_manager: Any) -> None:
        self.session = session_manager

    async def click_element(self, selector: str) -> bool:
        """Clicks an element matching the given CSS/XPath selector."""
        logger.info("browser_interaction_clicking", selector=selector)
        page = await self.session.get_page()
        if page and not page.is_closed():
            try:
                await page.click(selector, timeout=5000)
                return True
            except Exception as exc:
                logger.warning("click_element_failed", selector=selector, error=str(exc))
                # Attempt JavaScript fallback click
                try:
                    await page.evaluate(f"document.querySelector('{selector}')?.click()")
                    return True
                except Exception:
                    raise exc
        logger.warning("no_active_page_for_click", selector=selector)
        return False

    async def type_text(self, selector: str, text: str, *, clear_first: bool = False) -> bool:
        """Types text into an input or textarea matching the selector."""
        logger.info("browser_interaction_typing", selector=selector, text_len=len(text))
        page = await self.session.get_page()
        if page and not page.is_closed():
            try:
                if clear_first:
                    await page.fill(selector, "")
                await page.type(selector, text, timeout=5000)
                return True
            except Exception as exc:
                logger.warning("type_text_failed", selector=selector, error=str(exc))
                # Attempt JavaScript fallback fill
                try:
                    sanitized = text.replace("'", "\\'").replace("\n", "\\n")
                    await page.evaluate(
                        f"""(() => {{
                            const el = document.querySelector('{selector}');
                            if (el) {{
                                el.value = '{sanitized}';
                                el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                                el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                            }}
                        }})()"""
                    )
                    return True
                except Exception:
                    raise exc
        logger.warning("no_active_page_for_type", selector=selector)
        return False

    async def hover(self, selector: str) -> bool:
        """Hovers over the element matching the selector."""
        page = await self.session.get_page()
        if page and not page.is_closed():
            try:
                await page.hover(selector, timeout=5000)
                return True
            except Exception as exc:
                logger.warning("hover_failed", selector=selector, error=str(exc))
        return False

    async def press_key(self, key: str) -> bool:
        """Presses a keyboard key (e.g. 'Enter', 'Escape', 'Tab', 'Space')."""
        page = await self.session.get_page()
        if page and not page.is_closed():
            try:
                await page.keyboard.press(key)
                return True
            except Exception as exc:
                logger.warning("press_key_failed", key=key, error=str(exc))
        return False

