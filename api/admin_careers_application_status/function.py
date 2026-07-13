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

ALLOWED_STATUSES = {"under_review", "shortlisted", "rejected"}


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

    application_id = (req.route_params.get("application_id") if req.route_params else "") or ""
    application_id = application_id.strip()
    if not application_id:
        return error_response(
            error_type="validation",
            message="application_id is required.",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )

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

    status = str((body or {}).get("status", "")).strip().lower()
    if status not in ALLOWED_STATUSES:
        return error_response(
            error_type="validation",
            message="status must be one of: under_review, shortlisted, rejected",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )

    store = get_careers_store()
    updated = store.update_application_status(application_id=application_id, status=status) if store.is_available else False
    if not updated:
        return error_response(
            error_type="validation",
            message="Application not found.",
            trace_id=trace_id,
            req=req,
            status_code=404,
        )

    store.log_admin_action(
        admin_user_id=admin["user_id"],
        action_type="update_status",
        entity_type="application",
        entity_id=application_id,
        action_detail=f"status={status}",
    )

    return ok_response(
        trace_id=trace_id,
        req=req,
        data={"application_id": application_id, "status": status},
    )
