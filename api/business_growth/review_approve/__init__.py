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

    diagnosis_id = body.get("growth_diagnosis_id")
    approved = bool(body.get("approved", False))
    if not diagnosis_id:
        return error_response(req, "Missing growth_diagnosis_id", status_code=400)

    supa = get_supabase()

    diagnosis_rows = (
        supa.table("growth_diagnosis")
        .select("id,audit_run_id")
        .eq("id", diagnosis_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not diagnosis_rows:
        return error_response(req, "Diagnosis not found", status_code=404)

    audit_run_id = diagnosis_rows[0].get("audit_run_id")
    if not audit_run_id:
        return error_response(req, "Diagnosis is missing audit linkage", status_code=409)

    audit_rows = (
        supa.table("audit_run")
        .select("id,status")
        .eq("id", audit_run_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not audit_rows:
        return error_response(req, "Linked audit run not found", status_code=404)

    audit_status = str(audit_rows[0].get("status") or "").strip().lower()
    if audit_status != "complete":
        return error_response(
            req,
            f"Review is blocked until audit is complete (current status: {audit_status or 'unknown'}).",
            status_code=409,
        )

    roadmap_rows = (
        supa.table("roadmap_item")
        .select("id")
        .eq("growth_diagnosis_id", diagnosis_id)
        .limit(1)
        .execute()
        .data
        or []
    )

    if not roadmap_rows:
        issue_rows = (
            supa.table("issue_finding")
            .select("id")
            .eq("audit_run_id", audit_run_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        if issue_rows:
            return error_response(
                req,
                "Review is blocked until roadmap is generated for this diagnosis.",
                status_code=409,
            )

    res = supa.table("consultant_review").insert({
        "growth_diagnosis_id": diagnosis_id,
        "reviewer_id": body.get("reviewer_id"),
        "changes_made": body.get("changes_made", {}),
        "approved": approved,
    }).execute()

    return json_response(req, {"review_id": res.data[0]["id"]}, status_code=201)