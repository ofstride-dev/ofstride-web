import azure.functions as func
from business_growth.shared.db import get_supabase
from business_growth.shared.diagnosis import build_diagnosis_payload
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

    audit = (
        supa.table("audit_run")
        .select("id,status,page_count,completed_at")
        .eq("id", audit_run_id)
        .limit(1)
        .execute()
        .data
    )
    if not audit:
        return error_response(req, "Audit not found", status_code=404)

    run = audit[0]
    status = (run.get("status") or "").strip().lower()
    page_count = int(run.get("page_count") or 0)
    if status != "complete":
        return error_response(
            req,
            f"Audit is not complete yet (current status: {status or 'unknown'}). Please wait for completion before diagnosis.",
            status_code=409,
        )
    if page_count <= 0:
        return error_response(
            req,
            "Audit completed without crawl data (0 pages). Re-run audit with a reachable website URL.",
            status_code=409,
        )

    payload = build_diagnosis_payload(supa, audit_run_id)
    diag = supa.table("growth_diagnosis").insert({
        "audit_run_id": payload["audit_run_id"],
        "maturity_stage": payload["maturity_stage"],
        "blockers": payload["blockers"],
        "opportunities": payload["opportunities"],
        "overall_score": payload["overall_score"],
    }).execute()

    return json_response(req, {"growth_diagnosis_id": diag.data[0]["id"]}, status_code=201)