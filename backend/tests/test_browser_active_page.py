import base64
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from app.browser.browser_automation import BrowserAutomation
from app.browser.browser_session import BrowserSessionManager
from app.core.settings import Settings


class ActivePage:
    def __init__(self, url: str, context: object) -> None:
        self.url = url
        self.context = context

    def is_closed(self) -> bool:
        return False


@pytest.mark.asyncio
async def test_get_page_follows_selected_floating_tab() -> None:
    settings = Settings(aether_env="testing")
    session = BrowserSessionManager(settings)
    first_page = ActivePage("https://www.youtube.com/", object())
    second_page = ActivePage("https://github.com/", object())
    session._browser = SimpleNamespace(
        contexts=[SimpleNamespace(pages=[first_page, second_page])]
    )
    session._is_cdp_connected = True
    session._page = first_page
    session._active_url = first_page.url

    session.set_active_page("https://github.com/", "browser-tab-1")

    assert await session.get_page() is second_page
    assert session.current_url == "https://github.com/"


@pytest.mark.asyncio
async def test_missing_active_tab_does_not_fall_back_to_another_tab(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = Settings(aether_env="testing")
    session = BrowserSessionManager(settings)
    youtube_page = ActivePage("https://www.youtube.com/", object())
    session._browser = SimpleNamespace(
        contexts=[SimpleNamespace(pages=[youtube_page])]
    )
    session._is_cdp_connected = True
    session._page = youtube_page
    session._active_url = "https://github.com/"
    monkeypatch.setattr("app.browser.browser_session.asyncio.sleep", AsyncMock())

    assert await session.get_page() is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("full_page", "dimensions"),
    [
        (False, None),
        (True, {"width": 1366, "height": 2400}),
    ],
)
async def test_screenshot_uses_cdp_without_waiting_for_page_fonts(
    full_page: bool,
    dimensions: dict[str, int] | None,
) -> None:
    screenshot_bytes = b"captured-active-tab"
    cdp_session = Mock()
    cdp_session.send = AsyncMock(
        return_value={"data": base64.b64encode(screenshot_bytes).decode("ascii")}
    )
    cdp_session.detach = AsyncMock()
    context = Mock()
    context.new_cdp_session = AsyncMock(return_value=cdp_session)
    page = Mock()
    page.url = "https://github.com/"
    page.context = context
    page.is_closed = Mock(return_value=False)
    page.title = AsyncMock(return_value="GitHub")
    page.screenshot = AsyncMock(side_effect=AssertionError("Playwright screenshot waits for fonts"))
    page.evaluate = AsyncMock(return_value=dimensions)

    store = Mock()
    store.record = AsyncMock(return_value="screenshot-id")
    session = Mock()
    session.get_page = AsyncMock(return_value=page)
    session.page_title = "GitHub"
    session.current_url = page.url

    service = BrowserAutomation(session, Settings(aether_env="testing"), store)

    await service.capture_screenshot(full_page=full_page)

    page.screenshot.assert_not_awaited()
    cdp_session.send.assert_awaited_once()
    method, params = cdp_session.send.await_args.args
    assert method == "Page.captureScreenshot"
    assert params["captureBeyondViewport"] is full_page
    if full_page:
        assert params["clip"] == {
            "x": 0,
            "y": 0,
            "width": 1366,
            "height": 2400,
            "scale": 1,
        }
    record = store.record.await_args.args[0]
    assert record["url"] == page.url
    assert base64.b64decode(record["image_data"].split(",", 1)[1]) == screenshot_bytes
    cdp_session.detach.assert_awaited_once()
