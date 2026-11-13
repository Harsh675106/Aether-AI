from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class YouTubeCommand:
    action: str
    query: str | None = None
    section: str | None = None
    index: int | None = None
    value: float | int | None = None
    seconds: int | None = None
    sort_by: str | None = None
