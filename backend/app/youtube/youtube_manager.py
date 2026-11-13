from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from urllib.parse import quote_plus, urlsplit

from app.core.logging import get_logger
from app.youtube.models import YouTubeCommand

logger = get_logger(__name__)

_YOUTUBE_HOSTS = ("youtube.com", "youtu.be")
_RESULTS_SCRIPT = """() => Array.from(document.querySelectorAll('ytd-video-renderer'))
  .map(node => {
    const link = node.querySelector('a#video-title');
    const title = link?.getAttribute('title') || link?.innerText?.trim() || '';
    const href = link?.href || '';
    const channel = node.querySelector('ytd-channel-name a')?.innerText?.trim() || '';
    const metadata = Array.from(node.querySelectorAll('#metadata-line span'))
      .map(item => item.innerText.trim()).filter(Boolean);
    return {title, url: href, channel, metadata};
  })
  .filter(item => item.title && item.url && /^https?:/.test(item.url))
  .slice(0, 20)"""
_VIDEO_INFO_SCRIPT = """() => {
  const video = document.querySelector('video');
  const title = document.querySelector('h1 yt-formatted-string')?.innerText
    || document.querySelector('h1')?.innerText || document.title;
  const channel = document.querySelector('#owner #channel-name a')?.innerText?.trim() || '';
  const description = document.querySelector('#description-inner')?.innerText?.trim() || '';
  return {
    title, channel, url: location.href,
    duration: Number.isFinite(video?.duration) ? video.duration : null,
    currentTime: video?.currentTime ?? null,
    paused: video?.paused ?? null,
    volume: video?.volume ?? null,
    muted: video?.muted ?? null,
    description
  };
}"""
_OPEN_VIDEO_SCRIPT = """() => new Promise(resolve => {
  const started = Date.now();
  const read = () => {
    const video = document.querySelector('video');
    if (video) {
      const title = document.querySelector('h1')?.innerText || document.title;
      resolve({paused: video.paused, title});
    } else if (Date.now() - started > 7000) {
      resolve({error: 'YouTube video player did not load'});
    } else {
      setTimeout(read, 200);
    }
  };
  read();
})"""


class YouTubeManager:
    """YouTube operations over the existing centralized BrowserManager only."""

    SECTION_URLS = {
        "home": "https://www.youtube.com/",
        "shorts": "https://www.youtube.com/shorts",
        "subscriptions": "https://www.youtube.com/feed/subscriptions",
        "watch_later": "https://www.youtube.com/playlist?list=WL",
        "liked": "https://www.youtube.com/playlist?list=LL",
        "playlists": "https://www.youtube.com/feed/playlists",
        "history": "https://www.youtube.com/feed/history",
        "library": "https://www.youtube.com/feed/library",
        "trending": "https://www.youtube.com/feed/trending",
        "channel": "https://www.youtube.com/feed/you",
        "music": "https://music.youtube.com/",
    }

    def __init__(self, browser_manager: Any) -> None:
        self.browser = browser_manager
        self._results: dict[str, list[dict[str, Any]]] = {}
        self._selected: dict[str, dict[str, Any]] = {}

    async def is_active(self) -> bool:
        host = urlsplit(await self.browser.get_current_url()).hostname
        return bool(
            host and any(host == domain or host.endswith(f".{domain}") for domain in _YOUTUBE_HOSTS)
        )

    async def execute(self, command: YouTubeCommand, conversation_id: str | None) -> str:
        action = command.action
        if action == "navigate":
            return await self.navigate(command.section or "home")
        if action == "search":
            return await self.search(command.query or "", conversation_id, command.sort_by)
        if action == "select_result":
            return await self.select_result(command.index or 1, conversation_id)
        if action == "history_play":
            return await self.play_latest_history(conversation_id)
        if action == "history_search":
            return await self.search_history(command.query or "", conversation_id)
        if action in ("video_info", "description", "copy_link"):
            return await self.video_information(action)
        if action == "unsupported_account_change":
            return (
                "I can open YouTube account pages, but playlist and subscription changes "
                "aren't implemented yet. I haven't changed your account."
            )
        if action == "unsupported_channel":
            return (
                "Opening a specific YouTube channel by name isn't supported yet. "
                "I haven't changed your account."
            )
        if action == "unsupported_feature":
            return "That YouTube operation isn't supported yet; I haven't changed your account."
        return await self.control(command)

    async def navigate(self, section: str) -> str:
        url = self.SECTION_URLS.get(section)
        if not url:
            raise ValueError(f"Unknown YouTube section: {section}")
        current_url = await self.browser.get_current_url()
        if current_url.rstrip("/") != url.rstrip("/"):
            await self.browser.navigate(url)
        actual_url = (await self.browser.get_current_url()).lower()
        if "accounts.google.com" in actual_url or "signin" in actual_url:
            return (
                "YouTube requires sign-in for that page. "
                "Sign in through the Aether Floating Browser."
            )
        host = urlsplit(actual_url).hostname or ""
        is_youtube_host = any(
            host == domain or host.endswith(f".{domain}") for domain in _YOUTUBE_HOSTS
        )
        if section != "music" and not is_youtube_host:
            raise RuntimeError("YouTube navigation did not reach a YouTube page.")
        if section == "music" and host != "music.youtube.com":
            raise RuntimeError("YouTube Music navigation did not reach YouTube Music.")
        labels = {
            "home": "YouTube home",
            "shorts": "YouTube Shorts",
            "subscriptions": "your subscriptions",
            "watch_later": "Watch Later",
            "liked": "your liked videos",
            "playlists": "your playlists",
            "history": "your watch history",
            "library": "your library",
            "trending": "YouTube trending",
            "channel": "your YouTube account page",
            "music": "YouTube Music",
        }
        return f"Opening {labels[section]} in the Aether Floating Browser."

    async def search(
        self,
        query: str,
        conversation_id: str | None,
        sort_by: str | None = None,
    ) -> str:
        if not query.strip():
            return "Tell me what you'd like to search for on YouTube."
        url = f"https://www.youtube.com/results?search_query={quote_plus(query.strip())}"
        await self.browser.navigate(url)
        results = await self._read_results()
        self._results[self._key(conversation_id)] = results
        if not results:
            return (
                f"I searched YouTube for {query!r}, but no video results "
                "were available on the page."
            )
        lines = [f"I found these YouTube results for {query!r}:"]
        for index, result in enumerate(results[:5], start=1):
            metadata = " · ".join(result.get("metadata") or [])
            channel = result.get("channel") or "Channel not shown"
            line = f"{index}. {result['title']} — {channel}"
            if metadata:
                line += f" ({metadata})"
            lines.append(line)
        if sort_by == "views":
            lines.append(
                "I can't reliably rank these by view count because YouTube hasn't exposed "
                "a verified numeric count for every visible result."
            )
        elif sort_by == "date":
            lines.append("YouTube's visible results aren't guaranteed to be sorted by upload date.")
        elif sort_by == "duration":
            lines.append("I can't reliably rank by duration unless each result exposes it.")
        elif sort_by == "quality":
            lines.append(
                "Popularity and educational quality are different; I can't verify course "
                "quality from search-result metadata alone."
            )
        lines.append("Say “open the second result” to choose one.")
        return "\n".join(lines)

    async def select_result(self, index: int, conversation_id: str | None) -> str:
        results = self._results.get(self._key(conversation_id), [])
        if not results:
            return "There are no saved YouTube search results in this conversation. Search first."
        if index < 1 or index > len(results):
            return f"I only have {len(results)} visible results to choose from."
        result = results[index - 1]
        video_url = str(result["url"])
        if not self._is_youtube_url(video_url):
            raise RuntimeError("The selected result is not a YouTube video URL.")
        await self.browser.navigate(video_url)
        self._selected[self._key(conversation_id)] = result
        return await self._start_video(result, index)

    async def play_latest_history(self, conversation_id: str | None) -> str:
        await self.navigate("history")
        entries = await self._read_results()
        if not entries:
            return (
                "I couldn't read any video entries from the signed-in YouTube history page. "
                "Check that you're signed in and watch history is enabled."
            )
        latest = entries[0]
        history_video_url = str(latest["url"])
        if not self._is_youtube_url(history_video_url):
            raise RuntimeError("The newest visible history entry is not a YouTube video URL.")
        await self.browser.navigate(history_video_url)
        self._selected[self._key(conversation_id)] = latest
        result = await self._start_video(latest)
        if result.startswith("Playing"):
            return f"Your newest visible history entry is playing: {latest['title']}."
        return f"Your newest visible history entry is open: {latest['title']}. {result}"

    async def _start_video(self, result: Mapping[str, Any], index: int | None = None) -> str:
        state = await self.browser.execute_javascript(_OPEN_VIDEO_SCRIPT)
        if not isinstance(state, Mapping) or state.get("error"):
            raise RuntimeError(
                str(state.get("error") if isinstance(state, Mapping) else "Video state unavailable")
            )
        if state.get("paused") is True:
            await self.browser.click_element("button.ytp-large-play-button")
            state = await self.browser.execute_javascript(
                "() => ({paused: document.querySelector('video')?.paused ?? true})"
            )
        title = result.get("title", "the selected video")
        if isinstance(state, Mapping) and state.get("paused") is False:
            prefix = f"Playing result {index}: " if index is not None else "Playing "
            return f"{prefix}{title}."
        return f"Opened {title}, but playback didn't start. Use Play to begin."

    async def search_history(self, query: str, conversation_id: str | None) -> str:
        await self.navigate("history")
        entries = await self._read_results()
        if not entries:
            return (
                "I couldn't read video entries from your YouTube history. "
                "Check that you're signed in and watch history is enabled."
            )
        if query:
            matching = [
                entry
                for entry in entries
                if query.casefold() in str(entry.get("title", "")).casefold()
            ]
        else:
            matching = entries
        self._results[self._key(conversation_id)] = matching
        if not matching:
            return f"I couldn't find {query!r} among the history entries currently loaded."
        return self._format_results(matching, f"Visible history entries matching {query!r}")

    async def video_information(self, action: str) -> str:
        if not await self.is_active():
            return "There isn't an active YouTube page in the Aether Floating Browser."
        info = await self.browser.execute_javascript(_VIDEO_INFO_SCRIPT)
        if not isinstance(info, Mapping) or not info.get("title"):
            return "I couldn't read video information from the active YouTube page."
        if action == "copy_link":
            return f"The current video link is {info.get('url') or 'unavailable'}."
        if action == "description":
            description = str(info.get("description") or "").strip()
            return description or "No video description is visible on the current page."
        duration = self._format_duration(info.get("duration"))
        channel = info.get("channel") or "channel not shown"
        if info.get("paused") is True:
            state = "paused"
        elif info.get("paused") is False:
            state = "playing"
        else:
            state = "unknown"
        return (
            f"Current video: {info['title']} — {channel}. Duration: {duration}. Playback: {state}."
        )

    async def control(self, command: YouTubeCommand) -> str:
        if not await self.is_active():
            return "Open a YouTube video in the Aether Floating Browser first."
        action = command.action
        if action in (
            "play",
            "pause",
            "restart",
            "toggle_playback",
            "resume_speed",
            "skip_forward",
            "skip_backward",
            "seek",
            "volume",
            "volume_up",
            "volume_down",
            "mute",
            "unmute",
            "speed",
        ):
            value = command.value
            seconds = command.seconds or 0
            if action == "volume" and not 0 <= int(value or 0) <= 100:
                raise ValueError("Volume must be between 0 and 100 percent.")
            if action == "speed" and not 0.25 <= float(value or 1) <= 2:
                raise ValueError("Playback speed must be between 0.25x and 2x.")
            operations = {
                "play": "video.play();",
                "pause": "video.pause();",
                "restart": "video.currentTime = 0; video.play();",
                "skip_forward": (
                    "video.currentTime = Math.min(video.duration || Infinity, "
                    f"video.currentTime + {seconds});"
                ),
                "skip_backward": (
                    f"video.currentTime = Math.max(0, video.currentTime - {seconds});"
                ),
                "seek": (
                    "video.currentTime = Math.min(video.duration || Infinity, "
                    f"{command.seconds or 0});"
                ),
                "volume": f"video.volume = {max(0, min(100, int(value or 0))) / 100};",
                "mute": "video.muted = true;",
                "unmute": "video.muted = false;",
                "speed": f"video.playbackRate = {max(0.25, min(2, float(value or 1)))};",
                "volume_up": "video.volume = Math.min(1, video.volume + 0.1);",
                "volume_down": "video.volume = Math.max(0, video.volume - 0.1);",
                "toggle_playback": ("if (video.paused) await video.play(); else video.pause();"),
                "resume_speed": (
                    f"video.playbackRate = {max(0.25, min(2, float(value or 1)))}; "
                    "await video.play();"
                ),
            }
            if action == "play":
                operation = "await video.play();"
            elif action == "restart":
                operation = "video.currentTime = 0; await video.play();"
            else:
                operation = operations[action]
            state = await self.browser.execute_javascript(
                f"""async () => {{
                  const video = document.querySelector('video');
                  if (!video) return {{error: 'No active video element'}};
                  {operation}
                  return {{paused: video.paused, currentTime: video.currentTime,
                    volume: video.volume, muted: video.muted, playbackRate: video.playbackRate}};
                }}"""
            )
            if not isinstance(state, Mapping):
                raise RuntimeError("YouTube did not return a verifiable playback state.")
            if state.get("error"):
                raise RuntimeError(str(state["error"]))
            if action == "pause" and state.get("paused") is not True:
                raise RuntimeError("The video did not enter the paused state.")
            if action == "play" and state.get("paused") is True:
                raise RuntimeError("YouTube did not start or resume playback.")
            if action == "resume_speed" and (
                state.get("paused") is True
                or abs(float(state.get("playbackRate", 0)) - float(value or 1)) > 0.01
            ):
                raise RuntimeError("YouTube did not resume at the requested speed.")
            if action == "volume":
                expected_volume = int(value or 0) / 100
                if abs(float(state.get("volume", -1)) - expected_volume) > 0.01:
                    raise RuntimeError("YouTube did not apply the requested volume.")
            if (
                action == "speed"
                and abs(float(state.get("playbackRate", 0)) - float(value or 1)) > 0.01
            ):
                raise RuntimeError("YouTube did not apply the requested playback speed.")
            if action == "mute" and state.get("muted") is not True:
                raise RuntimeError("YouTube did not mute the video.")
            if action == "unmute" and state.get("muted") is not False:
                raise RuntimeError("YouTube did not unmute the video.")
            return self._control_confirmation(action, state, command.seconds)

        if action in (
            "next",
            "previous",
            "captions_on",
            "captions_off",
            "fullscreen_on",
            "fullscreen_off",
            "theater",
            "miniplayer",
        ):
            selector_by_action = {
                "next": ".ytp-next-button",
                "previous": ".ytp-prev-button",
                "captions_on": ".ytp-subtitles-button",
                "captions_off": ".ytp-subtitles-button",
                "theater": ".ytp-size-button",
                "miniplayer": ".ytp-miniplayer-button",
            }
            if action.startswith("fullscreen_"):
                should_enable = action == "fullscreen_on"
                script = f"""async () => {{
                  const video = document.querySelector('video');
                  if (!video) return {{error: 'No active video element'}};
                  const enabled = document.fullscreenElement !== null;
                  const player = document.querySelector('.html5-video-player');
                  if ({str(should_enable).lower()} && !enabled) {{
                    await (video.requestFullscreen?.() || player?.requestFullscreen());
                  }}
                  if (!{str(should_enable).lower()} && enabled) {{
                    await document.exitFullscreen();
                  }}
                  return {{enabled: document.fullscreenElement !== null}};
                }}"""
                state = await self.browser.execute_javascript(script)
                if not isinstance(state, Mapping) or state.get("error"):
                    raise RuntimeError("Fullscreen could not be changed by YouTube.")
                if state.get("enabled") is not should_enable:
                    raise RuntimeError("YouTube did not enter the requested fullscreen state.")
                return "Fullscreen enabled." if state.get("enabled") else "Fullscreen exited."
            selector = selector_by_action[action]
            state = await self.browser.execute_javascript(
                f"""() => {{
                  const button = document.querySelector('{selector}');
                  if (!button || button.disabled) return {{found: false}};
                  const before = button.getAttribute('aria-pressed');
                  if ('{action}' === 'captions_on' && before === 'true')
                    return {{found: true, active: true}};
                  if ('{action}' === 'captions_off' && before !== 'true')
                    return {{found: true, active: false}};
                  button.click();
                  return {{found: true, active: button.getAttribute('aria-pressed') === 'true'}};
                }}"""
            )
            expected_active = action == "captions_on"
            if not isinstance(state, Mapping) or not state.get("found"):
                raise RuntimeError(
                    f"YouTube does not currently expose the {action.replace('_', ' ')} control."
                )
            if action.startswith("captions_") and state.get("active") is not expected_active:
                raise RuntimeError("YouTube did not confirm the requested captions state.")
            return f"YouTube {action.replace('_', ' ')} command sent."
        raise ValueError(f"Unsupported YouTube action: {action}")

    async def _read_results(self) -> list[dict[str, Any]]:
        # Wait on the active page's DOM; no extra browser or background session is created.
        result = await self.browser.execute_javascript(
            f"""() => new Promise(resolve => {{
              const started = Date.now();
              const read = () => {{
                const items = ({_RESULTS_SCRIPT})();
                if (items.length || Date.now() - started > 7000) resolve(items);
                else setTimeout(read, 200);
              }};
              read();
            }})"""
        )
        if not isinstance(result, list):
            return []
        return [
            dict(item)
            for item in result
            if isinstance(item, Mapping) and self._is_youtube_url(str(item.get("url", "")))
        ]

    @staticmethod
    def _format_results(results: list[dict[str, Any]], heading: str) -> str:
        lines = [f"{heading}:"]
        for index, result in enumerate(results[:5], start=1):
            metadata = " · ".join(result.get("metadata") or [])
            title = result.get("title", "Untitled")
            channel = result.get("channel") or "Channel not shown"
            line = f"{index}. {title} — {channel}"
            if metadata:
                line += f" ({metadata})"
            lines.append(line)
        return "\n".join(lines)

    @staticmethod
    def _control_confirmation(
        action: str,
        state: Mapping[str, Any],
        seconds: int | None = None,
    ) -> str:
        if action == "pause":
            return "Video paused."
        if action == "play":
            return "Video resumed."
        if action == "toggle_playback":
            return "Video paused." if state.get("paused") is True else "Video resumed."
        if action == "resume_speed":
            return f"Video resumed at {state.get('playbackRate')}x speed."
        if action == "restart":
            return "Video restarted."
        if action == "skip_forward":
            return f"Skipped forward {seconds or 0} seconds."
        if action == "skip_backward":
            return f"Skipped back {seconds or 0} seconds."
        if action == "seek":
            return f"Moved to {state.get('currentTime', 0):.0f} seconds."
        if action == "volume":
            return f"Volume set to {round(float(state.get('volume', 0)) * 100)} percent."
        if action in ("volume_up", "volume_down"):
            return f"Volume changed to {round(float(state.get('volume', 0)) * 100)} percent."
        if action == "mute":
            return "Video muted."
        if action == "unmute":
            return "Video unmuted."
        if action == "speed":
            return f"Playback speed set to {state.get('playbackRate')}x."
        return "YouTube playback control completed."

    @staticmethod
    def _format_duration(value: Any) -> str:
        if not isinstance(value, (int, float)):
            return "unavailable"
        seconds = max(0, int(value))
        minutes, seconds = divmod(seconds, 60)
        hours, minutes = divmod(minutes, 60)
        return f"{hours}:{minutes:02d}:{seconds:02d}" if hours else f"{minutes}:{seconds:02d}"

    @staticmethod
    def _key(conversation_id: str | None) -> str:
        return conversation_id or "__default__"

    @staticmethod
    def _is_youtube_url(url: str) -> bool:
        host = urlsplit(url).hostname
        return bool(
            host and any(host == domain or host.endswith(f".{domain}") for domain in _YOUTUBE_HOSTS)
        )
