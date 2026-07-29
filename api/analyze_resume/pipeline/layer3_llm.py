"""Layer 3 — LLM Structured Reasoning & Scoring."""
from __future__ import annotations
import json
import logging
from typing import Any
from shared.core.llm_factory import get_llm_factory
from prompt_templates import build_layer3_prompt

_logger = logging.getLogger("ofstride.analyze_resume.layer3")

def _extract_json(raw: str) -> dict[str, Any]:
    text = (raw or "").strip()
    if not text:
        return {}
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        pass
    import re
    fenced = re.search(r"`(?:json)?\s*(\{[\s\S]*?\})\s*`", text, re.IGNORECASE)
    if fenced:
        try:
            return json.loads(fenced.group(1))
        except json.JSONDecodeError:
            pass
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(text[start:end+1])
        except json.JSONDecodeError:
            pass
    return {}

async def run_reasoning(
    jd_text: str,
    resume_text: str,
    layer1_result: dict[str, Any],
    layer2_result: dict[str, Any],
) -> dict[str, Any]:
    """Layer 3: Feed Layer 1 + Layer 2 metrics into LLM for structured scoring."""
    system_prompt, user_prompt = build_layer3_prompt(
        jd_text=jd_text,
        resume_text=resume_text,
        layer1_result=layer1_result,
        layer2_result=layer2_result,
    )
    factory = get_llm_factory()
    selection = factory.select_provider("azure_openai")
    raw = await selection.client.agenerate_json(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=0.1,
        max_tokens=1500,
    )
    result = _extract_json(raw)
    if not result:
        _logger.warning("Layer 3 LLM returned unparseable JSON. Raw: %s", raw[:200])
        return _fallback_result(layer1_result, layer2_result)
    return {
        "llm_provider": selection.provider.value,
        "llm_fallback_reason": selection.fallback_reason,
        **result,
    }

def _fallback_result(layer1: dict[str, Any], layer2: dict[str, Any]) -> dict[str, Any]:
    """Safe fallback when LLM output is unparseable."""
    return {
        "llm_provider": None,
        "llm_fallback_reason": "unparseable_llm_output",
        "match_score": round(layer1["overlap_ratio"] * 100, 1),
        "recommendation": "Manual HR Review Required",
        "summary": "AI analysis encountered an error. Manual review recommended.",
        "fit_band": "medium",
        "skills_matrix": [],
        "experience_analysis": {},
        "education_analysis": {},
        "score_breakdown": {
            "keyword_match_score": round(layer1["overlap_ratio"] * 100, 1),
            "semantic_similarity_score": round(layer2.get("overall_score", 0) * 100, 1),
            "experience_score": 0,
            "education_score": 0,
        },
    }
