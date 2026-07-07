from __future__ import annotations

import re

EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_RE = re.compile(r"(?:\+?\d[\d\s\-]{7,}\d)")

INTEREST_KEYWORDS = {
    "hr": "HR",
    "finance": "Finance",
    "legal": "Legal",
    "it": "IT",
    "ai": "AI & Data",
    "data": "AI & Data",
    "strategy": "Strategy",
    "payroll": "Payroll",
    "hiring": "Executive Hiring",
    "executive": "Executive Hiring",
    "eor": "EOR",
}

CONTACT_MODE_PATTERNS = {
    "call": "Call",
    "phone": "Call",
    "email": "Email",
    "mail": "Email",
    "whatsapp": "WhatsApp",
}

SERVICE_KEYWORDS = {
    "hr": "HR Consulting",
    "hiring": "Executive Search",
    "recruit": "Executive Search",
    "payroll": "Payroll & Compliance",
    "cfo": "Virtual CFO",
    "tax": "GST & Tax Advisory",
    "gst": "GST & Tax Advisory",
    "legal": "Legal & Regulatory",
    "it": "IT & Digital Transformation",
    "ai": "AI & Data Science",
    "data": "AI & Data Science",
    "technology": "IT & Digital Transformation",
    "digital": "IT & Digital Transformation",
    "strategy": "Business Strategy",
    "growth": "Business Strategy",
    "people": "HR Consulting",
    "workforce": "EOR & Workforce",
    "compliance": "Legal & Regulatory",
    "eor": "EOR & Workforce",
}

TIMELINE_HINTS = [
    "immediate",
    "2 weeks",
    "1 month",
    "3 months",
    "asap",
]

NON_NAME_SINGLE_WORDS = {
    "yes",
    "no",
    "hi",
    "hello",
    "hey",
    "ok",
    "okay",
    "thanks",
    "thankyou",
    "interested",
    "service",
    "services",
    "consultant",
    "help",
}


def _contains_token(text: str, token: str) -> bool:
    normalized = text.lower().strip()
    if " " in token:
        return token in normalized
    return re.search(rf"\b{re.escape(token)}\b", normalized) is not None


def _normalize_phone(candidate: str) -> str | None:
    raw = " ".join(candidate.split())
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) < 10:
        return None

    if raw.startswith("+"):
        return "+" + digits
    return digits


def extract_profile_updates(text: str) -> dict[str, str]:
    lowered = text.lower()
    updates: dict[str, str] = {}

    email_match = EMAIL_RE.search(text)
    if email_match:
        updates["email"] = email_match.group(0)

    phone_match = PHONE_RE.search(text)
    if phone_match:
        normalized_phone = _normalize_phone(phone_match.group(0))
        if normalized_phone:
            updates["phone"] = normalized_phone

    name_patterns = [
        r"(?:my name is|i am|this is)\s+([A-Za-z][A-Za-z\s.'-]{1,60})",
        r"(?:it's|its|im)\s+([A-Za-z][A-Za-z\s.'-]{1,60})",
    ]
    for pattern in name_patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            candidate = " ".join(match.group(1).split())
            if len(candidate) >= 2:
                updates["name"] = candidate
                break

    if "name" not in updates:
        plain = text.strip()
        plain_words = plain.split()
        lower_plain = plain.lower().strip()
        if (
            plain
            and "@" not in plain
            and not re.search(r"\d", plain)
            and 1 <= len(plain_words) <= 4
            and re.fullmatch(r"[A-Za-z\s.'-]+", plain)
            and lower_plain not in NON_NAME_SINGLE_WORDS
        ):
            updates["name"] = " ".join(plain_words)

    for token, value in INTEREST_KEYWORDS.items():
        if _contains_token(lowered, token):
            updates["area_of_interest"] = value
            break

    for token, value in CONTACT_MODE_PATTERNS.items():
        if _contains_token(lowered, token):
            updates["contact_mode"] = value
            break

    for token, value in SERVICE_KEYWORDS.items():
        if _contains_token(lowered, token):
            updates["service_needed"] = value
            break

    for hint in TIMELINE_HINTS:
        if hint in lowered:
            updates["timeline"] = hint
            break

    return updates


def build_profile_summary(profile: dict[str, str]) -> str:
    if not profile:
        return "(none captured yet)"

    ordered_keys = [
        "name",
        "email",
        "phone",
        "service_needed",
        "area_of_interest",
        "timeline",
        "contact_mode",
    ]
    lines: list[str] = []
    for key in ordered_keys:
        value = profile.get(key)
        if value:
            lines.append(f"{key}: {value}")
    return "\n".join(lines) if lines else "(none captured yet)"
