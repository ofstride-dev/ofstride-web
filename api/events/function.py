import os
import sys

import azure.functions as func

script_dir = os.path.dirname(os.path.abspath(__file__))
shared_path = os.path.join(script_dir, "..", "shared")
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

from core.api_contract import error_response, get_trace_id, ok_response, options_response
from engagement.event_service import ALLOWED_EVENT_TYPES, get_chat_event_service
from security.rate_limiter import enforce_rate_limit, get_client_key


def _validate_payload(body: object) -> tuple[str, str, dict] | None:
    if not isinstance(body, dict):
        return None

    event_type = str(body.get("event_type", "")).strip()
    session_id = str(body.get("session_id", "")).strip()
    payload = body.get("payload") or {}

    if not event_type or not session_id:
        return None

    if not isinstance(payload, dict):
        return None

    return event_type, session_id, payload


async def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = get_trace_id(req)
    if req.method == "OPTIONS":
        return options_response(trace_id=trace_id, req=req)

    client_key = get_client_key(req.headers.get("x-forwarded-for") if req.headers else None, trace_id)
    allowed, retry_after = enforce_rate_limit(route_name="events", client_key=client_key)
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

    validated = _validate_payload(body)
    if not validated:
        return error_response(
            error_type="validation",
            message="event_type, session_id, and payload object are required.",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )

    event_type, session_id, payload = validated

    if event_type not in ALLOWED_EVENT_TYPES:
        return error_response(
            error_type="validation",
            message="Unsupported event_type.",
            trace_id=trace_id,
            req=req,
            status_code=400,
            details={"allowed_event_types": sorted(ALLOWED_EVENT_TYPES)},
        )

    try:
        result = get_chat_event_service().record_event(
            event_type=event_type,
            session_id=session_id,
            payload=payload,
            trace_id=trace_id,
        )
        return ok_response(trace_id=trace_id, data=result, req=req, status_code=202)
    except ValueError as exc:
        return error_response(
            error_type="validation",
            message=str(exc),
            trace_id=trace_id,
            req=req,
            status_code=400,
        )
    except Exception as exc:
        return error_response(
            error_type="infra",
            message="Failed to capture event.",
            trace_id=trace_id,
            req=req,
            status_code=500,
            details={"reason": str(exc)},
        )
