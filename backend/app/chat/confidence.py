from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ConfidenceResult:
    score: float
    should_retry: bool
    reason: str
    signals: dict[str, float]


class ResponseConfidenceAnalyzer:
    """Advanced AI response quality evaluator."""

    LOW_CONFIDENCE_PATTERNS = (
        "i don't know",
        "i do not know",
        "i am not sure",
        "i'm not sure",
        "cannot verify",
        "can't verify",
        "no information available",
        "no data available",
        "maybe",
        "probably",
        "possibly",
        "as an ai",
        "i cannot access",
        "i don't have access",
    )

    HALLUCINATION_PATTERNS = (
        "100% guaranteed",
        "officially confirmed",
        "everyone knows",
        "without any doubt",
        "this is definitely true",
    )

    WEAK_RESPONSE_PATTERNS = (
        "sorry",
        "try again",
        "please provide more information",
        "i cannot help",
    )

    CODE_MARKERS = (
        "```python",
        "```javascript",
        "```java",
        "def ",
        "class ",
        "import ",
    )

    MINIMUM_RESPONSE_LENGTH = 40
    GOOD_RESPONSE_LENGTH = 150
    RETRY_THRESHOLD = 0.55
    REPETITION_THRESHOLD = 0.35

    def analyze(
        self,
        response: str,
        *,
        query: str | None = None,
        citations: int = 0,
    ) -> ConfidenceResult:
        """Analyze generated response quality."""

        if not response:
            return ConfidenceResult(
                score=0.0,
                should_retry=True,
                reason="empty response",
                signals={"empty": 1.0},
            )

        text = response.lower().strip()
        score = 1.0
        reasons: list[str] = []
        signals: dict[str, float] = {}

        uncertainty_hits = 0
        for pattern in self.LOW_CONFIDENCE_PATTERNS:
            if pattern in text:
                uncertainty_hits += 1
                reasons.append(f"uncertain:{pattern}")

        if uncertainty_hits:
            penalty = min(uncertainty_hits * 0.12, 0.35)
            score -= penalty
            signals["uncertainty"] = penalty

        hallucination_hits = 0
        for pattern in self.HALLUCINATION_PATTERNS:
            if pattern in text:
                hallucination_hits += 1
                reasons.append(f"absolute_claim:{pattern}")

        if hallucination_hits:
            penalty = min(hallucination_hits * 0.08, 0.25)
            score -= penalty
            signals["hallucination_risk"] = penalty

        response_length = len(text)
        if response_length < self.MINIMUM_RESPONSE_LENGTH:
            score -= 0.20
            reasons.append("very short response")
            signals["length_penalty"] = 0.20
        elif response_length > self.GOOD_RESPONSE_LENGTH:
            score += 0.05
            signals["complete_answer"] = 0.05

        weak_hits = 0
        for pattern in self.WEAK_RESPONSE_PATTERNS:
            if pattern in text:
                weak_hits += 1
                reasons.append(f"weak:{pattern}")

        if weak_hits:
            penalty = min(weak_hits * 0.10, 0.25)
            score -= penalty
            signals["weak_answer"] = penalty

        words = text.split()
        if len(words) > 20:
            unique_ratio = len(set(words)) / len(words)
            if unique_ratio < self.REPETITION_THRESHOLD:
                score -= 0.15
                reasons.append("repetitive response")
                signals["repetition"] = -0.15

        if any(marker in text for marker in self.CODE_MARKERS):
            if len(text) < 100:
                score -= 0.1
                reasons.append("incomplete code response")

        if query:
            query_words = {
                word for word in re.findall(r"\w+", query.lower()) if len(word) > 3
            }
            response_words = set(re.findall(r"\w+", text))
            overlap = len(query_words & response_words) / max(len(query_words), 1)

            if len(query_words) > 3 and overlap < 0.15:
                score -= 0.15
                reasons.append("low query relevance")
                signals["relevance"] = -0.15

        if citations >= 2:
            score += 0.10
            signals["verified_sources"] = 0.10
        elif citations == 1:
            score += 0.05
            signals["single_source"] = 0.05

        score = max(0.0, min(score, 0.98))
        should_retry = score < self.RETRY_THRESHOLD
        signals["analyzer_version"] = 1.0

        return ConfidenceResult(
            score=round(score, 2),
            should_retry=should_retry,
            reason=", ".join(reasons) if reasons else "high confidence",
            signals=signals,
        )