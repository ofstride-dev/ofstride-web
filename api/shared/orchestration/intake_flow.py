from __future__ import annotations

import re

REQUIRED_FIELDS = ["name", "phone", "email"]

YES_TOKENS = {"yes", "y", "interested", "show", "services", "service", "tell me services"}
NO_EXIT_TOKENS = {"no", "not interested", "quit", "exit", "stop", "bye", "close"}
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


def build_intro_prompt() -> str:
    return (
        "Hello! How can I help you?\n"
        "I am Ofstride Assistance. To get started, may I know your name?"
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
        f"Welcome, {display_name}. I can help you with Ofstride services. "
        "Would you like to see our services by domain?"
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
    return "Thank you. Let me know if you have any other question."


def append_cta_options(answer: str) -> str:
    base = answer.rstrip()
    if "schedule a call" in base.lower() or "send a message" in base.lower():
        return base

    return (
        f"{base}\n\n"
        "Would you like to continue with:\n"
        "1) Send a message\n"
        "2) Schedule a call"
    )
