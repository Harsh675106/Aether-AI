from __future__ import annotations

from typing import Any

import pytest
from app.chat.orchestrator import ConversationOrchestrator
from app.core.settings import Settings
from app.youtube.youtube_command_router import YouTubeCommandRouter
from app.youtube.youtube_manager import YouTubeManager


class EmbeddedBrowser:
    """Test double for the active page exposed by the centralized browser manager."""

    def __init__(self) -> None:
        self.url = "https://www.youtube.com/"
        self.navigations: list[str] = []
        self.scripts: list[str] = []

    async def get_current_url(self) -> str:
        return self.url

    async def navigate(self, url: str) -> str:
        self.url = url
        self.navigations.append(url)
        return url

    async def click_element(self, _: str) -> bool:
        return True

    async def execute_javascript(self, script: str) -> Any:
        self.scripts.append(script)
        if "const started = Date.now()" in script and "document.querySelector('video')" in script:
            return {"paused": False, "title": "Python Tutorial"}
        if "new Promise" in script:
            return [
                {
                    "title": "Python Course",
                    "url": "https://www.youtube.com/watch?v=python",
                    "channel": "Example Channel",
                    "metadata": ["10K views", "2 days ago"],
                },
                {
                    "title": "Python Tutorial",
                    "url": "https://www.youtube.com/watch?v=tutorial",
                    "channel": "Tutorial Channel",
                    "metadata": ["5K views", "1 week ago"],
                },
            ]
        if "video.pause()" in script:
            return {"paused": True, "playbackRate": 1, "volume": 1, "currentTime": 30}
        if "playbackRate" in script:
            return {"paused": False, "playbackRate": 1.5, "volume": 0.4, "currentTime": 30}
        if "video.volume" in script:
            return {"paused": False, "playbackRate": 1, "volume": 0.4, "currentTime": 30}
        if "title, channel, url" in script:
            return {
                "title": "Current Video",
                "channel": "Current Channel",
                "url": self.url,
                "duration": 120,
                "currentTime": 20,
                "paused": False,
            }
        return {}


def build_router() -> tuple[YouTubeCommandRouter, EmbeddedBrowser]:
    browser = EmbeddedBrowser()
    return YouTubeCommandRouter(YouTubeManager(browser)), browser


@pytest.mark.asyncio
async def test_recognizes_natural_search_and_control_parameters() -> None:
    router, _ = build_router()

    search = router._parse("Find the best Python course according to views")
    volume = router._parse("Set the YouTube volume to 40 percent")
    history = router._parse("Play the last video I watched")
    speed = await router.execute("Play at 1.5 speed")

    assert search is not None and search.action == "search"
    assert search.query == "Python course"
    assert search.sort_by == "views"
    assert volume is not None and volume.action == "volume" and volume.value == 40
    assert speed == "Video resumed at 1.5x speed."
    assert history is not None and history.action == "history_play"


@pytest.mark.asyncio
async def test_navigation_uses_only_the_central_browser() -> None:
    router, browser = build_router()

    response = await router.execute("Open YouTube Shorts")

    assert response is not None and "Shorts" in response
    assert browser.navigations == ["https://www.youtube.com/shorts"]


@pytest.mark.asyncio
async def test_search_results_are_saved_for_follow_up_selection() -> None:
    router, browser = build_router()

    response = await router.execute("Find the best Python course according to views", "chat-1")
    selection = await router.execute("Open the second result", "chat-1")

    assert response is not None and "Python Course" in response
    assert "Tutorial Channel" in response
    assert "can't reliably rank these by view count" in response
    assert selection == "Playing result 2: Python Tutorial."
    assert browser.navigations[-2].startswith(
        "https://www.youtube.com/results?search_query=Python+course"
    )
    assert browser.navigations[-1] == "https://www.youtube.com/watch?v=tutorial"


@pytest.mark.asyncio
async def test_playback_reports_verified_state_and_does_not_claim_missing_page() -> None:
    router, browser = build_router()

    response = await router.execute("Pause YouTube")
    browser.url = "https://example.com"
    unavailable = await router.execute("Pause")

    assert response == "Video paused."
    assert unavailable is None


@pytest.mark.asyncio
async def test_account_changes_are_not_executed() -> None:
    router, browser = build_router()

    response = await router.execute("Subscribe to this channel")

    assert response is not None and "aren't implemented yet" in response
    assert browser.navigations == []
    assert browser.scripts == []


@pytest.mark.asyncio
async def test_chat_orchestrator_routes_youtube_before_generic_planner() -> None:
    class Planner:
        called = False

        async def create_plan(self, _: str) -> list[str]:
            self.called = True
            return ["open:https://www.youtube.com"]

    class YouTubeRouter:
        async def execute(self, text: str, conversation_id: str | None) -> str:
            assert text == "Open YouTube"
            return "Opening YouTube in the Aether Floating Browser."

    planner = Planner()
    orchestrator = ConversationOrchestrator(
        llm_provider=object(),  # The direct YouTube path must not use the LLM.
        settings=Settings(),
        planner=planner,
        youtube_command_router=YouTubeRouter(),
    )
    chunks = [
        chunk
        async for chunk in orchestrator.stream_response(
            [{"role": "user", "content": "Open YouTube"}]
        )
    ]

    assert "".join(chunks) == "Opening YouTube in the Aether Floating Browser."
    assert not planner.called
