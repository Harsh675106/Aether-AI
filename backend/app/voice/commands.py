from __future__ import annotations

import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)

# Strict allowlist of applications that can be launched
ALLOWED_APPS: dict[str, str] = {
    "calc": "calc.exe",
    "calculator": "calc.exe",
    "notepad": "notepad.exe",
    "paint": "mspaint.exe",
}

# Safe system folders allowed to be opened
SAFE_USER_FOLDERS: dict[str, str] = {
    "downloads": str(Path.home() / "Downloads"),
    "download": str(Path.home() / "Downloads"),
    "documents": str(Path.home() / "Documents"),
    "document": str(Path.home() / "Documents"),
    "desktop": str(Path.home() / "Desktop"),
    "pictures": str(Path.home() / "Pictures"),
    "music": str(Path.home() / "Music"),
    "videos": str(Path.home() / "Videos"),
}


def _launch_allowlisted_action(arguments: list[str]) -> None:
    # Arguments come only from the fixed app and user-folder allowlists.
    subprocess.Popen(arguments, shell=False)  # noqa: S603, S607


class VoiceCommandResult:
    def __init__(
        self,
        handled: bool,
        message: str = "",
        action_type: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.handled = handled
        self.message = message
        self.action_type = action_type
        self.metadata = metadata or {}


class VoiceCommandExecutor:
    """Secure, allowlist-based voice command parser and executor for Windows desktop."""

    @staticmethod
    def execute(transcript: str) -> VoiceCommandResult:
        raw = transcript.strip()
        lower = raw.lower()

        # ── 1. Date & Time Queries ───────────────────────────────────────────
        date_pattern = (
            r"\b(what('s| is) (the )?date|tell me today('s)? date|today('s)? date|aaj ka date|"
            r"aaj ki date|kya tareekh|tareekh kya|aaj kya tareekh|aaj kaun sa din)\b"
        )
        if (
            re.search(
                date_pattern,
                lower,
            )
            or "तारीख" in raw
            or "आज कौन सा दिन" in raw
        ):
            today_str = datetime.now().strftime("%A, %B %d, %Y")
            return VoiceCommandResult(
                handled=True,
                message=f"Today is {today_str}.",
                action_type="system_query",
            )

        time_pattern = (
            r"\b(what('s| is) (the )?time|tell me the time|current time|kya samay hai|"
            r"kitne baje hai|samay kya)\b"
        )
        if (
            re.search(
                time_pattern,
                lower,
            )
            or "समय" in raw
            or "कितने बजे" in raw
        ):
            time_str = datetime.now().strftime("%I:%M %p")
            return VoiceCommandResult(
                handled=True,
                message=f"The time is {time_str}.",
                action_type="system_query",
            )

        # ── 2. Open System Folders ───────────────────────────────────────────
        folder_match = re.search(
            r"\b(?:open (?:my )?([a-z]+)(?: folder)?|([a-z]+) folder kholo)\b", lower
        )
        if folder_match:
            folder_key = (folder_match.group(1) or folder_match.group(2) or "").strip()
            if folder_key in SAFE_USER_FOLDERS:
                folder_path = Path(SAFE_USER_FOLDERS[folder_key]).resolve()
                home_path = Path.home().resolve()
                if home_path not in folder_path.parents:
                    return VoiceCommandResult(
                        handled=False,
                        message="Requested folder is outside the user profile.",
                        action_type="error",
                    )
                if Path(folder_path).is_dir():
                    try:
                        if sys.platform == "win32":
                            _launch_allowlisted_action(["explorer.exe", str(folder_path)])
                        else:
                            _launch_allowlisted_action(["xdg-open", str(folder_path)])

                        logger.info("opened_user_folder", folder=folder_key, path=folder_path)
                        return VoiceCommandResult(
                            handled=True,
                            message=f"Opening your {folder_key.capitalize()} folder.",
                            action_type="folder_open",
                            metadata={"path": folder_path},
                        )
                    except Exception as err:
                        logger.error("folder_open_failed", error=str(err))
                        return VoiceCommandResult(
                            handled=True,
                            message=f"I couldn't open the {folder_key} folder.",
                            action_type="error",
                        )

        # ── 3. Open Allowed Applications ─────────────────────────────────────
        app_match = re.search(r"\b(?:open ([a-z ]+)|([a-z ]+) (?:kholo|chalu karo))\b", lower)
        if app_match:
            app_key = (app_match.group(1) or app_match.group(2) or "").strip()
            # Normalize Hindi / shorthand terms
            if "calc" in app_key or "कैलकुलेटर" in raw:
                app_key = "calculator"
            elif "notepad" in app_key or "नोटपैड" in raw:
                app_key = "notepad"
            if app_key in ALLOWED_APPS:
                exe_name = ALLOWED_APPS[app_key]
                try:
                    if sys.platform == "win32":
                        if exe_name in ("calc.exe", "notepad.exe", "mspaint.exe"):
                            _launch_allowlisted_action([exe_name])
                        else:
                            _launch_allowlisted_action(["cmd.exe", "/c", "start", "", exe_name])
                    else:
                        _launch_allowlisted_action([exe_name])

                    logger.info("launched_allowed_app", app=app_key, binary=exe_name)
                    return VoiceCommandResult(
                        handled=True,
                        message=f"Opening {app_key.capitalize()}.",
                        action_type="app_launch",
                        metadata={"app": app_key, "binary": exe_name},
                    )
                except Exception as err:
                    logger.error("app_launch_failed", app=app_key, error=str(err))
                    return VoiceCommandResult(
                        handled=True,
                        message=f"Unable to launch {app_key.capitalize()}.",
                        action_type="error",
                    )

        # Website and web-search intents are left unhandled so the frontend can
        # execute them in Aether's floating browser instead of opening a desktop browser.
        return VoiceCommandResult(handled=False)
