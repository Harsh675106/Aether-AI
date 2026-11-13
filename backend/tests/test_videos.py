from __future__ import annotations

from typing import Any

import pytest
from app.core.settings import Settings
from app.videos.command_router import VideoCommandRouter
from app.videos.schemas import VideoResult, VideoSearchRequest, VideoSearchResponse
from app.videos.service import SearXNGVideoSearchService
from app.videos.storage import SavedVideoStore, video_id_for_url


def test_video_search_request_rejects_blank_and_bounds_query() -> None:
    with pytest.raises(ValueError):
        VideoSearchRequest(query="  ")
    with pytest.raises(ValueError):
        VideoSearchRequest(query="x" * 501)
    with pytest.raises(ValueError):
        VideoResult(
            id="unsafe",
            title="Unsafe",
            video_url="javascript:alert(1)",
            platform="unknown",
        )


def test_normalization_extracts_video_metadata_and_deduplicates_urls() -> None:
    service = SearXNGVideoSearchService("http://searxng")

    results = service._normalize(
        [
            {
                "title": "Python tutorial",
                "url": "https://www.youtube.com/watch?v=abc&utm_source=search",
                "thumbnail": "https://img.youtube.com/vi/abc/0.jpg",
                "engine": "youtube",
                "content": "Learn Python",
                "length": "12:34",
                "publishedDate": "2026-01-02",
                "author": "Aether",
            },
            {"title": "Duplicate", "url": "https://www.youtube.com/watch?v=abc"},
            {"title": "Unsafe", "url": "javascript:alert(1)"},
        ],
        24,
    )

    assert len(results) == 1
    result = results[0]
    assert result.title == "Python tutorial"
    assert result.platform == "youtube"
    assert result.duration == "12:34"
    assert result.duration_seconds == 754
    assert result.creator == "Aether"
    assert result.id == video_id_for_url(result.video_url)
    assert video_id_for_url("https://www.vimeo.com/123") == video_id_for_url(
        "https://vimeo.com/123"
    )
    assert video_id_for_url("https://youtube.com/shorts/abc") == video_id_for_url(
        "https://youtube.com/watch?v=abc"
    )


@pytest.mark.asyncio
async def test_search_uses_videos_category_and_requested_page(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requested: dict[str, Any] = {}

    class Response:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, Any]:
            return {
                "results": [
                    {"title": "Example", "url": "https://vimeo.com/123", "engine": "vimeo"}
                ]
            }

    class Client:
        async def __aenter__(self) -> Client:
            return self

        async def __aexit__(self, *_: Any) -> None:
            return None

        async def get(
            self,
            url: str,
            *,
            params: dict[str, Any],
            headers: dict[str, str],
        ) -> Response:
            requested.update({"url": url, "params": params, "headers": headers})
            return Response()

    monkeypatch.setattr("app.videos.service.httpx.AsyncClient", lambda **_: Client())
    response = await SearXNGVideoSearchService("http://searxng").search(
        "  machine learning  ",
        limit=12,
        page=3,
        engine="youtube",
    )

    assert response.query == "machine learning"
    assert response.page == 3
    assert requested["params"]["categories"] == "videos"
    assert requested["params"]["pageno"] == 3
    assert requested["params"]["engines"] == "youtube"
    assert response.results[0].video_url == "https://vimeo.com/123"
    assert response.has_more


@pytest.mark.asyncio
async def test_saved_videos_are_deduplicated_searchable_and_removable(tmp_path: Any) -> None:
    store = SavedVideoStore(Settings(CHROMA_PERSIST_DIRECTORY=str(tmp_path)))
    assert store.settings.chroma_persist_directory == str(tmp_path)
    first = await store.save(
        {
            "title": "Python tutorial",
            "video_url": "https://www.youtube.com/watch?v=abc&utm_source=a",
            "platform": "youtube",
            "thumbnail_url": "https://img.youtube.com/vi/abc/0.jpg",
        }
    )
    duplicate = await store.save(
        {
            "title": "Updated title",
            "video_url": "https://www.youtube.com/watch?v=abc",
            "platform": "youtube",
        }
    )

    assert first["id"] == duplicate["id"]
    assert len(await store.list()) == 1
    assert (await store.list(query="updated"))[0]["title"] == "Updated title"
    restarted_store = SavedVideoStore(Settings(CHROMA_PERSIST_DIRECTORY=str(tmp_path)))
    assert len(await restarted_store.list()) == 1
    assert await restarted_store.remove(first["id"])
    assert await restarted_store.list() == []


@pytest.mark.asyncio
async def test_video_commands_search_open_and_show_saved() -> None:
    class SearchService:
        async def search(
            self,
            query: str,
            *,
            limit: int,
            page: int = 1,
            engine: str | None = None,
        ) -> Any:
            return VideoSearchResponse(
                query=query,
                page=page,
                results=[
                    VideoResult(
                        id="video-id",
                        title="Python Tutorial",
                        video_url="https://youtu.be/example",
                        platform="youtube",
                    )
                ],
            )

    class Store:
        async def save(self, payload: dict[str, Any]) -> dict[str, Any]:
            return payload

        async def list(self, *, query: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
            return []

    class Browser:
        navigated: str | None = None

        async def navigate(self, url: str) -> None:
            self.navigated = url

    browser = Browser()
    router = VideoCommandRouter(SearchService(), Store(), browser)

    response = await router.execute("Search for the latest AI news videos", "chat-1")
    metadata = router.pop_search_metadata()
    assert response is not None and "video results" in response
    assert metadata is not None and metadata["query"] == "AI news"

    opened = await router.execute("Open the first video", "chat-1")
    assert opened is not None and "Python Tutorial" in opened
    assert browser.navigated == "https://youtu.be/example"

    saved = await router.execute("Show my saved videos", "chat-1")
    assert saved is not None and router.pop_search_metadata() == {"view": "saved"}


@pytest.mark.asyncio
async def test_video_commands_extract_youtube_and_tutorial_queries() -> None:
    queries: list[str] = []
    engines: list[str | None] = []

    class SearchService:
        async def search(
            self,
            query: str,
            *,
            limit: int,
            page: int = 1,
            engine: str | None = None,
        ) -> Any:
            queries.append(query)
            engines.append(engine)
            return VideoSearchResponse(query=query, page=page, results=[])

    class NotUsed:
        async def list(self, **_: Any) -> list[dict[str, Any]]:
            return []

    router = VideoCommandRouter(SearchService(), NotUsed(), NotUsed())
    await router.execute("Find the best Python tutorials on YouTube")
    await router.execute("Find videos about model training from YouTube")
    await router.execute("Search videos about neural networks")

    assert queries == ["Python tutorials", "model training", "neural networks"]
    assert engines == ["youtube", "youtube", None]
