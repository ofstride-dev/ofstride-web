import asyncio
import json

import azure.functions as func

from business_growth.shared.db import get_supabase
from business_growth.shared.http import error_response, json_response, options_response
from core.llm_factory import get_llm_factory


DOMAIN_RULE_HINTS = {
    "technical": {"missing_h1", "missing_viewport_meta", "canonical_missing"},
    "content": {"title_too_short", "meta_description_weak", "thin_content"},
    "local": {"missing_local_schema", "missing_nap", "no_service_area_pages"},
    "conversion": {"weak_cta", "form_too_long", "no_primary_cta"},
}


def _domain_for_issue(issue: dict) -> str:
    rule_id = str(issue.get("rule_id") or "").strip()
    for domain, rules in DOMAIN_RULE_HINTS.items():
        if rule_id in rules:
            return domain

    category = str(issue.get("category") or "").strip().lower()
    if category in DOMAIN_RULE_HINTS:
        return category
    if category == "onpage":
        return "content"
    return "technical"


def _safe_json(req: func.HttpRequest) -> dict:
    try:
        data = req.get_json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _cms_steps(cms: str) -> list[str]:
    cms_name = (cms or "generic").strip().lower()
    if cms_name == "wordpress":
        return [
            "Go to Pages > Edit and update the SEO title/meta with your SEO plugin.",
            "Use block editor heading blocks to enforce one H1 per page.",
            "Validate contact forms with minimal required fields and one primary CTA button.",
        ]
    if cms_name == "shopify":
        return [
            "Update page title and meta in Online Store > Preferences or page settings.",
            "Edit theme sections to keep one H1 and simplify content hierarchy.",
            "Strengthen product/landing CTA blocks and reduce checkout friction.",
        ]

    return [
        "Update page-level title and meta description in your website page settings or HTML templates.",
        "Ensure each page has one clear H1 and a logical heading structure.",
        "Simplify conversion paths: one primary CTA and fewer required form inputs.",
    ]


def _template_for_item(item: dict, issues: list[dict], cms: str) -> dict:
    title = str(item.get("title") or "Roadmap item")
    domain = str(item.get("domain") or "technical")
    matched_domain_issues = [i for i in issues if _domain_for_issue(i) == domain]
    if not matched_domain_issues:
        matched_domain_issues = issues

    related_issues = matched_domain_issues[:4]

    before_after = []
    for issue in related_issues[:2]:
        rule_id = str(issue.get("rule_id") or "")
        evidence = issue.get("evidence") or {}

        if rule_id == "title_too_short":
            current = str(evidence.get("title") or "(missing title)")
            suggested = f"{title} | Ofstride"
            before_after.append({
                "type": "title",
                "before": current,
                "after": suggested,
            })
        elif rule_id == "meta_description_weak":
            current = str(evidence.get("meta_description") or "(missing meta description)")
            suggested = "Get clear outcomes, fast implementation, and measurable growth with Ofstride consultants."
            before_after.append({
                "type": "meta_description",
                "before": current,
                "after": suggested,
            })
        elif rule_id == "missing_h1":
            before_after.append({
                "type": "h1",
                "before": "No clear H1 found",
                "after": title,
            })

    snippets = []
    if domain in {"content", "technical"}:
        snippets.append({
            "label": "Meta title and description",
            "code": "<title>Growth Execution Plan | Ofstride</title>\n<meta name=\"description\" content=\"Clear positioning, stronger conversion, and measurable growth.\" />",
        })
    if domain == "conversion":
        snippets.append({
            "label": "Primary CTA block",
            "code": "<section class=\"cta\">\n  <h2>Book Your Growth Audit</h2>\n  <p>Get a practical 30/60/90-day roadmap.</p>\n  <a href=\"/contact\" class=\"btn btn-primary\">Book a Call</a>\n</section>",
        })

    steps = [
        f"Prioritize and implement: {title}.",
        "Apply the change on top pages with highest traffic or lead intent.",
        "QA on mobile and desktop, then monitor CTR/conversion in the next 2 weeks.",
    ]
    steps.extend(_cms_steps(cms))

    return {
        "roadmap_item_id": item.get("id"),
        "title": title,
        "domain": domain,
        "steps": steps,
        "snippets": snippets,
        "before_after": before_after,
    }


async def _llm_narrative(guidance_items: list[dict], cms: str) -> dict:
    factory = get_llm_factory()
    selection = await factory.get_healthy_llm_with_metadata()

    user_prompt = {
        "cms": cms,
        "guidance_items": guidance_items,
        "task": "Write concise consultant-ready recommendations with sequencing and expected outcomes.",
    }

    system_prompt = (
        "You are a growth consultant. Produce crisp, practical recommendations. "
        "Use bullet points and include expected impact and implementation order."
    )

    message = await selection.client.agenerate(
        system_prompt=system_prompt,
        user_prompt=json.dumps(user_prompt),
        temperature=0.2,
        max_tokens=700,
    )

    return {
        "provider": selection.provider.value,
        "fallback_reason": selection.fallback_reason,
        "narrative": message,
    }


def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response(req)

    body = _safe_json(req)
    diagnosis_id = body.get("growth_diagnosis_id")
    item_id = body.get("roadmap_item_id")
    cms = str(body.get("cms") or "generic")
    include_llm = bool(body.get("include_llm", True))

    if not diagnosis_id and not item_id:
        return error_response(req, "Missing growth_diagnosis_id or roadmap_item_id", status_code=400)

    supa = get_supabase()

    item_rows = []
    if item_id:
        item_rows = supa.table("roadmap_item").select("*").eq("id", item_id).execute().data or []
        if not item_rows:
            return error_response(req, "Roadmap item not found", status_code=404)
        diagnosis_id = item_rows[0].get("growth_diagnosis_id")
    else:
        item_rows = (
            supa.table("roadmap_item")
            .select("*")
            .eq("growth_diagnosis_id", diagnosis_id)
            .order("priority_score", desc=True)
            .limit(3)
            .execute()
            .data
            or []
        )

    if not item_rows:
        return error_response(req, "No roadmap items found", status_code=404)

    diagnosis_rows = supa.table("growth_diagnosis").select("*").eq("id", diagnosis_id).execute().data or []
    audit_run_id = diagnosis_rows[0].get("audit_run_id") if diagnosis_rows else None

    issue_rows = []
    if audit_run_id:
        issue_rows = (
            supa.table("issue_finding")
            .select("id,rule_id,severity,description,evidence")
            .eq("audit_run_id", audit_run_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
            .data
            or []
        )

    guidance_items = [_template_for_item(item, issue_rows, cms) for item in item_rows]

    llm_payload = None
    if include_llm:
        try:
            llm_payload = asyncio.run(_llm_narrative(guidance_items, cms))
        except Exception as exc:
            llm_payload = {
                "provider": None,
                "fallback_reason": f"llm_error:{str(exc)}",
                "narrative": "AI narrative is unavailable right now. Use the templated guidance below.",
            }

    return json_response(
        req,
        {
            "growth_diagnosis_id": diagnosis_id,
            "guidance": guidance_items,
            "ai_narrative": llm_payload,
        },
    )
