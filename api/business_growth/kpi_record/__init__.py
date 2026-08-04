import azure.functions as func
from datetime import datetime, timezone

from business_growth.shared.http import error_response, json_response, options_response

def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response(req)

    try:
        body = req.get_json()
    except Exception:
        return error_response(req, "Invalid JSON", status_code=400)

    if not isinstance(body, dict):
        return error_response(req, "Payload must be an object", status_code=400)

    return json_response(
        req,
        {
            "status": "accepted",
            "received_at": datetime.now(timezone.utc).isoformat(),
            "payload": body,
        },
    )