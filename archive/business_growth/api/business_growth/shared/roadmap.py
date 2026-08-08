"""Dynamic roadmap generator.

Derives prioritized roadmap items from the actual issue_finding set + the
captured business_profile, instead of the 3 static templates that were
hardcoded in roadmap_generate. Each item maps to a detected issue domain so
no spurious items are created for problems the audit didn't find.
"""
from __future__ import annotations

from business_growth.shared.diagnosis import domain_for_issue, _fetch_profile


# Domain -> default roadmap template (only emitted if that domain has issues
# OR the profile signals a need).
_DOMAIN_TEMPLATES = {
    "content": {
        "phase": "quick_win",
        "title": "Rewrite page titles and meta descriptions",
        "description": "Improve snippet quality and search-intent match on key pages.",
        "domain": "content",
        "impact": 5, "confidence": 4, "effort": 2, "strategic_weight": 1.2,
    },
    "technical": {
        "phase": "foundation_30d",
        "title": "Fix H1, heading hierarchy, and mobile-readiness",
        "description": "Make service pages clearer, mobile-ready, and crawlable.",
        "domain": "technical",
        "impact": 4, "confidence": 4, "effort": 2, "strategic_weight": 1.1,
    },
    "conversion": {
        "phase": "growth_60_90d",
        "title": "Improve conversion CTA and contact flow",
        "description": "Reduce friction and improve inquiry rate.",
        "domain": "conversion",
        "impact": 5, "confidence": 3, "effort": 3, "strategic_weight": 1.3,
    },
    "local": {
        "phase": "foundation_30d",
        "title": "Strengthen local SEO and trust signals",
        "description": "Add NAP, local schema, and service-area pages.",
        "domain": "local",
        "impact": 4, "confidence": 3, "effort": 2, "strategic_weight": 1.15,
    },
}

# Rule-id -> specific item override (more precise than the domain default)
_RULE_ITEMS = {
    "thin_content": {
        "phase": "foundation_30d", "title": "Expand thin content pages",
        "description": "Add depth and intent-matching body content to under-served pages.",
        "domain": "content", "impact": 4, "confidence": 4, "effort": 3, "strategic_weight": 1.2,
    },
    "image_missing_alt": {
        "phase": "quick_win", "title": "Add alt text to images",
        "description": "Improve accessibility and image SEO across pages.",
        "domain": "technical", "impact": 2, "confidence": 5, "effort": 1, "strategic_weight": 1.0,
    },
    "broken_internal_link": {
        "phase": "quick_win", "title": "Fix broken internal links",
        "description": "Repair or redirect broken links to restore crawlability and UX.",
        "domain": "technical", "impact": 3, "confidence": 5, "effort": 1, "strategic_weight": 1.1,
    },
    "canonical_missing": {
        "phase": "quick_win", "title": "Add canonical tags",
        "description": "Prevent duplicate-content issues with canonical link tags.",
        "domain": "technical", "impact": 2, "confidence": 5, "effort": 1, "strategic_weight": 1.0,
    },
}


def _priority(item: dict) -> float:
    return round(
        (item["impact"] * item["confidence"] * item["strategic_weight"]) / max(item["effort"], 1),
        2,
    )


def build_roadmap_items(supa, audit_run_id: str, diagnosis_id: str) -> list[dict]:
    """Derive roadmap items from detected issues + profile. Returns insert-ready rows."""
    issues = supa.table("issue_finding").select("rule_id,severity,category").eq(
        "audit_run_id", audit_run_id
    ).execute().data or []
    profile = _fetch_profile(supa, audit_run_id)

    seen_titles: set[str] = set()
    items: list[dict] = []

    def _emit(template: dict):
        title = template["title"]
        if title in seen_titles:
            return
        seen_titles.add(title)

        geo = (profile.get("target_geo") or "").strip()
        industry = (profile.get("industry") or "").strip()
        description = template["description"]
        if template["domain"] == "local" and geo:
            description = f"{description} Prioritize visibility in {geo}."
        elif template["domain"] == "content" and industry:
            description = f"{description} Focus examples and proof points for {industry}."

        item = {
            "growth_diagnosis_id": diagnosis_id,
            "phase": template["phase"],
            "title": title,
            "description": description,
            "domain": template["domain"],
            "impact": template["impact"],
            "confidence": template["confidence"],
            "effort": template["effort"],
            "strategic_weight": template["strategic_weight"],
            "priority_score": 0,
            "status": "draft",
        }
        item["priority_score"] = _priority(item)
        items.append(item)

    # 1. Rule-specific items (most precise)
    for issue in issues:
        rule_id = str(issue.get("rule_id") or "")
        if rule_id in _RULE_ITEMS:
            _emit(_RULE_ITEMS[rule_id])

    # 2. Domain-level items for any domain that has issues but no specific item yet
    issue_domains = {domain_for_issue(i) for i in issues}
    for domain in issue_domains:
        if domain in _DOMAIN_TEMPLATES:
            _emit(_DOMAIN_TEMPLATES[domain])

    # 3. Profile-signaled items even when issue rows are sparse.
    channels = profile.get("current_channels") or []
    channels_lower = [str(c).lower() for c in channels] if isinstance(channels, list) else []
    goal = str(profile.get("growth_goal") or "").lower()
    geo = str(profile.get("target_geo") or "").strip()

    if geo:
        _emit(_DOMAIN_TEMPLATES["local"])
    if channels_lower and "seo" not in channels_lower:
        _emit(_DOMAIN_TEMPLATES["content"])
    if "lead" in goal or "inbound" in goal:
        _emit(_DOMAIN_TEMPLATES["conversion"])

    return items
