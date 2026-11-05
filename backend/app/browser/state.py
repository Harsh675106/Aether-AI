from typing import TYPE_CHECKING

from app.core.logging import get_logger
from app.browser.tab import TabManager
from app.browser.schemas import BrowserState

if TYPE_CHECKING:
    from app.browser.browser_manager import BrowserManager

logger = get_logger(__name__)


class BrowserStateManager:
    """Consolidates states from BrowserManager and TabManager to provide a single source of truth BrowserState."""

    def __init__(self, browser_manager: "BrowserManager", tab_manager: TabManager) -> None:
        self._browser_manager = browser_manager
        self._tab_manager = tab_manager

    async def get_state(self, profile_name: str = "default") -> BrowserState:
        """Asynchronously builds and returns the current state of the browser and active page."""
        status = self._browser_manager.status
        if status == "closed" or status == "starting":
            return BrowserState(
                status=status,
                current_url=None,
                current_title=None,
                active_tab_id=None,
                number_of_tabs=0,
                loading=False
            )

        try:
            active_tab_id = await self._tab_manager.get_active_tab_id(profile_name)
            tabs = await self._tab_manager.list_tabs(profile_name)
            number_of_tabs = len(tabs)

            active_page = None
            # Only fetch active page if tabs exist
            if number_of_tabs > 0:
                active_page = await self._tab_manager.get_active_page(profile_name)

            if active_page and not active_page.is_closed():
                url = active_page.url
                try:
                    title = await active_page.title()
                except Exception:
                    title = ""
                
                try:
                    # Query browser DOM to see if it is still loading
                    ready_state = await active_page.evaluate("document.readyState")
                    loading = ready_state != "complete"
                except Exception:
                    loading = False

                return BrowserState(
                    status=status,
                    current_url=url,
                    current_title=title,
                    active_tab_id=active_tab_id,
                    number_of_tabs=number_of_tabs,
                    loading=loading
                )
            
            return BrowserState(
                status=status,
                current_url=None,
                current_title=None,
                active_tab_id=None,
                number_of_tabs=number_of_tabs,
                loading=False
            )

        except Exception as exc:
            logger.warning("failed_to_retrieve_browser_state", error=str(exc))
            return BrowserState(
                status=status,
                current_url=None,
                current_title=None,
                active_tab_id=None,
                number_of_tabs=0,
                loading=False
            )
