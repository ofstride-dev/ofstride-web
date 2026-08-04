import azure.functions as func
from business_growth.shared.db import get_supabase
from business_growth.shared.http import error_response, json_response, options_response

def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response(req)

    audit_run_id = req.params.get("audit_run_id")
    if not audit_run_id:
        return error_response(req, "Missing audit_run_id", status_code=400)

    supa = get_supabase()
    res = supa.table("audit_page").select("*").eq("audit_run_id", audit_run_id).execute()
    return json_response(req, res.data)