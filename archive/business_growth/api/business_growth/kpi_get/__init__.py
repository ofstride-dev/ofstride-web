import azure.functions as func
from business_growth.shared.db import get_supabase
from business_growth.shared.http import error_response, json_response, options_response

def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response(req)

    diagnosis_id = req.params.get("growth_diagnosis_id")

    supa = get_supabase()

    if diagnosis_id:
        diagnosis_rows = supa.table("growth_diagnosis").select("*").eq("id", diagnosis_id).execute().data or []
        if not diagnosis_rows:
            return error_response(req, "Diagnosis not found", status_code=404)
    else:
        diagnosis_rows = (
            supa.table("growth_diagnosis")
            .select("*")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not diagnosis_rows:
            return json_response(req, [])

    diagnosis = diagnosis_rows[0]
    selected_diagnosis_id = diagnosis.get("id")

    roadmap_items = (
        supa.table("roadmap_item")
        .select("id,status,priority_score")
        .eq("growth_diagnosis_id", selected_diagnosis_id)
        .execute()
        .data
        or []
    )
    reviews = (
        supa.table("consultant_review")
        .select("id,approved")
        .eq("growth_diagnosis_id", selected_diagnosis_id)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )

    issue_count = 0
    audit_run_id = diagnosis.get("audit_run_id")
    if audit_run_id:
        issue_count = len(
            supa.table("issue_finding")
            .select("id")
            .eq("audit_run_id", audit_run_id)
            .execute()
            .data
            or []
        )

    done_count = sum(1 for item in roadmap_items if item.get("status") == "done")
    avg_priority = round(
        sum(float(item.get("priority_score") or 0) for item in roadmap_items) / max(1, len(roadmap_items)),
        2,
    )

    latest_review = reviews[0] if reviews else None

    return json_response(
        req,
        [
            {
                "growth_diagnosis_id": selected_diagnosis_id,
                "overall_score": diagnosis.get("overall_score"),
                "maturity_stage": diagnosis.get("maturity_stage"),
                "issues_total": issue_count,
                "roadmap_items_total": len(roadmap_items),
                "roadmap_done": done_count,
                "roadmap_completion_rate": round((done_count / max(1, len(roadmap_items))) * 100, 1),
                "avg_priority_score": avg_priority,
                "review_count": len(reviews),
                "latest_review_approved": latest_review.get("approved") if latest_review else None,
            }
        ],
    )