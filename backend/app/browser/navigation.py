import re
import urllib.parse
from playwright.async_api import Page

from app.core.settings import Settings
from app.core.logging import get_logger
from app.browser.exceptions import NavigationException, NavigationTimeoutException, InvalidURLException
from app.browser.tab import TabManager

logger = get_logger(__name__)


class NavigationManager:
    """Handles page navigations, URL parsing and validation, timeout logic, and search fallbacks."""

    URL_REGEX = re.compile(
        r'^(?:http|ftp)s?://'  # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)|'  # domain...
        r'localhost|'  # localhost...
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
        r'(?::\d+)?'  # optional port
        r'(?:/?|[/?]\S+)$', re.IGNORECASE
    )

    DOMAIN_REGEX = re.compile(
        r'^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,6}(?::\d+)?(?:/?|[/?]\S+)$', re.IGNORECASE
    )

    def __init__(self, settings: Settings, tab_manager: TabManager) -> None:
        self._settings = settings
        self._tab_manager = tab_manager

    def validate_and_format_url(self, url_str: str) -> tuple[str, bool]:
        """
        Validates if the string is a valid URL or can be formatted as one.
        Returns:
            (formatted_url, is_valid_or_formatted)
        """
        stripped = url_str.strip()
        if not stripped:
            return "", False

        # If it already looks like a URL (has scheme)
        if self.URL_REGEX.match(stripped):
            return stripped, True

        # If it is a bare domain, e.g. "google.com" or "youtube.com/watch?v=..."
        if self.DOMAIN_REGEX.match(stripped):
            return f"https://{stripped}", True

        return "", False

    async def open_url(
        self,
        url_or_query: str,
        *,
        wait_until: str = "load",  # "load", "domcontentloaded", "networkidle"
        profile_name: str = "default"
    ) -> Page:
        """
        Navigates the active tab to a URL. 
        If the target is not a valid URL, it falls back to a DuckDuckGo search.
        """
        page = await self._tab_manager.get_active_page(profile_name)
        if not page:
            raise NavigationException("No active tab available for navigation")

        formatted_url, is_valid = self.validate_and_format_url(url_or_query)
        if not is_valid:
            # Fall back to DuckDuckGo search query
            escaped_query = urllib.parse.quote_plus(url_or_query)
            formatted_url = f"https://duckduckgo.com/?q={escaped_query}"
            logger.info("invalid_url_fallback_to_search", query=url_or_query, search_url=formatted_url)

        logger.info("navigating_to_url", url=formatted_url, wait_until=wait_until)
        
        try:
            # Playwright page.goto handles redirect tracking automatically
            response = await page.goto(
                formatted_url,
                wait_until=wait_until,  # type: ignore[arg-type]
                timeout=self._settings.browser_timeout
            )
            
            if response is None:
                # Can happen with about:blank or downloads
                logger.info("navigation_completed_no_response", url=formatted_url)
                return page

            if not response.ok:
                logger.warning("page_response_not_ok", status=response.status, url=response.url)

            return page
            
        except Exception as exc:
            err_msg = str(exc).lower()
            if "timeout" in err_msg:
                logger.error("navigation_timeout", url=formatted_url, error=str(exc))
                raise NavigationTimeoutException(
                    f"Navigation to '{formatted_url}' timed out after {self._settings.browser_timeout}ms."
                ) from exc
            else:
                logger.error("navigation_failed", url=formatted_url, error=str(exc))
                raise NavigationException(f"Failed to navigate to '{formatted_url}': {exc}") from exc
