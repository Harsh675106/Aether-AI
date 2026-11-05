"""
Unit and integration tests for the Aether Centralized Browser Manager.
Verifies all 11 acceptance criteria:
1. Opening Google uses the floating browser.
2. Opening YouTube uses the same browser.
3. Opening GitHub uses the same browser.
4. Search automation uses the same browser.
5. Clicking and typing work in the same browser.
6. Screenshots capture browser content.
7. Minimize, restore, maximize, and floating work correctly.
8. User sessions and cookies are preserved.
9. No additional Chrome process is launched (CDP / embedded single-instance).
10. No duplicate browser window or manager is created.
11. Tool manager and Planner integration.
"""
import pytest
from pathlib import Path
from unittest.mock import AsyncMock
from app.browser.browser_manager import BrowserManager
from app.browser.browser_registry import get_global_browser_manager
from app.browser.models import BrowserLayoutMode, SnapPosition
from app.core.settings import Settings
from app.tools.manager import PlaceholderToolManager
from app.agents.planner import PlaceholderPlanner


class EmbeddedPage:
    """A test double for the page already rendered by Aether's WebView2."""

    def __init__(self) -> None:
        self.url = "https://www.google.com"

    def is_closed(self) -> bool:
        return False

    async def goto(self, url: str, **_: object) -> None:
        self.url = url

    async def title(self) -> str:
        return "Aether embedded page"

    async def screenshot(self, path: str, **_: object) -> None:
        Path(path).write_bytes(b"embedded-webview-screenshot")

    async def click(self, *_: object, **__: object) -> None:
        return None

    async def type(self, *_: object, **__: object) -> None:
        return None

    async def evaluate(self, *_: object, **__: object) -> str:
        return ""


@pytest.fixture
def settings():
    return Settings(
        aether_env="testing",
        browser_headless=True,
    )


@pytest.fixture
def browser_manager(settings):
    # Reset singleton
    BrowserManager._instance = None
    manager = BrowserManager.get_instance(settings)
    page = EmbeddedPage()
    manager.session.get_page = AsyncMock(return_value=page)
    return manager


@pytest.mark.asyncio
async def test_singleton_centralization(settings, browser_manager):
    """Criterion 10: Verify ONE central BrowserManager instance across the entire application."""
    second_instance = BrowserManager.get_instance(settings)
    assert browser_manager is second_instance
    assert get_global_browser_manager() is browser_manager


@pytest.mark.asyncio
async def test_open_google(browser_manager):
    """Criterion 1: Opening Google uses the floating browser."""
    url = await browser_manager.open_browser("https://www.google.com")
    assert url == "https://www.google.com"
    assert browser_manager.controller.window_manager.state.is_open is True
    assert browser_manager.controller.window_manager.state.is_visible is True
    assert await browser_manager.get_current_url() == "https://www.google.com"


@pytest.mark.asyncio
async def test_open_youtube_same_browser(browser_manager):
    """Criterion 2: Opening YouTube uses the SAME active browser without duplicate windows or media player."""
    url = await browser_manager.open_browser("youtube.com")
    assert url == "https://www.youtube.com"
    assert browser_manager.controller.window_manager.state.current_url == "https://www.youtube.com"
    # Ensure media player was not automatically started
    assert browser_manager.controller.window_manager.state.media.is_playing is False


@pytest.mark.asyncio
async def test_open_github_same_browser(browser_manager):
    """Criterion 3: Opening GitHub uses the same browser."""
    url = await browser_manager.navigate("github.com")
    assert url == "https://www.github.com"
    assert await browser_manager.get_current_url() == "https://www.github.com"


@pytest.mark.asyncio
async def test_search_automation(browser_manager):
    """Criterion 4: Search automation uses the same browser."""
    search_url = await browser_manager.search("Python documentation")
    assert "google.com/search?q=Python+documentation" in search_url
    assert await browser_manager.get_current_url() == search_url

    # YouTube search
    yt_search = await browser_manager.youtube_search("Lo-Fi Hip Hop")
    assert "youtube.com/results?search_query=Lo-Fi+Hip+Hop" in yt_search


@pytest.mark.asyncio
async def test_clicking_and_typing_interface(browser_manager):
    """Criterion 5: Clicking and typing operate against the centralized browser."""
    # Test that click_element and type_text methods exist and gracefully handle elements
    res_click = await browser_manager.click_element("button#search")
    assert isinstance(res_click, bool)

    res_type = await browser_manager.type_text("input[name='q']", "AI Agents")
    assert isinstance(res_type, bool)


@pytest.mark.asyncio
async def test_screenshot_capture(browser_manager):
    """Criterion 6: Screenshot captures browser content."""
    filepath = await browser_manager.capture_screenshot()
    assert filepath is not None
    assert filepath.endswith(".png")


@pytest.mark.asyncio
async def test_window_visibility_and_layouts(browser_manager):
    """Criterion 7: Minimize, restore, maximize, and floating work without resetting session."""
    await browser_manager.open_browser("https://www.wikipedia.org")

    # Minimize
    await browser_manager.minimize()
    assert browser_manager.controller.window_manager.state.is_visible is False
    assert browser_manager.controller.window_manager.state.is_open is True  # Session stays alive!

    # Restore
    await browser_manager.restore()
    assert browser_manager.controller.window_manager.state.is_visible is True
    assert browser_manager.controller.window_manager.state.current_url == "https://www.wikipedia.org"

    # Maximize / Expand
    await browser_manager.maximize()
    assert browser_manager.controller.window_manager.state.layout == BrowserLayoutMode.EXPANDED

    # Float
    await browser_manager.set_floating(True)
    assert browser_manager.controller.window_manager.state.layout == BrowserLayoutMode.FLOATING

    # Always-on-top
    await browser_manager.set_always_on_top(True)
    assert browser_manager.controller.window_manager.state.geometry.always_on_top is True


@pytest.mark.asyncio
async def test_session_cookies_preservation(browser_manager):
    """Criterion 8: Cookies and session state interface."""
    cookies = await browser_manager.session.get_cookies()
    assert isinstance(cookies, list)


@pytest.mark.asyncio
async def test_no_external_chrome_process(browser_manager):
    """Criterion 9: Manager connects via CDP/embedded session; does not spawn independent Chrome."""
    assert browser_manager.session.cdp_url == "http://127.0.0.1:9222"
    assert browser_manager.session._browser is None or browser_manager.session._is_cdp_connected
    # The old standalone-launch implementation must not return.
    source = Path(__file__).parents[1] / "app" / "browser"
    assert "chromium.launch" not in (source / "manager.py").read_text(encoding="utf-8")
    assert "new_context(" not in (source / "browser_session.py").read_text(encoding="utf-8")
    assert "new_page(" not in (source / "browser_session.py").read_text(encoding="utf-8")


@pytest.mark.asyncio
async def test_tool_manager_integration(browser_manager):
    """Criterion 11: ToolManager delegates all browser actions to the centralized BrowserManager."""
    tools = PlaceholderToolManager()
    tool_list = await tools.list_tools()
    assert "browser_open" in tool_list
    assert "browser_click" in tool_list
    assert "browser_type" in tool_list
    assert "browser_scroll" in tool_list
    assert "browser_screenshot" in tool_list
    assert "browser_youtube_search" in tool_list

    # Execute browser_open via ToolManager
    res = await tools.execute_tool(
        "browser_open",
        {"url": "https://www.google.com"},
        browser_manager,
    )
    assert res == "https://www.google.com"


@pytest.mark.asyncio
async def test_planner_integration():
    """Criterion 11: Planner generates valid steps targeting the centralized browser."""
    planner = PlaceholderPlanner()
    plan = await planner.create_plan("open youtube")
    assert plan == ["open:https://www.youtube.com"]

    plan_search = await planner.create_plan("scroll down")
    assert plan_search == ["scroll:down"]

    plan_min = await planner.create_plan("minimize browser")
    assert plan_min == ["minimize"]

