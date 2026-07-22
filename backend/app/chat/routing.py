from __future__ import annotations

from dataclasses import dataclass

from app.chat.intent import IntentCategory, IntentClassification


@dataclass(frozen=True)
class RoutingDecision:
    intent: IntentClassification
    use_memory: bool
    use_search: bool
    use_image_search: bool
    use_ollama: bool
    use_tools: bool
    use_planner: bool
    confidence: int
    reason: str


class RoutingEngine:
    """
    Determines which backend components should participate
    in answering the current request.
    """

    DIRECT_INTENTS = {
        IntentCategory.GREETING,
        IntentCategory.IDENTITY_QUESTION,
    }

    SEARCH_CONFIDENCE_THRESHOLD = 80
    MEMORY_CONFIDENCE_THRESHOLD = 70

    def decide(self, intent: IntentClassification) -> RoutingDecision:
        if intent.category in self.DIRECT_INTENTS:
            return RoutingDecision(
                intent=intent,
                use_memory=False,
                use_search=False,
                use_image_search=False,
                use_ollama=False,
                use_tools=False,
                use_planner=False,
                confidence=max(intent.confidence, 98),
                reason="Handled using deterministic assistant response.",
            )

        if intent.category == IntentCategory.IMAGE_SEARCH:
            return RoutingDecision(
                intent=intent,
                use_memory=False,
                use_search=False,
                use_image_search=True,
                use_ollama=False,
                use_tools=False,
                use_planner=False,
                confidence=max(intent.confidence, 95),
                reason="Image search should be handled by the dedicated image service.",
            )

        if intent.requires_search:
            return RoutingDecision(
                intent=intent,
                use_memory=intent.requires_memory,
                use_search=True,
                use_image_search=False,
                use_ollama=True,
                use_tools=False,
                use_planner=False,
                confidence=max(intent.confidence, self.SEARCH_CONFIDENCE_THRESHOLD),
                reason="Current or external knowledge required before response generation.",
            )

        if intent.requires_memory:
            return RoutingDecision(
                intent=intent,
                use_memory=True,
                use_search=False,
                use_image_search=False,
                use_ollama=True,
                use_tools=False,
                use_planner=False,
                confidence=max(intent.confidence, self.MEMORY_CONFIDENCE_THRESHOLD),
                reason="Relevant memory should be retrieved before generation.",
            )

        return RoutingDecision(
            intent=intent,
            use_memory=False,
            use_search=False,
            use_image_search=False,
            use_ollama=True,
            use_tools=False,
            use_planner=False,
            confidence=max(intent.confidence, 85),
            reason="Local model is sufficient for answering the request.",
        )