import pytest
import asyncio
from app.browser.screenshot_store import ScreenshotStore
from app.core.settings import Settings


def test_screenshot_store_crud() -> None:
    async def _test() -> None:
        store = ScreenshotStore(settings=Settings())
        
        # Test empty list
        await store.clear_all()
        recent = await store.list_recent()
        assert len(recent) == 0

        # Test record
        shot_id = await store.record({
            "id": "test-shot-1",
            "title": "Test Page",
            "url": "https://example.com",
            "image_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "full_page": False,
        })
        assert shot_id == "test-shot-1"

        # Test get
        item = await store.get("test-shot-1")
        assert item is not None
        assert item["title"] == "Test Page"
        assert item["url"] == "https://example.com"
        assert "image_data" in item

        # Test list
        recent = await store.list_recent()
        assert len(recent) == 1
        assert recent[0]["id"] == "test-shot-1"

        # Test delete
        deleted = await store.delete("test-shot-1")
        assert deleted is True
        assert await store.get("test-shot-1") is None
        assert len(await store.list_recent()) == 0

    asyncio.run(_test())

