import re
import json
from collections.abc import Sequence
from typing import Any

from app.core.interfaces import Planner, LLMProvider
from app.core.settings import Settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class PlaceholderPlanner(Planner):
    """Planner that generates step-by-step actions for browser automation and other objectives."""

    COMMON_SITE_REDIRECTS = {
        "youtube": "https://www.youtube.com",
        "google": "https://www.google.com",
        "github": "https://github.com",
        "wikipedia": "https://www.wikipedia.org",
        "amazon": "https://www.amazon.com",
        "netflix": "https://www.netflix.com",
        "reddit": "https://www.reddit.com",
        "duckduckgo": "https://duckduckgo.com",
        "bing": "https://www.bing.com",
    }

    def __init__(self, settings: Settings | None = None, llm_provider: LLMProvider | None = None) -> None:
        self._settings = settings
        self._llm_provider = llm_provider

    async def create_plan(self, objective: str) -> Sequence[str]:
        """Creates an ordered plan for a given objective."""
        objective_lower = objective.lower().strip()

        # 1. Deterministic/Fast Planning for Explicit Browser Directives
        
        # Navigate direct matching
        open_match = re.match(
            r"^(?:open|goto|go to|navigate to|visit)\s+(https?://)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}.*)$", 
            objective_lower
        )
        if open_match:
            scheme, domain_path = open_match.groups()
            url = f"{scheme or 'https://'}{domain_path}"
            return [f"open:{url}"]

        # Plain domain matching (e.g. "youtube.com")
        domain_match = re.match(r"^(https?://)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:/.*)?)$", objective_lower)
        if domain_match:
            scheme, domain_path = domain_match.groups()
            url = f"{scheme or 'https://'}{domain_path}"
            return [f"open:{url}"]

        # Common site name shortcuts (e.g. "open youtube")
        browser_command_match = re.match(
            r"^(?:open|goto|go to|navigate to|visit)\s+(?P<target>[a-z0-9-]+)(?:\s+.*)?$",
            objective_lower,
        )
        if browser_command_match:
            target = browser_command_match.group("target")
            if target in self.COMMON_SITE_REDIRECTS:
                return [f"open:{self.COMMON_SITE_REDIRECTS[target]}"]

        if objective_lower in self.COMMON_SITE_REDIRECTS:
            return [f"open:{self.COMMON_SITE_REDIRECTS[objective_lower]}"]

        # Screenshot command
        if any(kw in objective_lower for kw in ("screenshot", "take screenshot", "capture screen")):
            full_page = "full" in objective_lower
            return [f"screenshot:{'full' if full_page else 'viewport'}"]

        # Basic window and navigation state commands
        if any(kw in objective_lower for kw in ("scroll down", "page down")):
            return ["scroll:down"]
        if any(kw in objective_lower for kw in ("scroll up", "page up")):
            return ["scroll:up"]
        if any(kw in objective_lower for kw in ("minimize browser", "hide browser", "minimize")):
            return ["minimize"]
        if any(kw in objective_lower for kw in ("restore browser", "show browser", "bring back browser")):
            return ["restore"]
        if any(kw in objective_lower for kw in ("maximize browser", "expand browser")):
            return ["maximize"]
        if any(kw in objective_lower for kw in ("go back", "navigate back", "back page")):
            return ["back"]
        if any(kw in objective_lower for kw in ("go forward", "forward page")):
            return ["forward"]
        if any(kw in objective_lower for kw in ("reload page", "refresh page", "reload", "refresh")):
            return ["reload"]
        if any(kw in objective_lower for kw in ("close tab", "close page", "close browser")):
            return ["close_tab"]

        # 2. LLM-Based Planning for Complex Actions (if provider is injected)
        if self._llm_provider:
            logger.info("using_llm_for_browser_planning", objective=objective)
            prompt = (
                "You are an AI Browser Automation Planner for Aether AI.\n"
                f"User Goal: \"{objective}\"\n\n"
                "Formulate a plan using only the following supported browser action step strings:\n"
                "- open:<url_or_search_query> (e.g. open:https://news.ycombinator.com or open:python tutorials)\n"
                "- click:<css_selector> (e.g. click:button#submit)\n"
                "- type:<css_selector>|<text_to_type> (e.g. type:input[name='q']|playwright python)\n"
                "- screenshot:full or screenshot:viewport\n"
                "- back\n"
                "- forward\n"
                "- reload\n"
                "- close_tab\n\n"
                "Return ONLY a valid JSON list of strings representing the sequence of actions. "
                "Do NOT include any markdown formatting, explanation, or conversational text. "
                "Keep the plan as short and efficient as possible.\n\n"
                "Example response:\n"
                "[\"open:https://news.ycombinator.com\", \"click:a.storylink\", \"screenshot:viewport\"]\n"
            )
            try:
                raw_response = await self._llm_provider.complete(prompt)
                cleaned = raw_response.strip()
                # Remove markdown fences if model returned them
                if cleaned.startswith("```"):
                    cleaned = re.sub(r"^```(?:json)?\n|```$", "", cleaned, flags=re.MULTILINE).strip()
                
                plan = json.loads(cleaned)
                if isinstance(plan, list) and all(isinstance(step, str) for step in plan):
                    logger.info("llm_browser_plan_created", plan=plan)
                    return plan
            except Exception as exc:
                logger.warning("llm_browser_planning_failed_falling_back", error=str(exc))

        # 3. Default fallback
        logger.info("falling_back_to_default_open_query_step", objective=objective)
        return [f"open:{objective}"]
