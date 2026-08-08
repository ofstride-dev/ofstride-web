import azure.functions as func
from business_growth.shared.db import get_supabase
from business_growth.shared.diagnosis import compute_enriched_diagnosis
from business_growth.shared.http import error_response, json_response, options_response


def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response(req)

    diagnosis_id = req.params.get("growth_diagnosis_id")
    if not diagnosis_id:
        return error_response(req, "Missing growth_diagnosis_id", status_code=400)

    supa = get_supabase()
    res = supa.table("growth_diagnosis").select("*").eq("id", diagnosis_id).execute()
    if not res.data:
        return error_response(req, "Not found", status_code=404)

    diagnosis = res.data[0]

    issue_rows = []
    audit_run_id = diagnosis.get("audit_run_id")
    audited_pages_count = 0
    if audit_run_id:
        issue_rows = (
            supa.table("issue_finding")
            .select("id,category,rule_id,severity")
            .eq("audit_run_id", audit_run_id)
            .execute()
            .data
            or []
        )

        page_rows = (
            supa.table("audit_page")
            .select("id")
            .eq("audit_run_id", audit_run_id)
            .execute()
            .data
            or []
        )
        audited_pages_count = len(page_rows)

    return json_response(
        req,
        compute_enriched_diagnosis(
            diagnosis,
            issue_rows,
            audited_pages_count=audited_pages_count,
        ),
    )