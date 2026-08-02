import azure.functions as func
from business_growth.shared.db import get_supabase
from business_growth.shared.http import error_response, json_response, options_response


def _compute_and_create_diagnosis(supa, audit_run_id: str) -> str:
    issues = supa.table("issue_finding").select("*").eq("audit_run_id", audit_run_id).execute().data or []

    high_count = sum(1 for i in issues if i.get("severity") in ["high", "critical"])
    overall = max(0, 100 - (high_count * 15))
    maturity_stage = "foundational" if overall < 50 else "moderate" if overall < 80 else "growth_ready"

    blockers = []
    if any(i.get("rule_id") == "title_too_short" for i in issues):
        blockers.append("Weak page titles")
    if any(i.get("rule_id") == "missing_h1" for i in issues):
        blockers.append("Missing H1 headings")

    opportunities = [
        "Improve conversion clarity",
        "Strengthen local trust signals",
        "Add AI-assisted content fixes",
    ]

    diag = supa.table("growth_diagnosis").insert({
        "audit_run_id": audit_run_id,
        "maturity_stage": maturity_stage,
        "blockers": blockers,
        "opportunities": opportunities,
        "overall_score": overall,
    }).execute()
    return diag.data[0]["id"]

def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response(req)

    try:
        body = req.get_json()
    except Exception:
        return error_response(req, "Invalid JSON", status_code=400)

    if not isinstance(body, dict):
        return error_response(req, "Invalid JSON object", status_code=400)

    audit_run_id = body.get("audit_run_id")
    if not audit_run_id:
        return error_response(req, "Missing audit_run_id", status_code=400)

    supa = get_supabase()

    audit = supa.table("audit_run").select("id").eq("id", audit_run_id).execute().data or []
    if not audit:
        return error_response(req, "Audit not found", status_code=404)

    diag_res = supa.table("growth_diagnosis").select("id").eq("audit_run_id", audit_run_id).limit(1).execute()
    if diag_res.data:
        diagnosis_id = diag_res.data[0]["id"]
    else:
        diagnosis_id = _compute_and_create_diagnosis(supa, audit_run_id)

    roadmap_items = [
        {
            "growth_diagnosis_id": diagnosis_id,
            "phase": "quick_win",
            "title": "Rewrite page titles and meta descriptions",
            "description": "Improve snippet quality and intent match on key pages.",
            "domain": "content",
            "impact": 5, "confidence": 4, "effort": 2, "strategic_weight": 1.2,
            "priority_score": 0,
            "status": "draft",
        },
        {
            "growth_diagnosis_id": diagnosis_id,
            "phase": "foundation_30d",
            "title": "Fix H1 and page hierarchy",
            "description": "Make service pages clearer and more scannable.",
            "domain": "technical",
            "impact": 4, "confidence": 4, "effort": 2, "strategic_weight": 1.1,
            "priority_score": 0,
            "status": "draft",
        },
        {
            "growth_diagnosis_id": diagnosis_id,
            "phase": "growth_60_90d",
            "title": "Improve conversion CTA and contact flow",
            "description": "Reduce friction and improve inquiry rate.",
            "domain": "conversion",
            "impact": 5, "confidence": 3, "effort": 3, "strategic_weight": 1.3,
            "priority_score": 0,
            "status": "draft",
        },
    ]

    for item in roadmap_items:
        item["priority_score"] = (item["impact"] * item["confidence"] * item["strategic_weight"]) / item["effort"]

    res = supa.table("roadmap_item").insert(roadmap_items).execute()

    return json_response(req, {"growth_diagnosis_id": diagnosis_id, "roadmap_items_created": len(res.data)}, status_code=201)