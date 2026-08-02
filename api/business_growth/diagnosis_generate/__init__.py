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

    issues = supa.table("issue_finding").select("*").eq("audit_run_id", audit_run_id).execute().data
    audit = supa.table("audit_run").select("*").eq("id", audit_run_id).execute().data
    if not audit:
        return error_response(req, "Audit not found", status_code=404)

    high_count = sum(1 for i in issues if i["severity"] in ["high", "critical"])
    overall = max(0, 100 - (high_count * 15))

    maturity_stage = "foundational" if overall < 50 else "moderate" if overall < 80 else "growth_ready"

    blockers = []
    if any(i["rule_id"] == "title_too_short" for i in issues):
        blockers.append("Weak page titles")
    if any(i["rule_id"] == "missing_h1" for i in issues):
        blockers.append("Missing H1 headings")

    opportunities = ["Improve conversion clarity", "Strengthen local trust signals", "Add AI-assisted content fixes"]

    diag = supa.table("growth_diagnosis").insert({
        "audit_run_id": audit_run_id,
        "maturity_stage": maturity_stage,
        "blockers": blockers,
        "opportunities": opportunities,
        "overall_score": overall,
    }).execute()

    return json_response(req, {"growth_diagnosis_id": diag.data[0]["id"]}, status_code=201)