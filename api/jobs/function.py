import os
import sys

import azure.functions as func

script_dir = os.path.dirname(os.path.abspath(__file__))
shared_path = os.path.join(script_dir, "..", "shared")
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

from core.api_contract import get_trace_id, ok_response, options_response
from persistence.careers_store import get_careers_store


async def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = get_trace_id(req)
    if req.method == "OPTIONS":
        return options_response(trace_id=trace_id, req=req)

    store = get_careers_store()
    jobs = store.list_active_jobs() if store.is_available else []

    return ok_response(
        trace_id=trace_id,
        req=req,
        data={
            "jobs": jobs,
            "count": len(jobs),
        },
    )
