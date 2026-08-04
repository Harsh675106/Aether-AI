from typing import Literal
from pydantic import BaseModel, Field

BrowserStatus = Literal["starting", "running", "closed", "recovering"]
DownloadStatus = Literal["started", "downloading", "completed", "failed"]


class TabInfo(BaseModel):
    id: str = Field(description="Unique identifier for the tab")
    title: str = Field(default="", description="Current title of the tab page")
    url: str = Field(default="", description="Current URL of the tab page")
    is_active: bool = Field(default=False, description="Whether this is the active/selected tab")
    is_pinned: bool = Field(default=False, description="Whether this tab is pinned")


class BrowserState(BaseModel):
    status: BrowserStatus = Field(default="closed", description="Current lifecycle state of the browser")
    current_url: str | None = Field(default=None, description="URL of the currently active page")
    current_title: str | None = Field(default=None, description="Title of the currently active page")
    active_tab_id: str | None = Field(default=None, description="ID of the currently active tab")
    number_of_tabs: int = Field(default=0, description="Total number of open tabs")
    loading: bool = Field(default=False, description="Whether the active page is currently loading")


class DownloadProgress(BaseModel):
    download_id: str = Field(description="Unique identifier of the download")
    url: str = Field(description="Source URL of the download")
    filename: str | None = Field(default=None, description="Name of the file being downloaded")
    save_path: str | None = Field(default=None, description="Path where the file is saved")
    progress_percent: float = Field(default=0.0, description="Download progress percentage (0-100)")
    status: DownloadStatus = Field(default="started", description="Current status of the download")
    error: str | None = Field(default=None, description="Error message if download failed")
