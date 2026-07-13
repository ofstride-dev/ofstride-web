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
        require_admin(req)
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

    store = get_careers_store()
    detail = store.get_application_detail(application_id=application_id) if store.is_available else None
    if not detail:
        return error_response(
            error_type="validation",
            message="Application not found.",
            trace_id=trace_id,
            req=req,
            status_code=404,
        )

    return ok_response(trace_id=trace_id, req=req, data=detail)
