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
            "browser_screenshot",
            "browser_click",
            "browser_type",
            "browser_back",
            "browser_forward",
            "browser_reload",
            "browser_close_tab",
        ]

    async def execute_tool(self, name: str, args: dict[str, Any], browser_service: Any) -> Any:
        """Executes a registered tool against the browser service facade."""
        logger.info("executing_browser_tool", tool_name=name, args=args)
        
        # Ensure target is valid
        tools = await self.list_tools()
        if name not in tools:
            raise ValueError(f"Tool '{name}' is not registered or authorized.")

        # Dispatch execution
        if name == "browser_open":
            url = args.get("url") or args.get("url_or_query") or args.get("target")
            if not url:
                raise ValueError("Argument 'url' is required for browser_open.")
            return await browser_service.open_url(url)
            
        elif name == "browser_screenshot":
            full_page = bool(args.get("full_page", False))
            return await browser_service.screenshot(full_page=full_page)
            
        elif name == "browser_click":
            selector = args.get("selector")
            if not selector:
                raise ValueError("Argument 'selector' is required for browser_click.")
            await browser_service.click(selector)
            return f"Clicked element matching selector '{selector}'"
            
        elif name == "browser_type":
            selector = args.get("selector")
            text = args.get("text")
            if not selector or text is None:
                raise ValueError("Arguments 'selector' and 'text' are required for browser_type.")
            await browser_service.type(selector, text)
            return f"Typed text into element matching selector '{selector}'"
            
        elif name == "browser_back":
            await browser_service.tab_manager.back()
            return "Navigated back in browser history"
            
        elif name == "browser_forward":
            await browser_service.tab_manager.forward()
            return "Navigated forward in browser history"
            
        elif name == "browser_reload":
            await browser_service.tab_manager.reload()
            return "Reloaded active browser page"
            
        elif name == "browser_close_tab":
            await browser_service.tab_manager.close_tab()
            return "Closed active browser tab"
            
        raise NotImplementedError(f"Tool execution logic for '{name}' is not defined.")
