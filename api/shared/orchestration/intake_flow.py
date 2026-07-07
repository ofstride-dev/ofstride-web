from __future__ import annotations

import re

REQUIRED_FIELDS = ["name", "phone", "email"]

YES_TOKENS = {"yes", "y", "interested", "show", "services", "service", "tell me services"}
NO_EXIT_TOKENS = {"no", "not interested", "quit", "exit", "stop", "bye", "goodbye", "good bye", "close", "done", "see you", "take care"}
DIRECT_INTENT_HINTS = {
    "consultant",
    "recommend",
    "need",
    "looking for",
    "service",
    "pricing",
    "cost",
    "quote",
    "proposal",
    "help with",
    "project",
    "hr",
    "finance",
    "legal",
    "it",
    "ai",
    "data",
    "strategy",
    "technology",
    "digital",
    "growth",
    "workforce",
    "people",
    "compliance",
}

DOMAIN_INTENT_MAP = {
    "People & Workforce": {
        "people",
        "workforce",
        "hr",
        "human resources",
        "payroll",
        "recruitment",
        "hiring",
        "eor",
    },
    "Finance & Compliance": {
        "finance",
        "compliance",
        "tax",
        "gst",
        "legal",
        "cfo",
        "regulatory",
    },
    "Technology & Growth": {
        "technology",
        "tech",
        "it",
        "digital",
        "ai",
        "data",
        "strategy",
        "growth",
    },
}

DOMAIN_SEARCH_QUERIES = {
    "People & Workforce": "HR payroll recruitment executive search workforce EOR consultant",
    "Finance & Compliance": "finance compliance legal GST tax virtual CFO consultant",
    "Technology & Growth": "technology IT digital transformation AI data science business strategy consultant",
}


def _contains_token(text: str, token: str) -> bool:
    normalized = text.lower().strip()
    if " " in token:
        return token in normalized
    return re.search(rf"\b{re.escape(token)}\b", normalized) is not None


def is_exit_intent(text: str) -> bool:
    return any(_contains_token(text, token) for token in NO_EXIT_TOKENS)


def is_affirmative_interest(text: str) -> bool:
    return any(_contains_token(text, token) for token in YES_TOKENS)


def has_direct_consulting_intent(text: str) -> bool:
    normalized = text.lower().strip()
    if not normalized:
        return False
    return any(_contains_token(normalized, token) for token in DIRECT_INTENT_HINTS)


def detect_domain_interest(text: str) -> str | None:
    normalized = text.lower().strip()
    if not normalized:
        return None

    for domain, tokens in DOMAIN_INTENT_MAP.items():
        if normalized == domain.lower():
            return domain
        if any(_contains_token(normalized, token) for token in tokens):
            return domain
    return None


def build_domain_search_query(domain: str) -> str:
    return DOMAIN_SEARCH_QUERIES.get(domain, domain)


def build_intro_prompt() -> str:
    return (
        "That sounds exciting. I can help you identify the right Ofstride consulting service and consultant fit.\n"
        "To personalize recommendations quickly, may I know your name?"
    )


def missing_required_fields(profile: dict[str, str]) -> list[str]:
    missing: list[str] = []
    for field in REQUIRED_FIELDS:
        if not profile.get(field):
            missing.append(field)
    return missing


def build_next_required_prompt(missing_fields: list[str]) -> str:
    if not missing_fields:
        return ""

    next_field = missing_fields[0]
    if next_field == "name":
        return "May I know your name so I can assist you better?"

    if next_field == "phone":
        return (
            "Thank you. Could you share your mobile number with country code? "
            "This helps us coordinate consultant availability quickly."
        )

    if next_field == "email":
        return (
            "Great. May I have your email address so we can send recommendations and next steps?"
        )

    return "Could you share one more detail so I can proceed accurately?"


def build_intake_completed_message() -> str:
    return "Thank you. I have your basic details."


def build_interest_prompt(name: str | None = None) -> str:
    display_name = (name or "there").strip() or "there"
    return (
        f"Welcome, {display_name}. I can map your requirement to Ofstride service domains and suggest consultant options. "
        "Would you like to review services by domain first?"
    )


def build_services_catalog_response() -> tuple[str, list[dict]]:
    message = (
        "Here is our services list in a structured format:\n\n"
        "1) People & Workforce\n"
        "- Human Resources Consulting\n"
        "- Executive Search & Recruitment\n"
        "- Payroll, HR & Compliance\n"
        "- Employer of Record (EOR) & Workforce Solutions\n\n"
        "2) Finance & Compliance\n"
        "- Financial Consulting / Virtual CFO\n"
        "- GST & Tax Advisory\n"
        "- Legal & Regulatory Compliance\n\n"
        "3) Technology & Growth\n"
        "- IT Consulting & Digital Transformation\n"
        "- AI & Data Science Consulting\n"
        "- Business Strategy & Process Improvement\n\n"
        "Citation: Ofstride website services catalog and internal service directory."
    )

    sources = [
        {
            "content": "Ofstride services grouped by domain: People & Workforce, Finance & Compliance, Technology & Growth.",
            "metadata": {
                "source": "ofstride_service_catalog",
                "source_type": "company_service_catalog",
            },
        }
    ]
    return message, sources


def build_exit_message() -> str:
    return (
        "No problem at all. I have saved your current discussion context. "
        "When you return, I can continue from here and help schedule the right consultant call."
    )


def append_cta_options(answer: str) -> str:
    base = answer.rstrip()
    lowered = base.lower()
    if (
        "schedule a call" in lowered
        or "send a message" in lowered
        or "would you like to continue with:" in lowered
    ):
        return base

    return (
        f"{base}\n\n"
        "Would you like to continue with:\n"
        "1) Send a message\n"
        "2) Schedule a call"
    )
