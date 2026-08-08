"""Profile-driven growth diagnosis engine.

Centralizes the logic previously duplicated (and inconsistent) across
diagnosis_generate and roadmap_generate. Produces maturity_stage, blockers,
opportunities, overall_score, category_scores, and issue_counts that are a
function of BOTH the captured business_profile (lead context) AND the audit
issue_finding rows — so the diagnosis is specific to the business, not generic.

Public API:
    build_diagnosis_payload(supa, audit_run_id) -> dict  (for INSERT)
    compute_enriched_diagnosis(diagnosis_row, issues) -> dict (for GET enrichment)
"""
from __future__ import annotations


# --- Domain / severity mapping (shared with diagnosis_get + guidance) --------

DOMAIN_RULE_MAP = {
    "technical": {"missing_h1", "missing_viewport_meta", "canonical_missing", "broken_internal_link", "image_missing_alt"},
    "content": {"title_too_short", "meta_description_weak", "thin_content"},
    "local": {"missing_local_schema", "missing_nap", "no_service_area_pages"},
    "conversion": {"weak_cta", "form_too_long", "no_primary_cta"},
}

_SEVERITY_PENALTY = {
    "critical": 18,
    "high": 12,
    "medium": 7,
    "low": 4,
}


def domain_for_issue(issue: dict) -> str:
    rule_id = str(issue.get("rule_id") or "").strip()
    for domain, rules in DOMAIN_RULE_MAP.items():
        if rule_id in rules:
            return domain
    category = str(issue.get("category") or "").strip().lower()
    if category in DOMAIN_RULE_MAP:
        return category
    if category == "onpage":
        return "content"
    return "technical"


def _penalty_for_severity(severity: str) -> int:
    return _SEVERITY_PENALTY.get((severity or "").lower(), 5)


# --- Issue-based scoring -----------------------------------------------------

def compute_issue_stats(issues: list[dict], audited_pages_count: int = 0) -> dict:
    """Returns evidence-aware scoring metadata.

    category_scores values are integers for measured domains and None when the
    domain had no measurable evidence in this run.
    """
    counters = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    penalties = {"technical": 0, "content": 0, "local": 0, "conversion": 0}
    evidence_counts = {"technical": 0, "content": 0, "local": 0, "conversion": 0}
    measured_domains_set: set[str] = set()

    # The deterministic crawler currently evaluates technical + content rules on
    # each crawled page. Even with zero findings, those domains are measured.
    if int(audited_pages_count or 0) > 0:
        measured_domains_set.update({"technical", "content"})

    for issue in issues:
        sev = str(issue.get("severity") or "").lower()
        if sev in counters:
            counters[sev] += 1
        domain = domain_for_issue(issue)
        penalties[domain] += _penalty_for_severity(sev)
        evidence_counts[domain] += 1
        measured_domains_set.add(domain)

    category_scores = {
        d: (max(0, 100 - penalties[d]) if d in measured_domains_set else None)
        for d in penalties.keys()
    }
    measured_domains = len(measured_domains_set)
    return {
        "issue_counts": counters,
        "category_scores": category_scores,
        "evidence_counts": evidence_counts,
        "measured_domains": measured_domains,
        "total_issues": len(issues),
    }


def compute_overall_score(issues: list[dict], audited_pages_count: int = 0) -> int:
    """Weighted overall growth-readiness score from measured domains only."""
    stats = compute_issue_stats(issues, audited_pages_count=audited_pages_count)
    domain_vals = [
        value for value in stats["category_scores"].values() if value is not None
    ]
    base = round(sum(domain_vals) / len(domain_vals)) if domain_vals else 50
    return max(0, min(100, base))


def maturity_for_score(score: int) -> str:
    if score < 50:
        return "foundational"
    if score < 80:
        return "moderate"
    return "growth_ready"


# --- Profile fetch (lead context) -------------------------------------------

def _fetch_profile(supa, audit_run_id: str) -> dict:
    """Walk audit_run -> assessment_session -> business_profile. Empty dict on miss."""
    try:
        run = supa.table("audit_run").select("assessment_session_id").eq("id", audit_run_id).execute().data
        if not run:
            return {}
        session_id = run[0].get("assessment_session_id")
        if not session_id:
            return {}
        sess = supa.table("assessment_session").select("business_profile_id").eq("id", session_id).execute().data
        if not sess:
            return {}
        bp_id = sess[0].get("business_profile_id")
        if not bp_id:
            return {}
        bp = supa.table("business_profile").select("*").eq("id", bp_id).execute().data
        return bp[0] if bp else {}
    except Exception:
        return {}


def _has_rule(issues: list[dict], rule_id: str) -> bool:
    return any(str(i.get("rule_id") or "") == rule_id for i in issues)


# --- Blockers (derived from issues + profile) -------------------------------

def derive_blockers(issues: list[dict], profile: dict) -> list[str]:
    blockers: list[str] = []

    # Issue-driven blockers
    if _has_rule(issues, "title_too_short"):
        blockers.append("Page titles are missing or too short to rank/click well")
    if _has_rule(issues, "missing_h1"):
        blockers.append("Pages lack a primary H1 heading")
    if _has_rule(issues, "meta_description_weak"):
        blockers.append("Meta descriptions are missing or weak")
    if _has_rule(issues, "missing_viewport_meta"):
        blockers.append("Site is not mobile-ready (no viewport meta)")
    if _has_rule(issues, "broken_internal_link"):
        blockers.append("Broken internal links hurt crawlability and UX")

    # Profile-driven blockers (lead context)
    channels = profile.get("current_channels") or []
    if isinstance(channels, list) and not channels:
        blockers.append("No active marketing channels are defined yet")
    if not profile.get("growth_goal"):
        blockers.append("No measurable growth goal captured to target")

    budget = str(profile.get("budget_band") or "").lower()
    urgency = str(profile.get("urgency_band") or "").lower()
    if urgency in {"high", "immediate"} and budget in {"low", "bootstrap", "none"}:
        blockers.append("High urgency but constrained budget limits fast execution")

    return blockers


# --- Opportunities (derived from profile + issues) -------------------------

def derive_opportunities(issues: list[dict], profile: dict) -> list[str]:
    opps: list[str] = []

    industry = (profile.get("industry") or "").strip()
    geo = (profile.get("target_geo") or "").strip()
    goal = (profile.get("growth_goal") or "").strip().lower()
    channels = profile.get("current_channels") or []

    # Profile-driven
    if "lead" in goal or "inbound" in goal:
        opps.append("Add inbound lead capture on key service pages")
    if geo:
        opps.append(f"Strengthen local SEO and trust signals for {geo}")
    if isinstance(channels, list) and "seo" not in [c.lower() for c in channels]:
        opps.append("Establish an SEO/content channel to compound organic traffic")
    if industry:
        opps.append(f"Build {industry}-specific content pillars to capture intent")

    # Issue-driven (fixable wins)
    if _has_rule(issues, "title_too_short") or _has_rule(issues, "meta_description_weak"):
        opps.append("Rewrite titles and meta descriptions to match search intent")
    if _has_rule(issues, "missing_h1"):
        opps.append("Enforce one clear H1 + logical heading hierarchy per page")
    if _has_rule(issues, "weak_cta") or _has_rule(issues, "no_primary_cta"):
        opps.append("Clarify the primary CTA and reduce conversion friction")

    # Return only evidence-backed opportunities; do not fabricate defaults.
    return opps


# --- Full payload (for INSERT in generate endpoints) ------------------------

def build_diagnosis_payload(supa, audit_run_id: str) -> dict:
    """Fetch issues + profile, compute everything. Returns an insert-ready dict
    PLUS enriched fields (category_scores, issue_counts, total_issues) the GET
    endpoint can also use."""
    issues = supa.table("issue_finding").select("*").eq("audit_run_id", audit_run_id).execute().data or []
    page_rows = (
        supa.table("audit_page")
        .select("id")
        .eq("audit_run_id", audit_run_id)
        .execute()
        .data
        or []
    )
    audited_pages_count = len(page_rows)
    profile = _fetch_profile(supa, audit_run_id)

    overall = compute_overall_score(issues, audited_pages_count=audited_pages_count)
    stats = compute_issue_stats(issues, audited_pages_count=audited_pages_count)

    return {
        "audit_run_id": audit_run_id,
        "maturity_stage": maturity_for_score(overall),
        "blockers": derive_blockers(issues, profile),
        "opportunities": derive_opportunities(issues, profile),
        "overall_score": overall,
        "category_scores": stats["category_scores"],
        "issue_counts": stats["issue_counts"],
        "total_issues": stats["total_issues"],
    }


def compute_enriched_diagnosis(diagnosis: dict, issues: list[dict], audited_pages_count: int = 0) -> dict:
    """Attach category_scores/issue_counts/total_issues to a fetched diagnosis row."""
    stats = compute_issue_stats(issues, audited_pages_count=audited_pages_count)
    diagnosis["category_scores"] = stats["category_scores"]
    diagnosis["issue_counts"] = stats["issue_counts"]
    diagnosis["evidence_counts"] = stats["evidence_counts"]
    diagnosis["measured_domains"] = stats["measured_domains"]
    diagnosis["total_issues"] = stats["total_issues"]
    return diagnosis
