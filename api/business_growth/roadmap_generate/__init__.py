import azure.functions as func
from business_growth.shared.db import get_supabase
from business_growth.shared.http import error_response, json_response, options_response
from business_growth.shared.roadmap import build_roadmap_items


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

    audit = (
        supa.table("audit_run")
        .select("id,status,page_count")
        .eq("id", audit_run_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not audit:
        return error_response(req, "Audit not found", status_code=404)

    run = audit[0]
    status = str(run.get("status") or "").strip().lower()
    page_count = int(run.get("page_count") or 0)
    if status != "complete":
        return error_response(
            req,
            f"Audit is not complete yet (current status: {status or 'unknown'}). Please wait for completion before roadmap generation.",
            status_code=409,
        )
    if page_count <= 0:
        return error_response(
            req,
            "Audit completed without crawl data (0 pages). Re-run audit before generating roadmap.",
            status_code=409,
        )

    diag_res = supa.table("growth_diagnosis").select("id").eq("audit_run_id", audit_run_id).limit(1).execute()
    if not diag_res.data:
        return error_response(
            req,
            "Diagnosis is required before roadmap generation. Please run diagnosis first.",
            status_code=409,
        )
    diagnosis_id = diag_res.data[0]["id"]

    roadmap_items = build_roadmap_items(supa, audit_run_id, diagnosis_id)

    res = supa.table("roadmap_item").insert(roadmap_items).execute() if roadmap_items else None
    created_count = len(res.data) if res else 0
    payload = {
        "growth_diagnosis_id": diagnosis_id,
        "roadmap_items_created": created_count,
    }
    if created_count == 0:
        payload["message"] = (
            "No evidence-backed roadmap actions were generated from current audit/profile data."
        )

    return json_response(req, payload, status_code=201)