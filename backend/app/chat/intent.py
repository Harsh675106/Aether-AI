from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum


class IntentCategory(str, Enum):
    GREETING = "Greeting"
    CASUAL_CONVERSATION = "Casual Conversation"
    IDENTITY_QUESTION = "Identity Question"
    PERSONAL_MEMORY = "Personal Memory"
    CODING = "Coding"
    PROGRAMMING = "Programming"
    MATHEMATICS = "Mathematics"
    GENERAL_KNOWLEDGE = "General Knowledge"
    SCIENTIFIC_QUESTION = "Scientific Question"
    TIME_SENSITIVE_QUESTION = "Time-sensitive Question"
    NEWS = "News"
    POLITICS = "Politics"
    SPORTS = "Sports"
    FINANCE = "Finance"
    WEATHER = "Weather"
    SHOPPING = "Shopping"
    LOCAL_SEARCH = "Local Search"
    CURRENT_EVENTS = "Current Events"
    FOLLOW_UP_QUESTION = "Follow-up Question"
    FILE_ANALYSIS = "File Analysis"
    IMAGE_ANALYSIS = "Image Analysis"
    IMAGE_SEARCH = "Image Search"
    LONG_CONVERSATION = "Long Conversation"
    RESEARCH = "Research"
    BROWSER_ACTION = "Browser Action"



@dataclass(frozen=True)
class IntentClassification:
    category: IntentCategory
    confidence: int
    requires_memory: bool
    requires_search: bool
    reason: str
    optimized_query: str | None = None


class IntentClassifier:
    """Fast deterministic router that runs before model, search, or memory calls."""

    GREETINGS = {
        "hi",
        "hello",
        "hey",
        "good morning",
        "good afternoon",
        "good evening",
        "namaste",
    }
    IDENTITY_PATTERNS = (
        r"\b(who are you|what are you|what is your name|what's your name|your name)\b",
        r"\b(are you aether|who is aether)\b",
    )
    MEMORY_PATTERNS = (
        r"\b(my name|what.*i tell you|what .* do i like|language do i like|remember|recall|previous|earlier|yesterday)\b",
        r"\b(continue.*previous|continue.*code|where did we leave|what do you know about me)\b",
    )
    FOLLOW_UP_PATTERNS = (
        r"^(he|she|they|it|that|those|this|there|then|his|her|their)\b",
        r"\b(how old is (he|she|they)|what about (him|her|them|it)|and (his|her|their|its))\b",
    )
    SEARCH_TERMS = {
        "current",
        "latest",
        "today",
        "tomorrow",
        "yesterday",
        "tonight",
        "now",
        "recent",
        "breaking",
        "live",
        "upcoming",
        "news",
        "weather",
        "forecast",
        "price",
        "rate",
        "stock",
        "share price",
        "crypto",
        "bitcoin",
        "exchange rate",
        "gold price",
        "gold rate",
        "version",
        "release",
        "changelog",
        "government notification",
        "law",
        "regulation",
        "api docs",
        "documentation",
    }
    POLITICAL_CURRENT_PATTERNS = (
        r"\b(current|present|now|latest)\b.*\b(pm|prime minister|cm|chief minister|president|governor|minister)\b",
        r"\b(pm|prime minister|cm|chief minister|president|governor|minister)\b.*\b(current|present|now|latest)\b",
    )
    OFFICE_HOLDER_PATTERNS = (
        r"\b(who is|who's|name|tell me)\b.*\b(pm|prime minister|cm|chief minister|president|governor|minister)\b",
        r"\b(pm|prime minister|cm|chief minister|president|governor|minister)\b\s+(of|for|in)\b",
        r"\b(pm|prime minister|cm|chief minister)\b\??$",
    )
    STATIC_KNOWLEDGE_PATTERNS = (
        r"\bwhat is (recursion|python|java|oop|binary tree|binary search|tcp|udp|api|database)\b",
        r"\bexplain (recursion|oop|binary search|binary tree|tcp|udp|polymorphism|inheritance)\b",
        r"\bdifference between\b",
    )
    CODING_TERMS = {
        "code",
        "program",
        "function",
        "class",
        "bug",
        "debug",
        "typescript",
        "javascript",
        "python",
        "java",
        "c++",
        "fastapi",
        "react",
        "sql",
    }
    IMAGE_SEARCH_PATTERNS = (
        r"^\s*(show|find|search|display|open|pull up)\s+me\b",
        r"^\s*(show|find|search|display|open|pull up)\s+(pictures?|images?|photos?|logos?|wallpapers?|screenshots?|portraits?|posters?|icons?|pics?)\b",
        r"\b(pictures?|images?|photos?|logos?|wallpapers?|screenshots?|portraits?|posters?|icons?|pics?)\s+(of|for|about)\b",
        r"\b(show|find|search|display|open)\b.*\b(pictures?|images?|photos?|logos?|wallpapers?|screenshots?|portraits?|posters?|icons?|pics?)\b",
        r"\b(logo|wallpaper|wallpapers|screenshot|screenshots|portrait|portraits|poster|posters|icon|icons)\b",
    )
    BROWSER_SITE_KEYWORDS = (
        "youtube",
        "google",
        "github",
        "wikipedia",
        "amazon",
        "netflix",
        "reddit",
        "duckduckgo",
        "bing",
        "twitter",
        "instagram",
        "linkedin",
        "stackoverflow",
    )
    # Window control patterns are handled client-side via Tauri — classify as BROWSER_ACTION
    # so the orchestrator short-circuits without calling the planner.
    BROWSER_WINDOW_CONTROL_PATTERNS = (
        r"\b(minimize|minimise|hide|show|restore|float|detach|maximize|maximise|expand|close|pin|unpin)\b.*\bbrowser\b",
        r"\bbrowser\b.*\b(minimize|minimise|hide|show|restore|float|detach|maximize|maximise|expand|close)\b",
        r"\b(move|snap|center|position)\b.*\bbrowser\b",
        r"\bbrowser\b.*\b(always on top|on top)\b",
        r"\bkeep browser\b",
        r"^open browser$",
    )
    BROWSER_PATTERNS = (
        r"\b(open|goto|go to|navigate to|visit)\b.*\b(https?://)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})\b",
        r"\b(launch|start|open|close|restart|shutdown)\b.*\b(browser|chromium|chrome|tab|page)\b",
        r"\b(screenshot|capture|screen shot|take a screenshot)\b",
        r"\b(download|save|rename)\b.*\b(file|attachment|downloading)\b",
        r"\b(click|press|type|input|fill|select)\b.*\b(button|input|selector|field|form|text)\b",
        r"\b(go back|navigate back|go forward|reload page|refresh page)\b",
        r"^(https?://)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})(/.*)?$",
        r"\b(search|look up|find)\b.*(on the web|online|internet)\b",
    )


    def classify(self, message: str, *, has_history: bool = False) -> IntentClassification:
        normalized = self._normalize(message)
        if not normalized:
            return IntentClassification(
                category=IntentCategory.CASUAL_CONVERSATION,
                confidence=55,
                requires_memory=False,
                requires_search=False,
                reason="empty or whitespace-only message",
            )

        if normalized in self.GREETINGS or self._is_short_greeting(normalized):
            return IntentClassification(IntentCategory.GREETING, 99, False, False, "simple greeting")

        if self._matches_any(normalized, self.IDENTITY_PATTERNS):
            return IntentClassification(IntentCategory.IDENTITY_QUESTION, 98, False, False, "assistant identity question")

        # Browser window management commands (minimize, float, snap, always-on-top, etc.)
        # These are handled client-side via Tauri — the backend just confirms the intent.
        if self._matches_any(normalized, self.BROWSER_WINDOW_CONTROL_PATTERNS):
            return IntentClassification(
                IntentCategory.BROWSER_ACTION,
                99,
                False,
                False,
                "browser window management command (handled client-side)"
            )

        if self._matches_any(normalized, self.BROWSER_PATTERNS) or any(
            t in normalized for t in ("youtube.com", "google.com", "github.com", "wikipedia.org", "yahoo.com", "reddit.com", "netflix.com", "twitter.com", "x.com")
        ) or (
            any(normalized.startswith(prefix) for prefix in ("open ", "goto ", "go to ", "navigate to ", "visit ", "browse "))
            and any(keyword in normalized for keyword in self.BROWSER_SITE_KEYWORDS)
        ):
            return IntentClassification(
                IntentCategory.BROWSER_ACTION,
                97,
                False,
                False,
                "browser command or website navigation request"
            )


        if self._matches_any(normalized, self.IMAGE_SEARCH_PATTERNS) or (
            normalized.startswith(("show me ", "find me ", "show images of ", "show pictures of ", "find pictures of "))
            and "how " not in normalized
            and "why " not in normalized
            and "explain " not in normalized
        ):
            return IntentClassification(
                IntentCategory.IMAGE_SEARCH,
                96,
                False,
                False,
                "image search request",
            )

        if self._matches_any(normalized, self.MEMORY_PATTERNS):
            return IntentClassification(IntentCategory.PERSONAL_MEMORY, 94, True, False, "personal or prior-context recall")

        if has_history and self._matches_any(normalized, self.FOLLOW_UP_PATTERNS):
            requires_search = any(term in normalized for term in self.SEARCH_TERMS) or any(term in normalized for term in ("how old", "when was", "where is", "who is"))
            return IntentClassification(
                IntentCategory.FOLLOW_UP_QUESTION,
                86,
                True,
                requires_search,
                "pronoun or elliptical follow-up",
            )

        if "weather" in normalized or "forecast" in normalized:
            return IntentClassification(IntentCategory.WEATHER, 96, False, True, "weather changes over time")

        if any(term in normalized for term in ("stock", "share price", "crypto", "bitcoin", "exchange rate", "gold price", "gold rate")):
            return IntentClassification(IntentCategory.FINANCE, 95, False, True, "market data changes frequently")

        if any(term in normalized for term in ("score", "fixture", "match", "ipl", "nba", "premier league", "live sports", "t20", "captain")):
            return IntentClassification(IntentCategory.SPORTS, 94, False, True, "sports information changes frequently")

        if any(term in normalized for term in ("latest news", "breaking news", "headlines")):
            return IntentClassification(IntentCategory.NEWS, 96, False, True, "news requires current sources")

        if self._matches_any(normalized, self.POLITICAL_CURRENT_PATTERNS):
            return IntentClassification(IntentCategory.POLITICS, 96, False, True, "current office holder may have changed")

        if self._matches_any(normalized, self.OFFICE_HOLDER_PATTERNS):
            return IntentClassification(IntentCategory.POLITICS, 92, False, True, "office holder facts may be outdated")

        if any(term in normalized for term in self.SEARCH_TERMS):
            return IntentClassification(IntentCategory.TIME_SENSITIVE_QUESTION, 90, False, True, "time-sensitive term detected")

        if any(term in normalized for term in ("near me", "nearby", "in my area", "local")):
            return IntentClassification(IntentCategory.LOCAL_SEARCH, 90, False, True, "local search requires external data")

        if any(term in normalized for term in ("buy", "shopping", "best price", "discount", "deal")):
            return IntentClassification(IntentCategory.SHOPPING, 88, False, True, "shopping data changes frequently")

        if any(term in normalized for term in ("attached file", "this file", "analyze file", "pdf", "csv")):
            return IntentClassification(IntentCategory.FILE_ANALYSIS, 85, True, False, "file analysis request")

        if any(term in normalized for term in ("image", "photo", "screenshot", "picture")) and any(
            verb in normalized for verb in ("analyze", "describe", "read", "look")
        ):
            return IntentClassification(IntentCategory.IMAGE_ANALYSIS, 85, True, False, "image analysis request")

        if any(term in normalized for term in ("research", "compare sources", "deep dive", "literature review")):
            return IntentClassification(IntentCategory.RESEARCH, 86, False, True, "research request benefits from sources")

        if any(term in normalized for term in ("calculate", "solve", "equation", "integral", "derivative")):
            return IntentClassification(IntentCategory.MATHEMATICS, 90, False, False, "mathematics can be solved locally")

        if any(term in normalized for term in self.CODING_TERMS):
            category = IntentCategory.CODING if any(term in normalized for term in ("write", "fix", "debug", "code")) else IntentCategory.PROGRAMMING
            requires_search = any(term in normalized for term in ("latest", "current", "version", "docs", "documentation", "api"))
            return IntentClassification(category, 88, "previous" in normalized or "continue" in normalized, requires_search, "programming request")

        if self._matches_any(normalized, self.STATIC_KNOWLEDGE_PATTERNS):
            return IntentClassification(IntentCategory.GENERAL_KNOWLEDGE, 92, False, False, "stable conceptual knowledge")

        if any(term in normalized for term in ("physics", "chemistry", "biology", "scientific", "science")):
            return IntentClassification(IntentCategory.SCIENTIFIC_QUESTION, 82, False, False, "science question without freshness marker")

        if len(normalized.split()) > 80:
            return IntentClassification(IntentCategory.LONG_CONVERSATION, 78, True, False, "long prompt may need conversation context")

        return IntentClassification(IntentCategory.CASUAL_CONVERSATION, 76, False, False, "no external or memory trigger detected")

    def _is_short_greeting(self, normalized: str) -> bool:
        cleaned = normalized.strip("!. ")
        return cleaned in self.GREETINGS or bool(re.fullmatch(r"(hi|hello|hey)[!. ]*(aether)?", cleaned))

    def _matches_any(self, text: str, patterns: tuple[str, ...]) -> bool:
        return any(re.search(pattern, text) for pattern in patterns)

    def _normalize(self, text: str) -> str:
        return re.sub(r"\s+", " ", text.lower()).strip()






