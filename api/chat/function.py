import azure.functions as func
import os
import sys


script_dir = os.path.dirname(os.path.abspath(__file__))
shared_path = os.path.join(script_dir, '..', 'shared')
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

from core.api_contract import error_response, get_trace_id, ok_response, options_response
from orchestration.graph import RAGGraph
from security.rate_limiter import enforce_rate_limit, get_client_key


async def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = get_trace_id(req)
    if req.method == "OPTIONS":
        return options_response(trace_id=trace_id, req=req)

    client_key = get_client_key(req.headers.get("x-forwarded-for") if req.headers else None, trace_id)
    allowed, retry_after = enforce_rate_limit(route_name="chat", client_key=client_key)
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

    message = str(body.get("message", "")).strip() if isinstance(body, dict) else ""
    session_id = str(body.get("session_id", "")).strip() if isinstance(body, dict) else ""
    if not message or not session_id:
        return error_response(
            error_type="validation",
            message="Both 'message' and 'session_id' are required.",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )

    try:
        graph = RAGGraph()
        response = await graph.run(query=message, session_id=session_id)
        return ok_response(trace_id=trace_id, data=response, req=req)
    except Exception as exc:
        return error_response(
            error_type="infra",
            message="Chat processing failed.",
            trace_id=trace_id,
            req=req,
            status_code=500,
            details={"reason": str(exc)},
        )
