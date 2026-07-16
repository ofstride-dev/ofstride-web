from __future__ import annotations

import json
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


async def ai_revalidate_analysis(*, job: dict[str, Any], application: dict[str, Any], base_result: dict[str, Any]) -> dict[str, Any]:
    """Use configured LLM to revalidate deterministic analysis.
    Falls back to base_result if AI provider is unavailable.
    """
    try:
        from core.llm_factory import get_llm_factory

        factory = get_llm_factory()
        selection = await factory.get_healthy_llm_with_metadata()
        client = selection.client

        system_prompt = (
            "You are a senior technical recruiter. Validate candidate-job fit and output strict JSON only. "
            "Keep scoring realistic and concise."
        )
        user_prompt = json.dumps(
            {
                "job": {
                    "title": job.get("title"),
                    "department": job.get("department"),
                    "employment_type": job.get("employment_type"),
                    "jd_markdown": job.get("jd_markdown"),
                },
                "candidate": {
                    "full_name": application.get("full_name"),
                    "years_experience": application.get("years_experience"),
                    "cover_note": application.get("cover_note"),
                    "linkedin_url": application.get("linkedin_url"),
                },
                "base_result": base_result,
                "required_output": {
                    "match_score": "number between 0 and 100",
                    "recommendation": "shortlist|review|hold",
                    "summary": "short paragraph <= 240 chars",
                    "strengths_summary": "short sentence",
                    "gaps_summary": "short sentence",
                },
            },
            ensure_ascii=True,
        )

        raw = await client.agenerate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.1,
            max_tokens=450,
        )
        data = json.loads(str(raw or "{}"))

        ai_score = float(data.get("match_score")) if data.get("match_score") is not None else float(base_result["match_score"])
        ai_score = max(0.0, min(100.0, round(ai_score, 1)))
        ai_reco = str(data.get("recommendation") or base_result["recommendation"]).strip().lower()
        if ai_reco not in {"shortlist", "review", "hold"}:
            ai_reco = str(base_result["recommendation"])

        return {
            **base_result,
            "match_score": ai_score,
            "recommendation": ai_reco,
            "strengths_summary": str(data.get("strengths_summary") or base_result["strengths_summary"]),
            "gaps_summary": str(data.get("gaps_summary") or base_result["gaps_summary"]),
            "ai_summary": str(data.get("summary") or "").strip(),
            "ai_used": True,
            "ai_provider": selection.provider.value,
        }
    except Exception:
        return {
            **base_result,
            "ai_summary": "",
            "ai_used": False,
            "ai_provider": None,
        }
