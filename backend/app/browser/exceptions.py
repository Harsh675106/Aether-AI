class BrowserException(Exception):
    """Base exception for all browser-related operations in Aether AI."""
    pass


class BrowserCrashException(BrowserException):
    """Raised when the browser process crashes or gets disconnected."""
    pass


class NavigationException(BrowserException):
    """Raised when page navigation fails."""
    pass


class NavigationTimeoutException(NavigationException):
    """Raised when a page navigation times out."""
    pass


class InvalidURLException(NavigationException):
    """Raised when the URL to open is invalid."""
    pass


class DownloadException(BrowserException):
    """Raised when a download operation fails."""
    pass
