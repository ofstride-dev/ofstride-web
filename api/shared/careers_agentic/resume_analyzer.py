from __future__ import annotations

import re
from typing import Any

SKILL_LEXICON = [
    "python", "sql", "excel", "power bi", "tableau",
    "finance", "accounting", "hr", "recruitment", "compliance",
    "payroll", "gst", "tax", "legal", "operations", "strategy",
    "project management", "data analysis", "communication", "leadership",
]


def _normalize(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").lower()).strip()


def _extract_skills(text: str) -> list[str]:
    found: list[str] = []
    for skill in SKILL_LEXICON:
        pattern = rf"(^|[^a-z0-9]){re.escape(skill)}([^a-z0-9]|$)"
        if re.search(pattern, text):
            found.append(skill)
    return found


def _score_to_status(score: float) -> str:
    if score >= 85:
        return "shortlisted"
    if score <= 45:
        return "rejected"
    return "under_review"


def _safe_years_experience(value: Any) -> float:
    raw = str(value or "").strip()
    if not raw:
        return 0.0
    try:
        return float(raw)
    except (TypeError, ValueError):
        match = re.search(r"\d+(\.\d+)?", raw)
        if not match:
            return 0.0
        try:
            return float(match.group(0))
        except (TypeError, ValueError):
            return 0.0


def analyze_application(*, job: dict[str, Any], application: dict[str, Any]) -> dict[str, Any]:
    jd_text = " ".join(
        [
            _normalize(job.get("title")),
            _normalize(job.get("department")),
            _normalize(job.get("employment_type")),
            _normalize(job.get("jd_markdown")),
            _normalize(job.get("jd_raw_text")),
        ]
    )
    candidate_text = " ".join(
        [
            _normalize(application.get("cover_note")),
            _normalize(application.get("linkedin_url")),
            _normalize(application.get("full_name")),
        ]
    )

    required = _extract_skills(jd_text) or ["communication", "operations", "strategy"]
    candidate = _extract_skills(candidate_text)
    matched = sorted({skill for skill in required if skill in candidate})
    missing = sorted({skill for skill in required if skill not in candidate})

    years = _safe_years_experience(application.get("years_experience"))
    score = round(min(97.0, 40.0 + min(years, 15.0) * 2.0 + ((len(matched) / len(required)) * 40.0)), 1)

    if score >= 75:
        recommendation = "shortlist"
    elif score >= 60:
        recommendation = "review"
    else:
        recommendation = "hold"

    strengths = f"Matched {len(matched)} of {len(required)} key skills" + (f": {', '.join(matched)}." if matched else ".")
    gaps = f"Missing {len(missing)} skills" + (f": {', '.join(missing)}." if missing else ".")

    return {
        "match_score": score,
        "recommendation": recommendation,
        "matched_skills": matched,
        "missing_skills": missing,
        "strengths_summary": strengths,
        "gaps_summary": gaps,
        "suggested_status": _score_to_status(score),
        "admin_summary": {
            "fit_band": "high" if score >= 75 else ("medium" if score >= 60 else "low"),
            "years_experience": years,
            "top_matched": matched[:5],
            "top_gaps": missing[:5],
        },
    }
