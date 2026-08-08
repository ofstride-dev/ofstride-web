"""Server-side journey resume helpers.

Builds a resumable view of a Business Growth assessment from
assessment_session_id so journeys can continue across devices.
"""
from __future__ import annotations


_NO_WEBSITE_MARKERS = {"", "na", "n/a", "none", "no-website", "no website"}


def _is_no_website(domain: str | None) -> bool:
    value = (domain or "").strip().lower()
    return value in _NO_WEBSITE_MARKERS


def _profile_only_findings(profile: dict, session_metadata: dict | None) -> dict:
    """Generate actionable findings when a lead has no website yet."""
    channels = profile.get("current_channels") or []
    if not isinstance(channels, list):
        channels = []

    growth_goal = str(profile.get("growth_goal") or "").strip()
    industry = str(profile.get("industry") or "").strip()
    geo = str(profile.get("target_geo") or "").strip()
    budget = str(profile.get("budget_band") or "").strip().lower()
    urgency = str(profile.get("urgency_band") or "").strip().lower()
    metadata = session_metadata or {}
    chat_signals = metadata.get("chat_signals") if isinstance(metadata, dict) else None

    findings = [
        "No website detected: prioritize a conversion-ready one-page site before deeper SEO audits.",
    ]
    solutions = [
        "Create a focused landing page with one primary offer, trust proof, and a single CTA.",
        "Set up lead capture basics: form + WhatsApp click + calendar booking + CRM destination.",
    ]

    if not channels:
        findings.append("No current acquisition channels are configured.")
        solutions.append("Start with 1-2 channels only (local SEO + referrals or high-intent search ads).")

    if growth_goal:
        solutions.append(f"Translate growth goal '{growth_goal}' into weekly lead KPIs and owner actions.")

    if industry:
        solutions.append(f"Define offer and proof assets tailored to {industry} buyer objections.")

    if geo:
        solutions.append(f"Launch geo-targeted messaging and listings for {geo} to capture local demand.")

    if urgency in {"high", "immediate"} and budget in {"bootstrap", "low", "none"}:
        findings.append("Urgency is high while budget is constrained.")
        solutions.append("Sequence execution: no-code landing page first, then low-cost channel experiments.")

    if chat_signals:
        findings.append("Chat lead signals are available and can improve prioritization.")
        solutions.append("Map chat themes (pain points, intent, objections) into headline/offer/FAQ copy.")

    return {
        "mode": "profile_only",
        "findings": findings,
        "solutions": solutions,
        "uses_chat_signals": bool(chat_signals),
    }


def get_journey_by_assessment_session(supa, assessment_session_id: str) -> dict | None:
    """Return server-side resume state for a given assessment session."""
    sess_rows = (
        supa.table("assessment_session")
        .select("*")
        .eq("id", assessment_session_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not sess_rows:
        return None

    session = sess_rows[0]
    business_profile_id = session.get("business_profile_id")

    profile_rows = (
        supa.table("business_profile")
        .select("*")
        .eq("id", business_profile_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    profile = profile_rows[0] if profile_rows else {}

    audit_rows = (
        supa.table("audit_run")
        .select("*")
        .eq("assessment_session_id", assessment_session_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    audit_run = audit_rows[0] if audit_rows else None

    diagnosis = None
    roadmap_items = []
    review_rows = []
    if audit_run:
        diagnosis_rows = (
            supa.table("growth_diagnosis")
            .select("*")
            .eq("audit_run_id", audit_run.get("id"))
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        diagnosis = diagnosis_rows[0] if diagnosis_rows else None

        if diagnosis:
            roadmap_items = (
                supa.table("roadmap_item")
                .select("id,status,phase,domain,priority_score")
                .eq("growth_diagnosis_id", diagnosis.get("id"))
                .execute()
                .data
                or []
            )
            review_rows = (
                supa.table("consultant_review")
                .select("id,approved,reviewer_id,created_at")
                .eq("growth_diagnosis_id", diagnosis.get("id"))
                .order("created_at", desc=True)
                .execute()
                .data
                or []
            )

    done_count = len([item for item in roadmap_items if item.get("status") == "done"])
    latest_review = review_rows[0] if review_rows else None

    resume_state = {
        "businessProfileId": profile.get("id"),
        "assessmentSessionId": session.get("id"),
        "auditRunId": (audit_run or {}).get("id") if audit_run else None,
        "diagnosisId": (diagnosis or {}).get("id") if diagnosis else None,
        "roadmapCompleted": bool(roadmap_items) and done_count == len(roadmap_items),
        "reviewApproved": bool(latest_review and latest_review.get("approved")),
    }

    profile_only = None
    if not audit_run and _is_no_website(profile.get("domain")):
        profile_only = _profile_only_findings(profile, session.get("metadata") or {})

    return {
        "assessment_session": session,
        "business_profile": profile,
        "audit_run": audit_run,
        "growth_diagnosis": diagnosis,
        "roadmap": {
            "items_total": len(roadmap_items),
            "items_done": done_count,
            "items": roadmap_items,
        },
        "review": {
            "latest": latest_review,
            "total_reviews": len(review_rows),
        },
        "resume_state": resume_state,
        "profile_only_guidance": profile_only,
    }
