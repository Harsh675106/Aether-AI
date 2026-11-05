from collections.abc import Sequence
from typing import Any

from app.core.interfaces import ToolManager
from app.core.logging import get_logger

logger = get_logger(__name__)


class PlaceholderToolManager(ToolManager):
    """Manages browser and system tool definitions and routes tool executions."""

    async def list_tools(self) -> Sequence[str]:
        """Returns the list of registered tools."""
        return [
            "browser_open",
            "browser_navigate",
            "browser_search",
            "browser_screenshot",
            "browser_click",
            "browser_type",
            "browser_scroll",
            "browser_back",
            "browser_forward",
            "browser_reload",
            "browser_minimize",
            "browser_restore",
            "browser_maximize",
            "browser_close",
            "browser_close_tab",
            "browser_get_content",
            "browser_youtube_search",
            "browser_youtube_play",
            "browser_youtube_pause",
        ]

    async def execute_tool(self, name: str, args: dict[str, Any], browser_service: Any) -> Any:
        """Executes a registered tool against the centralized BrowserManager."""
        logger.info("executing_browser_tool", tool_name=name, args=args)

        tools = await self.list_tools()
        if name not in tools:
            raise ValueError(f"Tool '{name}' is not registered or authorized.")

        # Dispatch execution to the Centralized BrowserManager
        if name in ("browser_open", "browser_navigate"):
            url = args.get("url") or args.get("url_or_query") or args.get("target")
            if not url:
                raise ValueError("Argument 'url' is required for browser_open.")
            return await browser_service.open_browser(url)

        elif name == "browser_search":
            query = args.get("query") or args.get("text") or args.get("target") or ""
            return await browser_service.search(query)

        elif name == "browser_screenshot":
            full_page = bool(args.get("full_page", False))
            return await browser_service.capture_screenshot(full_page=full_page)

        elif name == "browser_click":
            selector = args.get("selector") or args.get("target")
            if not selector:
                raise ValueError("Argument 'selector' is required for browser_click.")
            await browser_service.click_element(selector)
            return f"Clicked element matching selector '{selector}'"

        elif name == "browser_type":
            selector = args.get("selector")
            text = args.get("text")
            if not selector or text is None:
                raise ValueError("Arguments 'selector' and 'text' are required for browser_type.")
            await browser_service.type_text(selector, text)
            return f"Typed text into element matching selector '{selector}'"

        elif name == "browser_scroll":
            direction = args.get("direction", "down")
            amount = int(args.get("amount", 500))
            await browser_service.scroll(direction=direction, amount=amount)
            return f"Scrolled browser {direction}"

        elif name == "browser_back":
            await browser_service.go_back()
            return "Navigated back in browser history"

        elif name == "browser_forward":
            await browser_service.go_forward()
            return "Navigated forward in browser history"

        elif name == "browser_reload":
            await browser_service.refresh()
            return "Reloaded active browser page"

        elif name == "browser_minimize":
            await browser_service.minimize()
            return "Browser window minimized"

        elif name == "browser_restore":
            await browser_service.restore()
            return "Browser window restored"

        elif name == "browser_maximize":
            await browser_service.maximize()
            return "Browser window maximized"

        elif name in ("browser_close", "browser_close_tab"):
            await browser_service.close_browser()
            return "Closed browser window"

        elif name == "browser_get_content":
            return await browser_service.get_page_content()

        elif name == "browser_youtube_search":
            query = args.get("query") or args.get("target") or ""
            return await browser_service.youtube_search(query)

        elif name == "browser_youtube_play":
            await browser_service.youtube_play()
            return "Resumed YouTube playback"

        elif name == "browser_youtube_pause":
            await browser_service.youtube_pause()
            return "Paused YouTube playback"

        raise NotImplementedError(f"Tool execution logic for '{name}' is not defined.")
