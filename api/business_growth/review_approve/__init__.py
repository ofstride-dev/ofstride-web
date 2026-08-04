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
    res = supa.table("consultant_review").insert({
        "growth_diagnosis_id": diagnosis_id,
        "reviewer_id": body.get("reviewer_id"),
        "changes_made": body.get("changes_made", {}),
        "approved": approved,
    }).execute()

    return json_response(req, {"review_id": res.data[0]["id"]}, status_code=201)