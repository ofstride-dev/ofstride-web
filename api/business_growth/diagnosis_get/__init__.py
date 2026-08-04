import azure.functions as func
from business_growth.shared.db import get_supabase
from business_growth.shared.http import error_response, json_response, options_response


DOMAIN_RULE_MAP = {
    "technical": {"missing_h1", "missing_viewport_meta", "canonical_missing"},
    "content": {"title_too_short", "meta_description_weak", "thin_content"},
    "local": {"missing_local_schema", "missing_nap", "no_service_area_pages"},
    "conversion": {"weak_cta", "form_too_long", "no_primary_cta"},
}


def _domain_for_issue(issue: dict) -> str:
    rule_id = str(issue.get("rule_id") or "").strip()
    for domain, rules in DOMAIN_RULE_MAP.items():
        if rule_id in rules:
            return domain

    category = str(issue.get("category") or "").strip().lower()
    if category in DOMAIN_RULE_MAP:
        return category
    if category == "onpage":
        return "content"
    return "technical"


def _penalty_for_severity(severity: str) -> int:
    sev = (severity or "").lower()
    if sev == "critical":
        return 18
    if sev == "high":
        return 12
    if sev == "medium":
        return 7
    if sev == "low":
        return 4
    return 5

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
    if audit_run_id:
        issue_rows = (
            supa.table("issue_finding")
            .select("id,category,rule_id,severity")
            .eq("audit_run_id", audit_run_id)
            .execute()
            .data
            or []
        )

    counters = {
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
    }
    penalties = {
        "technical": 0,
        "content": 0,
        "local": 0,
        "conversion": 0,
    }
    for issue in issue_rows:
        severity = str(issue.get("severity") or "").lower()
        if severity in counters:
            counters[severity] += 1

        domain = _domain_for_issue(issue)
        penalties[domain] += _penalty_for_severity(severity)

    category_scores = {
        domain: max(0, 100 - penalty)
        for domain, penalty in penalties.items()
    }

    diagnosis["category_scores"] = category_scores
    diagnosis["issue_counts"] = counters
    diagnosis["total_issues"] = len(issue_rows)

    return json_response(req, diagnosis)