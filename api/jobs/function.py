import json
import logging
import os
import sys
import traceback

import azure.functions as func

script_dir = os.path.dirname(os.path.abspath(__file__))
shared_path = os.path.join(script_dir, "..", "shared")
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

from core.api_contract import error_response, get_trace_id, ok_response, options_response
from persistence.careers_store import get_careers_store

_logger = logging.getLogger("ofstride.jobs")


async def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = get_trace_id(req)
    if req.method == "OPTIONS":
        return options_response(trace_id=trace_id, req=req)

    store = get_careers_store()
    store_type = type(store).__name__
    _logger.info(
        "Active careers store: %s (available=%s)",
        store_type,
        store.is_available,
    )

    # Wrap in try/except so a transient Supabase error doesn't return 500 to the jobseeker
    try:
        if store.is_available:
            jobs = store.list_active_jobs()
        else:
            jobs = []
            _logger.warning("Careers store unavailable — returning empty job list")
    except Exception as exc:
        tb = traceback.format_exc()
        _logger.error("list_active_jobs failed: %s\n%s", exc, tb)
        # Return empty list with error diagnostic metadata instead of failing
        return ok_response(
            trace_id=trace_id,
            req=req,
            data={
                "jobs": [],
                "count": 0,
                "store_type": store_type,
                "store_available": store.is_available,
                "store_error": str(exc),
                "note": "Job listing temporarily unavailable. Please try again later.",
            },
        )

    return ok_response(
        trace_id=trace_id,
        req=req,
        data={
            "jobs": jobs,
            "count": len(jobs),
            "store_type": store_type,
            "store_available": store.is_available,
        },
    )