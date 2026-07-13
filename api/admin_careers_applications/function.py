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

    status = (req.params.get("status") or "").strip() or None
    job_id = (req.params.get("job_id") or "").strip() or None
    try:
        limit = int(req.params.get("limit", "100"))
    except ValueError:
        limit = 100
    try:
        offset = int(req.params.get("offset", "0"))
    except ValueError:
        offset = 0

    store = get_careers_store()
    if not store.is_available:
        return error_response(
            error_type="infra",
            message="Careers store unavailable.",
            trace_id=trace_id,
            req=req,
            status_code=503,
        )

    rows = store.list_applications(status=status, job_id=job_id, limit=limit, offset=offset)
    return ok_response(
        trace_id=trace_id,
        req=req,
        data={
            "items": rows,
            "count": len(rows),
            "requested_by": admin["user_name"],
        },
    )
