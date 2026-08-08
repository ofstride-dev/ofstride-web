"""Page-level audit rule engine.

Pure functions that inspect a parsed page's fields and return issue_finding
dicts. Used by the crawler (Phase 2 multi-page) so every page is scored with the
same rules. Rule ids here must match the DOMAIN_RULE_MAP in diagnosis.py.

Each issue dict shape: {audit_run_id, audit_page_id, category, rule_id,
severity, description, evidence}
"""
from __future__ import annotations


def detect_page_issues(audit_run_id, page_id, parsed: dict) -> list[dict]:
    """Return issue_finding rows for a single parsed page.

    `parsed` keys: title, meta_description, h1, canonical, has_viewport_meta,
    link_count, image_count, text_length, images_without_alt
    """
    issues: list[dict] = []
    title = parsed.get("title") or ""
    meta_desc = parsed.get("meta_description") or ""
    h1 = parsed.get("h1") or ""
    canonical = parsed.get("canonical") or ""
    has_viewport = bool(parsed.get("has_viewport_meta"))
    text_length = int(parsed.get("text_length") or 0)
    images_no_alt = int(parsed.get("images_without_alt") or 0)

    def _issue(rule_id, category, severity, description, evidence):
        return {
            "audit_run_id": audit_run_id,
            "audit_page_id": page_id,
            "category": category,
            "rule_id": rule_id,
            "severity": severity,
            "description": description,
            "evidence": evidence,
        }

    if not title or len(title) < 10:
        issues.append(_issue("title_too_short", "onpage", "high",
            "Page title is missing or too short.", {"title": title}))
    if not meta_desc or len(meta_desc) < 50:
        issues.append(_issue("meta_description_weak", "onpage", "medium",
            "Meta description is missing or too short.", {"meta_description": meta_desc}))
    if not h1:
        issues.append(_issue("missing_h1", "onpage", "medium",
            "Page has no H1 heading.", {}))
    if not has_viewport:
        issues.append(_issue("missing_viewport_meta", "technical", "high",
            "Page is missing a viewport meta tag (not mobile-ready).", {}))
    if not canonical:
        issues.append(_issue("canonical_missing", "technical", "low",
            "Page has no canonical link tag.", {}))
    if text_length and text_length < 300:
        issues.append(_issue("thin_content", "content", "medium",
            "Page has thin content (under 300 words of body text).", {"text_length": text_length}))
    if images_no_alt > 0:
        issues.append(_issue("image_missing_alt", "technical", "low",
            f"{images_no_alt} image(s) are missing alt text.", {"images_without_alt": images_no_alt}))

    return issues


def detect_broken_links(audit_run_id, page_id, broken_urls: list[str]) -> list[dict]:
    """Return issue rows for broken internal links discovered during crawl."""
    if not broken_urls:
        return []
    return [{
        "audit_run_id": audit_run_id,
        "audit_page_id": page_id,
        "category": "technical",
        "rule_id": "broken_internal_link",
        "severity": "medium",
        "description": f"{len(broken_urls)} broken internal link(s) found on this page.",
        "evidence": {"broken_urls": broken_urls[:20]},
    }]
