import uuid
import asyncio
from pathlib import Path
from playwright.async_api import Download, BrowserContext

from app.core.settings import Settings
from app.core.logging import get_logger
from app.browser.schemas import DownloadProgress, DownloadStatus
from app.browser.exceptions import DownloadException

logger = get_logger(__name__)


class DownloadManager:
    """Monages page downloads, progress, custom save locations, renaming, and download tracking."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        # Mapping: download_id -> DownloadProgress
        self._downloads: dict[str, DownloadProgress] = {}
        self._lock = asyncio.Lock()

    def register_context(self, context: BrowserContext) -> None:
        """Registers download event listeners on a Playwright BrowserContext."""
        logger.debug("registering_downloads_on_context")
        
        # When a download starts
        context.on("download", self._on_download_started)

    def _on_download_started(self, download: Download) -> None:
        """Callback triggered when a download begins in the browser."""
        download_id = str(uuid.uuid4())
        
        # Run processing in a background task
        asyncio.create_task(self._process_download(download_id, download))

    async def _process_download(self, download_id: str, download: Download) -> None:
        filename = download.suggested_filename
        url = download.url
        logger.info("download_started_event", download_id=download_id, filename=filename, url=url)

        # Initialize progress schema
        progress = DownloadProgress(
            download_id=download_id,
            url=url,
            filename=filename,
            progress_percent=0.0,
            status="started"
        )
        
        async with self._lock:
            self._downloads[download_id] = progress

        try:
            # Transition to downloading status
            progress.status = "downloading"
            progress.progress_percent = 50.0  # Simulated mid-progress for Playwright binary files
            
            # Playwright downloads are completed when .path() returns
            # Wait for the download to complete
            temp_path = await download.path()
            if not temp_path:
                raise DownloadException("Temporary download path is empty or unavailable")

            # Determine final save location
            downloads_dir = Path(self._settings.browser_download_dir)
            downloads_dir.mkdir(parents=True, exist_ok=True)
            
            # Save the file using download's suggested filename
            save_path = downloads_dir / filename
            
            logger.info("saving_download_to_destination", download_id=download_id, destination=str(save_path))
            await download.save_as(str(save_path))

            # Finalize progress status
            progress.save_path = str(save_path)
            progress.progress_percent = 100.0
            progress.status = "completed"
            logger.info("download_completed_successfully", download_id=download_id, filename=filename)

        except Exception as exc:
            logger.error("download_processing_failed", download_id=download_id, error=str(exc))
            progress.status = "failed"
            progress.error = str(exc)
            
        finally:
            async with self._lock:
                self._downloads[download_id] = progress

    async def get_download(self, download_id: str) -> DownloadProgress | None:
        """Retrieves download status for a given ID."""
        async with self._lock:
            return self._downloads.get(download_id)

    async def list_downloads(self) -> list[DownloadProgress]:
        """Lists history of all tracked downloads."""
        async with self._lock:
            return list(self._downloads.values())
