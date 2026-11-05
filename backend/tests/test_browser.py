import pytest
import os
import shutil
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

from app.core.settings import Settings
from app.browser.service import BrowserService
from app.browser.exceptions import BrowserCrashException, NavigationTimeoutException
from app.chat.intent import IntentClassifier, IntentCategory
from app.chat.routing import RoutingEngine
from app.agents.planner import PlaceholderPlanner


@pytest.mark.asyncio
async def test_browser_lifecycle_and_facade(tmp_path: Path) -> None:
    # Set up custom directories to avoid pollution
    settings = Settings()
    settings.browser_headless = True
    settings.browser_screenshot_dir = str(tmp_path / "screenshots")
    settings.browser_download_dir = str(tmp_path / "downloads")
    settings.browser_user_data_dir = str(tmp_path / "profiles")

    service = BrowserService(settings=settings)
    
    # 1. Initialize
    await service.initialize(profile_name="test_profile")
    assert service.browser_manager.status == "running"
    
    # Check default context exists
    context = await service.context_manager.get_or_create_context("test_profile")
    assert context is not None
    
    # 2. Check tab creation
    tabs = await service.tab_manager.list_tabs("test_profile")
    assert len(tabs) >= 1
    
    # 3. Check State
    state = await service.get_state("test_profile")
    assert state.status == "running"
    assert state.number_of_tabs >= 1
    
    # 4. Check Navigation & Fallback
    # Navigate to a simple local or dummy address, or check url parsing
    formatted, ok = service.navigation_manager.validate_and_format_url("example.com")
    assert ok
    assert formatted == "https://example.com"
    
    formatted, ok = service.navigation_manager.validate_and_format_url("open search query")
    assert not ok
    
    # 5. Clean up
    await service.close()
    assert service.browser_manager.status == "closed"


@pytest.mark.asyncio
async def test_tab_manager_logic(tmp_path: Path) -> None:
    settings = Settings()
    settings.browser_headless = True
    settings.browser_screenshot_dir = str(tmp_path / "screenshots")
    settings.browser_user_data_dir = str(tmp_path / "profiles")
    
    service = BrowserService(settings=settings)
    await service.initialize(profile_name="test_tabs")
    
    # Open additional tab
    p2 = await service.tab_manager.open_tab(profile_name="test_tabs")
    tabs = await service.tab_manager.list_tabs("test_tabs")
    # There should be 2 tabs: the default initial one + the new one
    assert len(tabs) == 2
    
    # Duplicate active tab
    p3 = await service.tab_manager.duplicate_tab(profile_name="test_tabs")
    tabs = await service.tab_manager.list_tabs("test_tabs")
    assert len(tabs) == 3
    
    # Pin tab
    active_id = await service.tab_manager.get_active_tab_id("test_tabs")
    assert active_id is not None
    await service.tab_manager.pin_tab(active_id, pin=True, profile_name="test_tabs")
    
    tabs_meta = await service.tab_manager.list_tabs("test_tabs")
    active_meta = next(t for t in tabs_meta if t.id == active_id)
    assert active_meta.is_pinned is True
    
    # Close tab
    await service.tab_manager.close_tab(active_id, "test_tabs")
    tabs = await service.tab_manager.list_tabs("test_tabs")
    assert len(tabs) == 2

    await service.close()


@pytest.mark.asyncio
async def test_cookies_and_storage_manager(tmp_path: Path) -> None:
    settings = Settings()
    settings.browser_user_data_dir = str(tmp_path / "profiles")
    
    service = BrowserService(settings=settings)
    
    # Mock active page
    mock_page = AsyncMock()
    mock_page.is_closed.return_value = False
    
    # Mock evaluate outputs for local/session storage
    mock_page.evaluate.side_effect = lambda expr, *args: (
        {"test_key": "test_val"} if "localStorage" in expr else {"session_key": "session_val"}
    )
    service.tab_manager.get_active_page = AsyncMock(return_value=mock_page)

    # Mock context
    mock_context = AsyncMock()
    mock_context.cookies.return_value = [{"name": "mock_cookie", "value": "mock_val"}]
    service.context_manager.get_or_create_context = AsyncMock(return_value=mock_context)
    service.context_manager.save_context_state = AsyncMock()

    # 1. Cookies Test
    cookies = await service.storage_manager.get_cookies("test_store")
    assert cookies == [{"name": "mock_cookie", "value": "mock_val"}]
    
    # 2. LocalStorage Test
    await service.storage_manager.set_local_storage({"test_key": "test_val"}, "test_store")
    mock_page.evaluate.assert_called()
    val = await service.storage_manager.get_local_storage("test_store")
    assert val.get("test_key") == "test_val"

    # 3. SessionStorage Test
    await service.storage_manager.set_session_storage({"session_key": "session_val"}, "test_store")
    s_val = await service.storage_manager.get_session_storage("test_store")
    assert s_val.get("session_key") == "session_val"



@pytest.mark.asyncio
async def test_intent_detection_and_routing() -> None:
    classifier = IntentClassifier()
    router = RoutingEngine()
    
    # Validate intent extraction
    intent = classifier.classify("open youtube.com")
    assert intent.category == IntentCategory.BROWSER_ACTION

    intent_bare = classifier.classify("open youtube")
    assert intent_bare.category == IntentCategory.BROWSER_ACTION

    decision = router.decide(intent)
    assert decision.use_planner is True
    assert decision.use_tools is True
    
    # Take screenshot queries
    intent_ss = classifier.classify("take a screenshot of the page")
    assert intent_ss.category == IntentCategory.BROWSER_ACTION
    
    # Pinned navigation
    intent_back = classifier.classify("go back")
    assert intent_back.category == IntentCategory.BROWSER_ACTION


@pytest.mark.asyncio
async def test_browser_planner_actions() -> None:
    planner = PlaceholderPlanner()
    
    # Test simple navigations
    plan1 = await planner.create_plan("open google.com")
    assert list(plan1) == ["open:https://google.com"]
    
    plan2 = await planner.create_plan("take screenshot")
    assert list(plan2) == ["screenshot:viewport"]

    plan3 = await planner.create_plan("refresh page")
    assert list(plan3) == ["reload"]
