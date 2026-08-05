import json
import uuid

import azure.functions as func

from shared.admin_auth import validate_identity_headers


def _err(status_code: int, message: str, trace_id: str) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps({"success": False, "error": message, "trace_id": trace_id}),
        mimetype="application/json",
        status_code=status_code,
    )


def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = str(uuid.uuid4())

    auth = validate_identity_headers(req)
    if not auth.get("ok"):
        return _err(auth.get("status_code", 401), auth.get("error") or "Unauthorized", trace_id)

    return _err(
        410,
        "Legacy ledger XML export has been retired. Use bank statement reconciliation and GST compliance export.",
        trace_id,
    )
