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

    try:
        body = req.get_json()
    except ValueError:
        body = {}

    older_than_hours = 24
    if isinstance(body, dict) and body.get("older_than_hours") is not None:
        try:
            older_than_hours = int(body.get("older_than_hours"))
        except (TypeError, ValueError):
            older_than_hours = 24

    store = get_careers_store()
    if not store.is_available:
        return error_response(
            error_type="infra",
            message="Careers store unavailable.",
            trace_id=trace_id,
            req=req,
            status_code=503,
        )

    updated = store.mark_stale_drafts_upload_failed(older_than_hours=older_than_hours)
    store.log_admin_action(
        admin_user_id=admin["user_id"],
        action_type="cleanup_stale_drafts",
        entity_type="application",
        entity_id="bulk",
        action_detail=f"older_than_hours={older_than_hours};updated={updated}",
    )

    return ok_response(
        trace_id=trace_id,
        req=req,
        data={
            "updated": updated,
            "older_than_hours": older_than_hours,
        },
    )
