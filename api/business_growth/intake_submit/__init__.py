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

    required = ["name", "domain", "contact_name", "contact_email"]
    for f in required:
        if not body.get(f):
            return error_response(req, f"Missing field: {f}", status_code=400)

    supa = get_supabase()
    bp = supa.table("business_profile").insert({
        "name": body["name"],
        "domain": body["domain"],
        "industry": body.get("industry"),
        "target_geo": body.get("target_geo"),
        "growth_goal": body.get("growth_goal"),
        "current_channels": body.get("current_channels", []),
        "budget_band": body.get("budget_band"),
        "urgency_band": body.get("urgency_band"),
        "contact_name": body["contact_name"],
        "contact_email": body["contact_email"],
        "contact_phone": body.get("contact_phone"),
    }).execute()

    business_profile_id = bp.data[0]["id"]

    sess = supa.table("assessment_session").insert({
        "business_profile_id": business_profile_id,
        "status": "new",
        "metadata": body.get("metadata", {}),
    }).execute()

    return json_response(
        req,
        {
            "business_profile_id": business_profile_id,
            "assessment_session_id": sess.data[0]["id"]
        },
        status_code=201,
    )