from __future__ import annotations


class TopicGuard:
    def __init__(self):
        self.allowed_topics = {
            "consultant",
            "consulting",
            "talent",
            "skills",
            "experience",
            "availability",
            "domain",
            "project",
            "finance",
            "hr",
            "legal",
            "it",
            "data",
            "ai",
            "strategy",
            "company",
            "ofstride",
            "service",
            "about",
            "contact",
            "support",
            "call",
            "email",
        }
        self.blocked_patterns = [
            "ignore previous instructions",
            "reveal system prompt",
            "developer instructions",
            "exfiltrate",
            "malware",
            "sql injection",
            "ddos",
        ]

    def check(self, text: str) -> tuple[bool, str | None]:
        normalized = text.lower().strip()
        if not normalized:
            return False, "Empty request."

        for pattern in self.blocked_patterns:
            if pattern in normalized:
                return False, "Request violates safety guardrails."

        if any(topic in normalized for topic in self.allowed_topics):
            return True, None

        # Allow short conversational follow-ups while still blocking unrelated abuse.
        if len(normalized.split()) <= 8:
            return True, None

        return False, "This assistant is limited to Ofstride services, consultant guidance, and business advisory topics."

    def validate(self, text: str) -> bool:
        ok, _ = self.check(text)
        return ok
