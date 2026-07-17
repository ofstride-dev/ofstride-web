from __future__ import annotations

import asyncio
import json
import os
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


def _extract_compound_skills(text: str) -> list[str]:
    normalized = _normalize(text)
    patterns = (
        r"(?:experience with|proficient in|proficiency in|expertise in|knowledge of|hands[- ]on with)\s+([a-z0-9+#./\- ,&]{2,120})",
        r"(?:must have|requirements?|skills?)\s*[:\-]\s*([a-z0-9+#./\- ,&]{2,200})",
    )
    captured: list[str] = []
    for pattern in patterns:
        for match in re.finditer(pattern, normalized):
            segment = match.group(1)
            for part in re.split(r",|/|\band\b|\bor\b", segment):
                token = re.sub(r"\s+", " ", part).strip(" .;:-")
                if 2 <= len(token) <= 50 and re.search(r"[a-z]", token):
                    captured.append(token)
    return captured


def _extract_required_skills(jd_text: str) -> list[str]:
    candidates = _extract_skills(jd_text) + _extract_compound_skills(jd_text)
    seen: set[str] = set()
    ordered: list[str] = []
    for item in candidates:
        value = _normalize(item)
        if not value or value in seen:
            continue
        if len(value) < 2:
            continue
        seen.add(value)
        ordered.append(value)
    return ordered[:18]


def _extract_candidate_skills(candidate_text: str) -> list[str]:
    candidates = _extract_skills(candidate_text) + _extract_compound_skills(candidate_text)
    seen: set[str] = set()
    ordered: list[str] = []
    for item in candidates:
        value = _normalize(item)
        if not value or value in seen:
            continue
        seen.add(value)
        ordered.append(value)
    return ordered[:24]


def _extract_json_object(raw: str) -> dict[str, Any]:
    text = str(raw or "").strip()
    if not text:
        return {}

    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        pass

    fenced = re.search(r"```(?:json)?\s*(\{[\s\S]*\})\s*```", text, re.IGNORECASE)
    if fenced:
        candidate = fenced.group(1).strip()
        try:
            parsed = json.loads(candidate)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            pass

    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        candidate = text[start : end + 1]
        try:
            parsed = json.loads(candidate)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


async def _load_resume_text_excerpt(application: dict[str, Any]) -> str:
    inline_text = str(application.get("resume_text") or application.get("resume_plain_text") or "").strip()
    if inline_text:
        return inline_text[:9000]

    blob_path = str(application.get("resume_blob_path") or "").strip()
    if not blob_path:
        return ""

    content_type = _normalize(application.get("resume_content_type"))
    original_name = str(application.get("resume_original_name") or "").lower()
    is_text_resume = content_type in {"text/plain", "text/markdown", "text/csv"} or original_name.endswith((".txt", ".md", ".csv"))
    if not is_text_resume:
        return ""

    connection_string = (
        (os.getenv("CAREERS_BLOB_CONNECTION_STRING") or "").strip()
        or (os.getenv("AzureWebJobsStorage") or "").strip()
    )
    container = (
        (os.getenv("CAREERS_RESUME_BLOB_CONTAINER") or "").strip()
        or (os.getenv("CAREERS_BLOB_CONTAINER") or "").strip()
        or "careers-resume-container"
    )
    if not connection_string or not container:
        return ""

    try:
        from azure.storage.blob import BlobServiceClient  # deferred import
    except Exception:
        return ""

    def _download() -> bytes:
        service = BlobServiceClient.from_connection_string(connection_string)
        blob_client = service.get_blob_client(container=container, blob=blob_path)
        return blob_client.download_blob(max_concurrency=1).readall()

    try:
        payload = await asyncio.to_thread(_download)
        text = payload.decode("utf-8", errors="replace")
        return re.sub(r"\s+", " ", text).strip()[:9000]
    except Exception:
        return ""


async def _call_llm_for_json(*, client: Any, system_prompt: str, user_prompt: str, temperature: float, max_tokens: int) -> dict[str, Any]:
    raw = ""
    if hasattr(client, "agenerate_json"):
        try:
            raw = await client.agenerate_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            parsed = _extract_json_object(raw)
            if parsed:
                return parsed
        except Exception:
            pass

    raw = await client.agenerate(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return _extract_json_object(raw)


def _normalize_recommendation(recommendation: str, score: float) -> str:
    reco = str(recommendation or "").strip().lower()
    if reco in {"shortlist", "review", "hold"}:
        return reco
    if score >= 72:
        return "shortlist"
    if score >= 54:
        return "review"
    return "hold"


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
            _normalize(application.get("resume_original_name")),
            _normalize(application.get("email")),
        ]
    )

    required = _extract_required_skills(jd_text) or ["communication", "operations", "strategy"]
    candidate = _extract_candidate_skills(candidate_text)
    matched = sorted({skill for skill in required if skill in candidate})
    missing = sorted({skill for skill in required if skill not in candidate})

    years = _safe_years_experience(application.get("years_experience"))
    skill_ratio = (len(matched) / len(required)) if required else 0.0
    experience_score = min(years, 20.0) * 1.4
    score = round(min(97.0, 24.0 + (skill_ratio * 55.0) + experience_score), 1)

    recommendation = _normalize_recommendation("", score)

    strengths = f"Matched {len(matched)} of {len(required)} key skills" + (f": {', '.join(matched)}." if matched else ".")
    gaps = f"Missing {len(missing)} skills" + (f": {', '.join(missing)}." if missing else ".")
    fit_band = "high" if score >= 75 else ("medium" if score >= 60 else "low")

    structured_report = {
        "summary": f"Candidate fit is {fit_band} with score {score:.1f}/100.",
        "fit_band": fit_band,
        "score_breakdown": {
            "experience_years": years,
            "matched_skills_count": len(matched),
            "missing_skills_count": len(missing),
        },
        "recommendation_rationale": f"Recommendation '{recommendation}' based on skills and experience alignment.",
    }

    return {
        "match_score": score,
        "recommendation": recommendation,
        "matched_skills": matched,
        "missing_skills": missing,
        "strengths_summary": strengths,
        "gaps_summary": gaps,
        "suggested_status": _score_to_status(score),
        "admin_summary": {
            "fit_band": fit_band,
            "years_experience": years,
            "top_matched": matched[:5],
            "top_gaps": missing[:5],
        },
        "structured_report": structured_report,
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
        resume_excerpt = await _load_resume_text_excerpt(application)

        system_prompt = (
            "You are a senior technical recruiter and hiring quality reviewer. "
            "Return only valid JSON with evidence-grounded scoring."
        )

        draft_prompt = json.dumps(
            {
                "job": {
                    "title": job.get("title"),
                    "department": job.get("department"),
                    "employment_type": job.get("employment_type"),
                    "jd_markdown": job.get("jd_markdown"),
                    "jd_raw_text": job.get("jd_raw_text"),
                },
                "candidate": {
                    "full_name": application.get("full_name"),
                    "years_experience": application.get("years_experience"),
                    "cover_note": application.get("cover_note"),
                    "linkedin_url": application.get("linkedin_url"),
                    "resume_original_name": application.get("resume_original_name"),
                    "resume_excerpt": resume_excerpt,
                },
                "base_result": base_result,
                "required_output": {
                    "match_score": "number between 0 and 100",
                    "recommendation": "shortlist|review|hold",
                    "summary": "short paragraph <= 240 chars",
                    "strengths_summary": "short sentence",
                    "gaps_summary": "short sentence",
                    "recommendation_rationale": "short sentence",
                },
            },
            ensure_ascii=True,
        )

        draft_data = await _call_llm_for_json(
            client=client,
            system_prompt=system_prompt,
            user_prompt=draft_prompt,
            temperature=0.25,
            max_tokens=450,
        )

        review_prompt = json.dumps(
            {
                "task": "Critique and calibrate the draft analysis against the supplied evidence. "
                "If unsupported claims exist, lower confidence and adjust score/recommendation.",
                "job": {
                    "title": job.get("title"),
                    "department": job.get("department"),
                    "employment_type": job.get("employment_type"),
                    "jd_markdown": job.get("jd_markdown"),
                },
                "candidate": {
                    "years_experience": application.get("years_experience"),
                    "cover_note": application.get("cover_note"),
                    "resume_excerpt": resume_excerpt,
                },
                "draft_analysis": draft_data,
                "required_output": {
                    "match_score": "number between 0 and 100",
                    "recommendation": "shortlist|review|hold",
                    "summary": "short paragraph <= 240 chars",
                    "strengths_summary": "short sentence",
                    "gaps_summary": "short sentence",
                    "recommendation_rationale": "short sentence",
                },
            },
            ensure_ascii=True,
        )

        reviewed_data = await _call_llm_for_json(
            client=client,
            system_prompt=system_prompt,
            user_prompt=review_prompt,
            temperature=0.1,
            max_tokens=350,
        )
        data = reviewed_data or draft_data

        ai_score = float(data.get("match_score")) if data.get("match_score") is not None else float(base_result["match_score"])
        ai_score = max(0.0, min(100.0, round(ai_score, 1)))
        ai_reco = _normalize_recommendation(str(data.get("recommendation") or base_result["recommendation"]), ai_score)

        fit_band = "high" if ai_score >= 75 else ("medium" if ai_score >= 60 else "low")
        structured_report = {
            "summary": str(data.get("summary") or base_result.get("structured_report", {}).get("summary") or "").strip(),
            "fit_band": fit_band,
            "score_breakdown": {
                "experience_years": base_result.get("admin_summary", {}).get("years_experience", 0.0),
                "matched_skills_count": len(base_result.get("matched_skills", [])),
                "missing_skills_count": len(base_result.get("missing_skills", [])),
            },
            "recommendation_rationale": str(
                data.get("recommendation_rationale")
                or base_result.get("structured_report", {}).get("recommendation_rationale")
                or "AI-reviewed recommendation based on job and profile alignment."
            ).strip(),
        }

        return {
            **base_result,
            "match_score": ai_score,
            "recommendation": ai_reco,
            "strengths_summary": str(data.get("strengths_summary") or base_result["strengths_summary"]),
            "gaps_summary": str(data.get("gaps_summary") or base_result["gaps_summary"]),
            "ai_summary": structured_report["summary"],
            "ai_used": True,
            "ai_provider": selection.provider.value,
            "ai_fallback_reason": selection.fallback_reason,
            "structured_report": structured_report,
        }
    except Exception as exc:
        return {
            **base_result,
            "ai_summary": str(base_result.get("structured_report", {}).get("summary") or "").strip(),
            "ai_used": False,
            "ai_provider": None,
            "ai_error": str(exc),
        }
