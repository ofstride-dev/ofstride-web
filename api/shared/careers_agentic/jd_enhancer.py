from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from core.settings import DATA_ROOT


@dataclass
class JdTemplate:
    template_id: str
    title_hint: str
    department_hint: str
    responsibilities: list[str]
    must_have: list[str]
    preferred: list[str]


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip().lower())


def _tokenize(text: str) -> set[str]:
    text = _normalize(text)
    return {tok for tok in re.split(r"[^a-z0-9]+", text) if len(tok) > 2}


def _load_templates() -> list[JdTemplate]:
    source = DATA_ROOT / "jd_templates.json"
    if not source.exists():
        return []
    raw = json.loads(source.read_text(encoding="utf-8"))
    templates: list[JdTemplate] = []
    for item in raw if isinstance(raw, list) else []:
        templates.append(
            JdTemplate(
                template_id=str(item.get("id") or "template"),
                title_hint=str(item.get("title_hint") or "").strip(),
                department_hint=str(item.get("department_hint") or "").strip(),
                responsibilities=[str(x).strip() for x in (item.get("responsibilities") or []) if str(x).strip()],
                must_have=[str(x).strip() for x in (item.get("must_have") or []) if str(x).strip()],
                preferred=[str(x).strip() for x in (item.get("preferred") or []) if str(x).strip()],
            )
        )
    return templates


def _pick_best_template(*, title: str, department: str, jd_text: str, templates: list[JdTemplate]) -> JdTemplate | None:
    if not templates:
        return None
    query_tokens = _tokenize(" ".join([title, department, jd_text]))
    best: tuple[int, JdTemplate] | None = None
    for template in templates:
        haystack = " ".join(
            [
                template.title_hint,
                template.department_hint,
                " ".join(template.responsibilities),
                " ".join(template.must_have),
                " ".join(template.preferred),
            ]
        )
        score = len(query_tokens.intersection(_tokenize(haystack)))
        if best is None or score > best[0]:
            best = (score, template)
    return best[1] if best else None


def enhance_jd_markdown(*, title: str, department: str | None, location: str | None, employment_type: str | None, jd_markdown: str) -> dict[str, Any]:
    title = str(title or "").strip() or "Role"
    department = str(department or "").strip()
    location = str(location or "").strip()
    employment_type = str(employment_type or "").strip()
    jd_markdown = str(jd_markdown or "").strip()

    templates = _load_templates()
    best = _pick_best_template(title=title, department=department, jd_text=jd_markdown, templates=templates)

    responsibilities = []
    must_have = []
    preferred = []
    if best:
        responsibilities = best.responsibilities[:5]
        must_have = best.must_have[:7]
        preferred = best.preferred[:5]

    if not responsibilities:
        responsibilities = [
            "Deliver role-specific outcomes aligned to business goals.",
            "Collaborate with cross-functional teams and stakeholders.",
            "Track KPIs, quality standards, and delivery timelines.",
            "Document processes and handoffs for continuity.",
            "Identify improvements and execute with ownership.",
        ]
    if not must_have:
        must_have = [
            "Relevant domain experience in similar role scope.",
            "Strong communication and stakeholder management skills.",
            "Problem-solving mindset with ownership and execution focus.",
            "Comfort with data-driven decision making.",
            "Ability to work in a fast-moving environment.",
        ]

    summary = (
        "Own key outcomes for this role, collaborate across teams, and deliver measurable impact "
        "through structured execution and continuous improvement."
    )

    short_jd = "\n".join(
        [
            f"# {title}",
            "",
            "## Snapshot",
            f"- Department: {department or 'General'}",
            f"- Location: {location or 'As discussed'}",
            f"- Employment Type: {employment_type or 'Full-time'}",
            "",
            "## Role Summary",
            summary,
            "",
            "## Key Responsibilities",
            *[f"- {item}" for item in responsibilities],
            "",
            "## Must-Have Skills",
            *[f"- {item}" for item in must_have],
            "",
            "## Preferred Skills",
            *([f"- {item}" for item in preferred] if preferred else ["- Nice-to-have skills based on business context."]),
            "",
            "## Interview Focus",
            "- Problem-solving depth",
            "- Functional execution quality",
            "- Collaboration and communication",
            "- Ownership and delivery consistency",
        ]
    )

    return {
        "enhanced_jd_markdown": short_jd,
        "template_id": best.template_id if best else "fallback",
        "has_template_match": bool(best),
    }


async def enhance_jd_with_existing_llm(*, title: str, department: str | None, location: str | None, employment_type: str | None, jd_markdown: str) -> dict[str, Any]:
    baseline = enhance_jd_markdown(
        title=title,
        department=department,
        location=location,
        employment_type=employment_type,
        jd_markdown=jd_markdown,
    )
    try:
        # Lazy import keeps non-LLM routes healthy even if optional LLM deps are absent.
        from core.llm_factory import get_llm_factory
        llm_factory = get_llm_factory()
        selection = await llm_factory.get_healthy_llm_with_metadata()
        system_prompt = (
            "You are a senior hiring specialist. Rewrite job descriptions into a concise, structured, and practical format. "
            "Keep facts grounded in the provided content and avoid inventing compensation, legal terms, or company policies."
        )
        user_prompt = "\n".join(
            [
                f"Job title: {title}",
                f"Department: {department or 'General'}",
                f"Location: {location or 'As discussed'}",
                f"Employment type: {employment_type or 'Full-time'}",
                "",
                "Current JD markdown:",
                jd_markdown or baseline["enhanced_jd_markdown"],
                "",
                "Return markdown only with sections:",
                "1) Snapshot",
                "2) Role Summary",
                "3) Key Responsibilities (5 bullets)",
                "4) Must-Have Skills (5-7 bullets)",
                "5) Preferred Skills (3-5 bullets)",
                "6) Interview Focus (4 bullets)",
            ]
        )
        content = await selection.client.agenerate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.2,
            max_tokens=900,
        )
        markdown = str(content or "").strip()
        if len(markdown) < 80:
            return {
                **baseline,
                "used_llm": False,
                "llm_provider": None,
                "llm_reason": "llm_response_too_short",
            }
        return {
            **baseline,
            "enhanced_jd_markdown": markdown,
            "used_llm": True,
            "llm_provider": selection.provider.value,
            "llm_reason": selection.fallback_reason,
        }
    except Exception as exc:
        return {
            **baseline,
            "used_llm": False,
            "llm_provider": None,
            "llm_reason": str(exc),
        }
