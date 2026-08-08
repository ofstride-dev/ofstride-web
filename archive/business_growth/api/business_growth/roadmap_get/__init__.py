import azure.functions as func
from business_growth.shared.db import get_supabase
from business_growth.shared.http import error_response, json_response, options_response

def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response(req)

    diagnosis_id = req.params.get("growth_diagnosis_id")
    if not diagnosis_id:
        return error_response(req, "Missing growth_diagnosis_id", status_code=400)

    supa = get_supabase()
    res = supa.table("roadmap_item").select("*").eq("growth_diagnosis_id", diagnosis_id).execute()
    return json_response(req, res.data)