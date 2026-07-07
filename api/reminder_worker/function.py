import os
import sys

import azure.functions as func

script_dir = os.path.dirname(os.path.abspath(__file__))
shared_path = os.path.join(script_dir, "..", "shared")
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

from core.api_contract import error_response, get_trace_id, ok_response, options_response
from engagement.reminder_worker import get_reminder_worker
from security.rate_limiter import enforce_rate_limit, get_client_key


async def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = get_trace_id(req)
    if req.method == "OPTIONS":
        return options_response(trace_id=trace_id, req=req)

    client_key = get_client_key(req.headers.get("x-forwarded-for") if req.headers else None, trace_id)
    allowed, retry_after = enforce_rate_limit(route_name="reminders_process", client_key=client_key)
    if not allowed:
        return error_response(
            error_type="infra",
            message="Rate limit exceeded. Please retry shortly.",
            trace_id=trace_id,
            req=req,
            status_code=429,
            details={"retry_after_seconds": retry_after},
            headers={"Retry-After": str(retry_after)},
        )

    limit_raw = req.params.get("limit", "")
    try:
        limit = int(limit_raw) if limit_raw else None
    except ValueError:
        return error_response(
            error_type="validation",
            message="Query parameter 'limit' must be an integer.",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )

    try:
        result = get_reminder_worker().process_due_reminders(limit=limit)
        return ok_response(trace_id=trace_id, req=req, data=result)
    except Exception as exc:
        return error_response(
            error_type="infra",
            message="Failed to process due reminders.",
            trace_id=trace_id,
            req=req,
            status_code=500,
            details={"reason": str(exc)},
        )
