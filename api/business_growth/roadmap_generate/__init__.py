import azure.functions as func
from business_growth.shared.db import get_supabase
from business_growth.shared.http import error_response, json_response, options_response

def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response(req)

    try:
        body = req.get_json()
    except Exception:
        return error_response(req, "Invalid JSON", status_code=400)

    audit_run_id = body.get("audit_run_id")
    if not audit_run_id:
        return error_response(req, "Missing audit_run_id", status_code=400)

    supa = get_supabase()

    diag_res = supa.table("growth_diagnosis").select("*").eq("audit_run_id", audit_run_id).execute()
    if not diag_res.data:
        return error_response(req, "Diagnosis not found", status_code=404)

    diagnosis = diag_res.data[0]
    diagnosis_id = diagnosis["id"]

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