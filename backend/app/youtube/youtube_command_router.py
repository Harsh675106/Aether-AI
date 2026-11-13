from __future__ import annotations

import re

from app.core.logging import get_logger
from app.youtube.models import YouTubeCommand
from app.youtube.youtube_manager import YouTubeManager

logger = get_logger(__name__)


class YouTubeCommandRouter:
    """Recognizes supported YouTube requests before the generic browser planner."""

    _ORDINALS = {
        "first": 1,
        "1st": 1,
        "second": 2,
        "2nd": 2,
        "third": 3,
        "3rd": 3,
        "fourth": 4,
        "4th": 4,
        "fifth": 5,
        "5th": 5,
    }
    _SEARCH_PREFIX = re.compile(
        r"^(?:please\s+)?(?:search(?:\s+youtube)?\s+for|search|find|look\s+for|"
        r"show\s+me|play\s+something\s+(?:about|related\s+to))\s+",
        re.IGNORECASE,
    )
    _SEARCH_QUALIFIERS = (
        r"\baccording\s+to\s+(?:views?|view\s+count)\b",
        r"\bby\s+views?\b",
        r"\bmost\s+viewed\b",
        r"\bmost\s+popular\b",
        r"\brecently\s+uploaded\b",
        r"\buploaded\s+(?:this|last)\s+week\b",
        r"\bfor\s+beginners\b",
        r"\b(?:best|latest|longest|complete|full)\b",
    )

    def __init__(self, youtube: YouTubeManager) -> None:
        self.youtube = youtube

    async def execute(self, text: str, conversation_id: str | None = None) -> str | None:
        """Runs a recognized command; returns None when it is not a YouTube request."""
        command = self._parse(text)
        if command is None:
            try:
                active = await self.youtube.is_active()
            except Exception as exc:
                logger.warning("youtube_context_check_failed", error=str(exc))
                return None
            if not active:
                return None
            command = self._parse_contextual(text)
        if command is None:
            return None

        try:
            response = await self.youtube.execute(command, conversation_id)
            logger.info(
                "youtube_command_completed",
                action=command.action,
                conversation_id=conversation_id,
            )
            return response
        except Exception as exc:
            logger.warning(
                "youtube_command_failed",
                action=command.action,
                error=str(exc),
                conversation_id=conversation_id,
            )
            return f"I couldn't complete that YouTube action: {exc}"

    def _parse(self, text: str) -> YouTubeCommand | None:
        query = text.strip().lower()
        if not query:
            return None
        has_youtube = bool(re.search(r"\byoutube\b|\byt\b", query))
        has_video_context = bool(
            re.search(
                r"\b(video|videos|channel|playlist|playlists|course|tutorial|tutorials|"
                r"shorts|watch later|history)\b",
                query,
            )
        )

        section_patterns = (
            (r"\bshorts\b", "shorts"),
            (r"\bsubscriptions?\b", "subscriptions"),
            (r"\bwatch\s+later\b", "watch_later"),
            (r"\bliked\s+videos?\b", "liked"),
            (r"\bplaylists?\b", "playlists"),
            (r"\b(?:watch\s+)?history\b", "history"),
            (r"\blibrary\b", "library"),
            (r"\btrending\b|\bpopular\s+videos\b", "trending"),
            (r"\bmy\s+channel\b", "channel"),
            (r"\byoutube\s+music\b", "music"),
        )
        if re.search(r"\b(open|go to|navigate to|show|visit)\b", query):
            for pattern, section in section_patterns:
                if re.search(pattern, query):
                    return YouTubeCommand("navigate", section=section)
            if re.search(r"\bchannel\b", query):
                return YouTubeCommand("unsupported_channel")
            if has_youtube and re.search(r"\b(home|homepage)\b", query):
                return YouTubeCommand("navigate", section="home")
            if re.search(r"\b(open|go to|navigate to|visit)\s+youtube\b", query):
                return YouTubeCommand("navigate", section="home")

        if re.search(
            r"\b(?:play|open)\s+(?:the\s+)?(?:(?:most\s+)?recent(?:ly)?|last)\s+"
            r"(?:video\s+)?(?:from\s+)?(?:my\s+)?(?:watch\s+)?history\b",
            query,
        ):
            return YouTubeCommand("history_play")
        if re.search(r"\bplay\s+(?:the\s+)?last\s+video\s+i\s+watched\b", query):
            return YouTubeCommand("history_play")
        if re.search(r"\b(?:search|find)\b.*\b(?:my\s+)?(?:watch\s+)?history\b", query):
            history_match = re.search(
                r"\bhistory\b\s*(?:(?:for|about)\s+)?(.*)$",
                text,
                re.I,
            )
            history_query = history_match.group(1).strip(" .") if history_match else ""
            return YouTubeCommand("history_search", query=history_query or None)
        if re.search(r"\b(?:open|show|view)\b.*\b(?:my\s+)?(?:watch\s+)?history\b", query):
            return YouTubeCommand("navigate", section="history")

        if re.search(
            r"\b(?:play|open)\s+(?:the\s+)?(?:first|second|third|fourth|fifth|"
            r"\d+(?:st|nd|rd|th)?)\s+(?:one|result|video)\b",
            query,
        ):
            ordinal = re.search(r"\b(first|second|third|fourth|fifth|\d+)(?:st|nd|rd|th)?\b", query)
            index = self._ordinal(ordinal.group(0)) if ordinal else None
            return YouTubeCommand("select_result", index=index)

        if has_youtube or has_video_context:
            if re.search(
                r"\b(?:clear|delete|remove|unsubscribe|subscribe|create|rename|"
                r"add|save)\b",
                query,
            ):
                return YouTubeCommand("unsupported_account_change")

            if re.search(r"\b(?:what|which|who|how long|tell me|show)\b", query) and (
                "current" in query or "playing" in query or "video" in query
            ):
                return YouTubeCommand("video_info")
            if re.search(r"\b(description|describe)\b", query):
                return YouTubeCommand("description")
            if re.search(r"\b(copy|link|url)\b", query) and has_video_context:
                return YouTubeCommand("copy_link")

            if re.search(r"\b(?:next|skip to next)\b", query):
                return YouTubeCommand("next")
            if re.search(r"\bprevious\b|\bgo back to previous\b", query):
                return YouTubeCommand("previous")
            if re.search(r"\b(?:restart|start over)\b", query):
                return YouTubeCommand("restart")
            combined_speed = re.search(
                r"\b(?:resume|play)\b.*?\b(?:at\s+)?(\d+(?:\.\d+)?)\s*x?\s*(?:speed|times?)\b",
                query,
            )
            if combined_speed:
                return YouTubeCommand("resume_speed", value=float(combined_speed.group(1)))
            if re.search(r"\b(?:toggle|switch)\s+(?:play|pause)\b", query):
                return YouTubeCommand("toggle_playback")
            seek = self._seek_seconds(query)
            if seek is not None:
                return YouTubeCommand("seek", seconds=seek)
            skip = re.search(
                r"\b(skip|forward|back|backward)\s+(\d+)\s*"
                r"(seconds?|secs?|minutes?|mins?)\b",
                query,
            )
            if skip:
                seconds = int(skip.group(2)) * (
                    60 if skip.group(3).startswith(("minute", "min")) else 1
                )
                return YouTubeCommand(
                    "skip_backward" if skip.group(1) in ("back", "backward") else "skip_forward",
                    seconds=seconds,
                )
            volume = re.search(r"\b(?:volume|set volume)\s*(?:to)?\s*(\d{1,3})\s*%?", query)
            if volume:
                return YouTubeCommand("volume", value=int(volume.group(1)))
            if re.search(r"\b(?:increase|raise|turn up)\s+(?:the\s+)?volume\b", query):
                return YouTubeCommand("volume_up")
            if re.search(r"\b(?:decrease|lower|turn down)\s+(?:the\s+)?volume\b", query):
                return YouTubeCommand("volume_down")
            if re.search(r"\b(?:mute|silence)\b", query):
                return YouTubeCommand("mute")
            if re.search(r"\bunmute\b", query):
                return YouTubeCommand("unmute")
            speed = re.search(
                r"\b(?:play\s+at\s+|speed\s*(?:to)?\s*)(\d+(?:\.\d+)?)\s*x?\b",
                query,
            )
            if re.search(r"\bplay\s+at\s+double\s+speed\b", query):
                return YouTubeCommand("speed", value=2.0)
            if re.search(r"\bplay\s+at\s+half\s+speed\b", query):
                return YouTubeCommand("speed", value=0.5)
            if speed:
                return YouTubeCommand("speed", value=float(speed.group(1)))
            if re.search(r"\b(?:normal speed|normal playback speed)\b", query):
                return YouTubeCommand("speed", value=1.0)
            if re.search(r"\b(?:captions?|subtitles?)\b", query):
                return YouTubeCommand(
                    "captions_off"
                    if re.search(r"\b(off|disable|turn off)\b", query)
                    else "captions_on"
                )
            if re.search(r"\b(?:full\s*screen|fullscreen)\b", query):
                return YouTubeCommand(
                    "fullscreen_off"
                    if re.search(r"\b(exit|leave|off)\b", query)
                    else "fullscreen_on"
                )
            if re.search(r"\btheater(?:\s+mode)?\b", query):
                return YouTubeCommand("theater")
            if re.search(r"\bminiplayer\b", query):
                return YouTubeCommand("miniplayer")
            if re.search(r"\b(?:pause|stop)\b", query):
                return YouTubeCommand("pause")
            if re.search(r"\b(?:resume|play)\b", query):
                return YouTubeCommand("play")

        is_search = bool(self._SEARCH_PREFIX.search(query)) or (
            has_youtube
            and bool(re.search(r"\b(best|most viewed|latest|tutorial|course|playlist)\b", query))
        )
        if is_search:
            search_query = self._SEARCH_PREFIX.sub("", text.strip(), count=1).strip(" .")
            if has_youtube:
                search_query = re.sub(r"\byoutube\b", "", search_query, flags=re.I).strip()
            sort_by = self._search_sort(text)
            for qualifier in self._SEARCH_QUALIFIERS:
                search_query = re.sub(qualifier, " ", search_query, flags=re.I)
            search_query = re.sub(r"\s+", " ", search_query).strip(" .")
            search_query = re.sub(r"^(?:the\s+)?", "", search_query, flags=re.I).strip()
            search_query = re.sub(r"^(?:the\s+)", "", search_query, flags=re.I).strip()
            if search_query:
                return YouTubeCommand("search", query=search_query, sort_by=sort_by)

        return None

    def _parse_contextual(self, text: str) -> YouTubeCommand | None:
        query = text.strip().lower()
        contextual = self._parse(f"YouTube {text}")
        if contextual and contextual.action not in (
            "navigate",
            "search",
            "unsupported_account_change",
        ):
            return contextual
        ordinal = re.search(
            r"\b(?:open|play|select)\s+(?:the\s+)?(first|second|third|fourth|fifth|"
            r"\d+(?:st|nd|rd|th)?)\s+(?:one|result|video)\b",
            query,
        )
        if ordinal:
            return YouTubeCommand("select_result", index=self._ordinal(ordinal.group(1)))
        if re.search(r"\b(?:pause|stop)\b", query):
            return YouTubeCommand("pause")
        if re.search(r"\b(?:resume|play)\b", query):
            return YouTubeCommand("play")
        if re.search(r"\b(?:next|skip to next)\b", query):
            return YouTubeCommand("next")
        if re.search(r"\bprevious\b", query):
            return YouTubeCommand("previous")
        if re.search(r"\b(?:restart|start over)\b", query):
            return YouTubeCommand("restart")
        if re.search(r"\b(?:what|which|who|how long|tell me)\b", query) and (
            "playing" in query or "video" in query or "channel" in query
        ):
            return YouTubeCommand("video_info")
        return None

    @classmethod
    def _ordinal(cls, value: str) -> int | None:
        normalized = value.lower()
        if normalized in cls._ORDINALS:
            return cls._ORDINALS[normalized]
        match = re.match(r"\d+", normalized)
        return int(match.group()) if match else None

    @staticmethod
    def _seek_seconds(query: str) -> int | None:
        match = re.search(r"\b(?:seek|go)\s+(?:to\s+)?(\d{1,2}):(\d{2})\b", query)
        if match:
            return int(match.group(1)) * 60 + int(match.group(2))
        match = re.search(r"\bseek\s+to\s+(\d+)\s+minutes?(?:\s+and\s+(\d+)\s+seconds?)?\b", query)
        if match:
            return int(match.group(1)) * 60 + int(match.group(2) or 0)
        return None

    @staticmethod
    def _search_sort(text: str) -> str | None:
        normalized = text.casefold()
        if re.search(r"\b(?:most viewed|views?|view count|popular)\b", normalized):
            return "views"
        if re.search(r"\b(?:latest|recently uploaded|uploaded (?:this|last) week)\b", normalized):
            return "date"
        if re.search(r"\blongest\b", normalized):
            return "duration"
        if re.search(r"\bbest\b", normalized):
            return "quality"
        return None
