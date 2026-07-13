import os
import sys

import azure.functions as func

script_dir = os.path.dirname(os.path.abspath(__file__))
shared_path = os.path.join(script_dir, "..", "shared")
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

from core.api_contract import error_response, get_trace_id, ok_response, options_response
from persistence.careers_store import get_careers_store
from security.admin_auth import AdminAuthError, require_admin

ALLOWED_JOB_STATUSES = {"draft", "active", "archived"}


async def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = get_trace_id(req)
    if req.method == "OPTIONS":
        return options_response(trace_id=trace_id, req=req)

    try:
        admin = require_admin(req)
    except AdminAuthError as exc:
        return error_response(
            error_type="validation",
            message=str(exc),
            trace_id=trace_id,
            req=req,
            status_code=401,
        )

    store = get_careers_store()
    if not store.is_available:
        return error_response(
            error_type="infra",
            message="Careers store unavailable.",
            trace_id=trace_id,
            req=req,
            status_code=503,
        )

    if req.method == "GET":
        jobs = store.list_jobs(include_inactive=True)
        return ok_response(trace_id=trace_id, req=req, data={"items": jobs, "count": len(jobs)})

    try:
        body = req.get_json()
    except ValueError:
        return error_response(
            error_type="validation",
            message="Request body must be valid JSON.",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )

    if not isinstance(body, dict):
        return error_response(
            error_type="validation",
            message="Request body must be a JSON object.",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )

    title = str(body.get("title", "")).strip()
    jd_markdown = str(body.get("jd_markdown", "")).strip()
    jd_raw_text = str(body.get("jd_raw_text", "")).strip() or jd_markdown
    status = str(body.get("status", "draft")).strip().lower()

    if not title or not jd_markdown:
        return error_response(
            error_type="validation",
            message="Both 'title' and 'jd_markdown' are required.",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )
    if status not in ALLOWED_JOB_STATUSES:
        return error_response(
            error_type="validation",
            message="status must be one of: draft, active, archived",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )

    saved = store.upsert_job(
        job_id=str(body.get("id", "")).strip() or None,
        title=title,
        department=str(body.get("department", "")).strip() or None,
        location=str(body.get("location", "")).strip() or None,
        employment_type=str(body.get("employment_type", "")).strip() or None,
        jd_markdown=jd_markdown,
        jd_raw_text=jd_raw_text,
        jd_blob_path=str(body.get("jd_blob_path", "")).strip() or None,
        jd_blob_container=str(body.get("jd_blob_container", "")).strip() or None,
        status=status,
        created_by=admin.get("user_name"),
    )
    if not saved:
        return error_response(
            error_type="infra",
            message="Failed to save job.",
            trace_id=trace_id,
            req=req,
            status_code=500,
        )

    store.log_admin_action(
        admin_user_id=admin["user_id"],
        action_type="upsert_job",
        entity_type="job",
        entity_id=str(saved.get("id") or ""),
        action_detail=f"status={saved.get('status', '')}",
    )

    return ok_response(trace_id=trace_id, req=req, data=saved)
