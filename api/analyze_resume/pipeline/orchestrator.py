"""Pipeline orchestrator — coordinates Layer 1, 2, and 3 analysis."""
from __future__ import annotations
import asyncio
import logging
from typing import Any
from pipeline.layer1_keyword import extract_jd_skills, match_resume_against_jd
from pipeline.layer2_vector import compute_similarity_scores
from pipeline.layer3_llm import run_reasoning

_logger = logging.getLogger("ofstride.analyze_resume.orchestrator")

async def run_pipeline(
    jd_text: str,
    resume_text: str,
    job_title: str = "",
    department: str = "",
) -> dict[str, Any]:
    _logger.info("Starting resume analysis pipeline")
    jd_skills = extract_jd_skills(jd_text)
    _logger.debug("Layer 1: found %d required, %d preferred, %d bigrams",
        len(jd_skills["required_skills"]), len(jd_skills["preferred_skills"]), len(jd_skills["bigrams"]))
    layer1_result = match_resume_against_jd(resume_text, jd_skills)
    _logger.debug("Layer 1: matched %d/%d required skills, overlap_ratio=%.2f",
        layer1_result["matched_count_required"], layer1_result["total_required"], layer1_result["overlap_ratio"])
    layer2_result = await compute_similarity_scores(jd_text, resume_text)
    _logger.debug("Layer 2: overall semantic score=%.4f", layer2_result["overall_score"])
    layer3_result = await run_reasoning(
        jd_text=jd_text, resume_text=resume_text,
        layer1_result=layer1_result, layer2_result=layer2_result)
    _logger.debug("Layer 3: match_score=%s", layer3_result.get("match_score"))
    final_score = float(layer3_result.get("match_score") or round(layer1_result["overlap_ratio"] * 100, 1))
    final_recommendation = str(layer3_result.get("recommendation") or _default_recommendation(final_score))
    fit_band = "high" if final_score >= 75 else ("medium" if final_score >= 50 else "low")
    # Build a structured executive summary mirroring the careers_agentic path so
    # the frontend Executive Summary tab renders the same structured components
    # (headline, weighted dimension bars, highlights/risks) for pipeline records.
    layer3_result["executive_summary"] = _build_executive_summary(
        score=final_score,
        fit_band=fit_band,
        recommendation=final_recommendation,
        layer1_result=layer1_result,
        layer3_result=layer3_result,
    )

    return {
        "job_title": job_title,
        "department": department,
        "layer1": layer1_result,
        "layer2": layer2_result,
        "layer3": layer3_result,
        "final_score": final_score,
        "final_recommendation": final_recommendation,
        "fit_band": fit_band,
    }

def _default_recommendation(score: float) -> str:
    if score >= 85:
        return "Strong Proceed"
    if score >= 70:
        return "Proceed with Caveats"
    if score >= 50:
        return "Manual HR Review Required"
    return "Reject"


def _build_executive_summary(
    *,
    score: float,
    fit_band: str,
    recommendation: str,
    layer1_result: dict[str, Any],
    layer3_result: dict[str, Any],
) -> dict[str, Any]:
    """Build a structured executive-summary object for the 3-layer pipeline.

    Mirrors the structured executive summary produced by the careers_agentic
    analyzer so the frontend renders identical structured components (verdict
    headline, weighted dimension bars, highlights, risks, confidence) for both
    analysis engines. Numbers are derived from the canonical Layer 1/3 metrics.
    """
    breakdown = layer3_result.get("score_breakdown") or {}
    keyword = float(breakdown.get("keyword_match_score")
                    or (layer1_result.get("overlap_ratio", 0.0) * 100))
    experience_sub = float(breakdown.get("experience_score") or 0.0)
    education_sub = float(breakdown.get("education_score") or 0.0)

    def _to_weighted(sub: float, weight: int) -> int:
        return round(max(0.0, min(100.0, sub)) / 100 * weight)

    skills_fit = _to_weighted(keyword, 40)
    experience_fit = _to_weighted(experience_sub, 30)
    education_fit = _to_weighted(education_sub, 30)

    matched = [m.get("skill") for m in layer1_result.get("matched_required", []) if m.get("skill")]
    missing = [s for s in layer1_result.get("missing_required", []) if s]
    exp_analysis = layer3_result.get("experience_analysis") or {}
    try:
        years = float(exp_analysis.get("candidate_years") or 0.0)
    except (TypeError, ValueError):
        years = 0.0

    band_label = str(fit_band).capitalize()
    reco_label = str(recommendation) if recommendation else "-"
    narrative = str(layer3_result.get("summary") or "").strip()
    if not narrative:
        total = len(matched) + len(missing)
        narrative = (
            f"Recommendation: {reco_label} ({band_label} fit). "
            f"The candidate scores {score:.1f}/100 overall, driven by "
            f"skills fit {skills_fit}/40, experience {experience_fit}/30 "
            f"and education {education_fit}/30 \u2014 matching "
            f"{len(matched)} of {total} critical skills with "
            f"{years:.1f} years of experience."
        )

    return {
        "headline": f"{reco_label} \u00b7 {band_label} fit \u00b7 {round(float(score))}/100",
        "narrative": narrative,
        "recommendation": str(recommendation or ""),
        "fit_band": str(fit_band),
        "score": round(float(score)),
        "dimensions": [
            {"label": "Skills Fit", "score": skills_fit, "max": 40, "color": "indigo"},
            {"label": "Experience", "score": experience_fit, "max": 30, "color": "cyan"},
            {"label": "Education", "score": education_fit, "max": 30, "color": "violet"},
        ],
        "highlights": matched[:3],
        "risks": missing[:3],
        "confidence": str(fit_band),
    }
