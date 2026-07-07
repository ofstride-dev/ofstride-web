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
            "technology",
            "digital",
            "growth",
            "people",
            "workforce",
            "compliance",
            "tax",
            "gst",
            "payroll",
            "recruitment",
            "hiring",
            "eor",
            "company",
            "ofstride",
            "service",
            "about",
            "contact",
            "support",
            "call",
            "email",
        }
        self.follow_up_tokens = {
            "yes",
            "no",
            "okay",
            "ok",
            "sure",
            "go ahead",
            "show",
            "continue",
            "next",
            "call",
            "book",
            "schedule",
            "thanks",
            "thank you",
            # greetings and introductions (intake flow)
            "hello",
            "hi",
            "hey",
            "good morning",
            "good afternoon",
            "good evening",
            "my name",
            "name is",
            "i am",
            "i'm",
            # exit intents
            "bye",
            "goodbye",
            "see you",
            "take care",
            "done",
            "exit",
            "quit",
        }
        self.disallowed_general_topics = {
            "weather",
            "temperature",
            "forecast",
            "news",
            "sports",
            "cricket",
            "football",
            "movie",
            "movies",
            "song",
            "songs",
            "recipe",
            "recipes",
            "joke",
            "jokes",
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

        if any(topic in normalized for topic in self.disallowed_general_topics):
            return False, "This assistant is limited to Ofstride services, consultant guidance, and business advisory topics."

        if any(topic in normalized for topic in self.allowed_topics):
            return True, None

        # Allow short conversational follow-ups and intake phrases (name, greeting, exit).
        if any(token in normalized for token in self.follow_up_tokens):
            return True, None

        return False, "This assistant is limited to Ofstride services, consultant guidance, and business advisory topics."

    def validate(self, text: str) -> bool:
        ok, _ = self.check(text)
        return ok
