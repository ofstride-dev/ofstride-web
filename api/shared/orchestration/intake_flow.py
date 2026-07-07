from __future__ import annotations

import re

# ============ STATE MACHINE CONSTANTS ============
STATE_OPEN = "OPEN"
STATE_INTAKE_FIELDS = "INTAKE_FIELDS"
STATE_INTAKE_SUBMITTED = "INTAKE_SUBMITTED"
STATE_DOMAIN_SELECTED = "DOMAIN_SELECTED"
STATE_CONSULTANTS_SHOWN = "CONSULTANTS_SHOWN"
STATE_CONVERSATION = "CONVERSATION"

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
        "talent",
        "staffing",
    },
    "Finance & Compliance": {
        "finance",
        "compliance",
        "tax",
        "gst",
        "legal",
        "cfo",
        "regulatory",
        "accounting",
        "audit",
    },
    "Technology & Growth": {
        "technology",
        "tech",
        "it",
        "digital",
        "ai",
        "data",
        "strategy",
        "business strategy",
        "growth",
        "transformation",
        "innovation",
        "data science",
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
        "Welcome to Ofstride. I can help match you with the right consultant.\n\n"
        "What kind of service are you looking for?\n"
        "• People & Workforce\n"
        "• Finance & Compliance\n"
        "• Technology & Growth"
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
        return "What's your name?"

    if next_field == "phone":
        return "Could you share your phone number?"

    if next_field == "email":
        return "What's your email address?"

    return "One more detail please?"


def build_intake_completed_message() -> str:
    return "Thank you. Now let me find the right consultant for you."


def build_interest_prompt(name: str | None = None) -> str:
    return (
        "Which service area interests you?\n"
        "• People & Workforce\n"
        "• Finance & Compliance\n"
        "• Technology & Growth"
    )


def build_services_catalog_response() -> tuple[str, list[dict]]:
    message = (
        "Our Services:\n\n"
        "People & Workforce:\n"
        "HR, Recruitment, Payroll, Compliance, EOR\n\n"
        "Finance & Compliance:\n"
        "Financial Advisory, Tax, Legal, Regulatory\n\n"
        "Technology & Growth:\n"
        "IT, Digital Transformation, AI, Data Science, Strategy"
    )

    sources = [
        {
            "content": "Ofstride service areas",
            "metadata": {
                "source": "ofstride_service_catalog",
                "source_type": "company_service_catalog",
            },
        }
    ]
    return message, sources


def build_exit_message() -> str:
    return (
        "No problem. I've saved your information. Come back anytime to continue, "
        "and I'll pick up where we left off."
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


# ============ STATE MACHINE ORCHESTRATION ============
def get_next_state(
    current_state: str,
    profile: dict[str, str],
    query: str,
) -> tuple[str, str, list[dict]]:
    """
    Determine next state and response based on current state, profile, and user query.
    
    Returns: (next_state, response_text, actions)
    """
    
    # Check for exit intent at any state
    if is_exit_intent(query):
        return STATE_OPEN, build_exit_message(), [
            {"id": "act_1", "label": "Send a message", "value": "Send a message", "kind": "quick_reply"},
            {"id": "act_2", "label": "Schedule a call", "value": "Schedule a call", "kind": "quick_reply"},
        ]
    
    # STATE: OPEN (chat just started)
    if current_state == STATE_OPEN:
        # Check if user mentions domain or has consulting intent in first message
        domain = detect_domain_interest(query)
        
        if domain and has_direct_consulting_intent(query):
            # User has clear intent + domain (e.g., "I need AI consulting")
            # Store domain in profile and skip to field collection
            return (
                STATE_INTAKE_FIELDS,
                "Great! I'll help you find the right consultant. What's your name?",
                [],
            )
        elif domain or has_direct_consulting_intent(query):
            # User has intent but unclear domain, show service categories
            return (
                STATE_INTAKE_FIELDS,
                build_intro_prompt(),
                [],
            )
        else:
            # Generic greeting
            return (
                STATE_INTAKE_FIELDS,
                build_intro_prompt(),
                [],
            )
    
    # STATE: INTAKE_FIELDS (collecting name, phone, email)
    if current_state == STATE_INTAKE_FIELDS:
        missing = missing_required_fields(profile)
        
        if missing:
            # Still have missing fields, stay in INTAKE_FIELDS
            next_prompt = build_next_required_prompt(missing)
            return (
                STATE_INTAKE_FIELDS,
                next_prompt,
                [],
            )
        else:
            # All fields collected, move to next state
            intake_complete = build_intake_completed_message()
            interest_prompt = build_interest_prompt(profile.get("name"))
            combined_response = f"{intake_complete}\n\n{interest_prompt}"
            return (
                STATE_INTAKE_SUBMITTED,
                combined_response,
                [
                    {"id": "act_1", "label": "Yes, show services", "value": "Yes, show services", "kind": "quick_reply"},
                    {"id": "act_2", "label": "Schedule a call", "value": "Schedule a call", "kind": "quick_reply"},
                ],
            )
    
    # STATE: INTAKE_SUBMITTED (waiting for domain selection or service catalog view)
    if current_state == STATE_INTAKE_SUBMITTED:
        # Check if domain is already known from earlier conversation
        stored_domain = profile.get("service_type")
        domain = detect_domain_interest(query) or stored_domain
        
        if domain:
            # User selected a domain (or it's already known)
            return (
                STATE_DOMAIN_SELECTED,
                f"Perfect! I'm finding the best {domain} consultant for you.",
                [],
            )
        elif is_affirmative_interest(query):
            # User wants to see services catalog
            services_msg, _ = build_services_catalog_response()
            return (
                STATE_DOMAIN_SELECTED,
                services_msg,
                [
                    {"id": "act_1", "label": "People & Workforce", "value": "People & Workforce", "kind": "quick_reply"},
                    {"id": "act_2", "label": "Finance & Compliance", "value": "Finance & Compliance", "kind": "quick_reply"},
                    {"id": "act_3", "label": "Technology & Growth", "value": "Technology & Growth", "kind": "quick_reply"},
                ],
            )
        else:
            # Re-ask for service area
            prompt = build_interest_prompt(profile.get("name"))
            return (
                STATE_INTAKE_SUBMITTED,
                prompt,
                [
                    {"id": "act_1", "label": "Yes, show services", "value": "Yes, show services", "kind": "quick_reply"},
                    {"id": "act_2", "label": "Schedule a call", "value": "Schedule a call", "kind": "quick_reply"},
                ],
            )
    
    # STATE: DOMAIN_SELECTED (user selected domain, ready to show consultants)
    if current_state == STATE_DOMAIN_SELECTED:
        # In graph.py, this state triggers consultant retrieval
        # Move to CONSULTANTS_SHOWN (handled by graph.py after retrieval)
        return (
            STATE_CONSULTANTS_SHOWN,
            "",  # Response will be built by graph.py with consultant data
            [],
        )
    
    # STATE: CONSULTANTS_SHOWN (showing consultants, open for Q&A)
    if current_state == STATE_CONSULTANTS_SHOWN:
        # User can ask follow-up questions, view more consultants, etc.
        # Stay in conversation mode
        return (
            STATE_CONVERSATION,
            "",  # Response will be LLM-generated
            [],
        )
    
    # STATE: CONVERSATION (ongoing Q&A)
    if current_state == STATE_CONVERSATION:
        # Continue in conversation
        return (
            STATE_CONVERSATION,
            "",  # Response will be LLM-generated
            [],
        )
    
    # Default fallback
    return (
        STATE_OPEN,
        "I'm not sure what happened. Let's start fresh. How can I help you today?",
        [],
    )
