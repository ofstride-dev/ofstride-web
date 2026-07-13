import os
import sys
import json
import re

import azure.functions as func

script_dir = os.path.dirname(os.path.abspath(__file__))
shared_path = os.path.join(script_dir, "..", "shared")
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

from core.api_contract import error_response, get_trace_id, ok_response, options_response
from persistence.careers_store import get_careers_store
from security.admin_auth import AdminAuthError, require_admin


SKILL_LEXICON = [
    "python",
    "sql",
    "excel",
    "power bi",
    "tableau",
    "finance",
    "accounting",
    "hr",
    "recruitment",
    "compliance",
    "payroll",
    "gst",
    "tax",
    "legal",
    "operations",
    "strategy",
    "project management",
    "data analysis",
    "communication",
    "leadership",
]


def _normalize_text(value: object) -> str:
    text = str(value or "").lower()
    return re.sub(r"\s+", " ", text).strip()


def _extract_present_skills(text: str) -> list[str]:
    present: list[str] = []
    for skill in SKILL_LEXICON:
        pattern = rf"(^|[^a-z0-9]){re.escape(skill)}([^a-z0-9]|$)"
        if re.search(pattern, text):
            present.append(skill)
    return present


async def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = get_trace_id(req)
    if req.method == "OPTIONS":
        return options_response(trace_id=trace_id, req=req)

    try:
        admin = require_admin(req)
    except AdminAuthError as exc:
        return error_response(
            error_type="validation",
            message=str(exc),
            trace_id=trace_id,
            req=req,
            status_code=401,
        )

    application_id = (req.route_params.get("application_id") if req.route_params else "") or ""
    application_id = application_id.strip()
    if not application_id:
        return error_response(
            error_type="validation",
            message="application_id is required.",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )

    store = get_careers_store()
    if not store.is_available:
        return error_response(
            error_type="infra",
            message="Careers store unavailable.",
            trace_id=trace_id,
            req=req,
            status_code=503,
        )

    detail = store.get_application_detail(application_id=application_id)
    if not detail:
        return error_response(
            error_type="validation",
            message="Application not found.",
            trace_id=trace_id,
            req=req,
            status_code=404,
        )

    # Phase 1 deterministic admin analysis (no LLM dependency):
    # compare JD-required skills vs candidate-provided signals.
    job = store.get_job_by_id(job_id=str(detail.get("job_id") or "")) or {}
    jd_text = _normalize_text(job.get("title"))
    jd_text = f"{jd_text} {_normalize_text(detail.get('job_title'))} {_normalize_text(job.get('department'))} {_normalize_text(job.get('employment_type'))}"
    jd_text = f"{jd_text} {_normalize_text(job.get('jd_markdown'))} {_normalize_text(job.get('jd_raw_text'))}"

    candidate_text = _normalize_text(detail.get("cover_note"))
    candidate_text = f"{candidate_text} {_normalize_text(detail.get('linkedin_url'))}"

    required_skills = _extract_present_skills(jd_text)
    candidate_skills = _extract_present_skills(candidate_text)
    if not required_skills:
        required_skills = ["communication", "operations", "strategy"]

    matched_skills = sorted({skill for skill in required_skills if skill in candidate_skills})
    missing_skills = sorted({skill for skill in required_skills if skill not in candidate_skills})

    years = float(detail.get("years_experience") or 0)
    base = 40.0
    experience_boost = min(years, 15.0) * 2.0
    match_ratio = (len(matched_skills) / len(required_skills)) if required_skills else 0.0
    skill_boost = match_ratio * 40.0
    score = round(min(97.0, base + experience_boost + skill_boost), 1)

    if score >= 75:
        recommendation = "shortlist"
    elif score >= 60:
        recommendation = "review"
    else:
        recommendation = "hold"

    strengths_summary = (
        f"Matched {len(matched_skills)} of {len(required_skills)} key skills"
        + (f": {', '.join(matched_skills)}." if matched_skills else ".")
    )
    gaps_summary = (
        f"Missing {len(missing_skills)} skills"
        + (f": {', '.join(missing_skills)}." if missing_skills else ".")
    )

    updated = store.update_analysis_status(
        application_id=application_id,
        analysis_status="completed",
        analyzed_by=admin["user_name"],
        recommendation=recommendation,
        match_score=score,
        matched_skills_json=json.dumps(matched_skills, ensure_ascii=True),
        missing_skills_json=json.dumps(missing_skills, ensure_ascii=True),
        strengths_summary=strengths_summary,
        gaps_summary=gaps_summary,
    )
    if not updated:
        return error_response(
            error_type="infra",
            message="Failed to update analysis status.",
            trace_id=trace_id,
            req=req,
            status_code=500,
        )

    store.log_admin_action(
        admin_user_id=admin["user_id"],
        action_type="run_analysis",
        entity_type="application",
        entity_id=application_id,
        action_detail=f"score={score:.1f};recommendation={recommendation}",
    )

    return ok_response(
        trace_id=trace_id,
        req=req,
        data={
            "application_id": application_id,
            "analysis_status": "completed",
            "match_score": score,
            "recommendation": recommendation,
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
            "strengths_summary": strengths_summary,
            "gaps_summary": gaps_summary,
        },
    )
