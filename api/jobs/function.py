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


def _matches_filters(
    job: dict[str, object],
    *,
    query: str | None = None,
    department: str | None = None,
    location: str | None = None,
    employment_type: str | None = None,
) -> bool:
    def norm(value: object) -> str:
        return str(value or "").strip().lower()

    q = norm(query)
    if q:
        haystack = " ".join(
            [
                norm(job.get("title")),
                norm(job.get("department")),
                norm(job.get("location")),
                norm(job.get("employment_type")),
                norm(job.get("jd_markdown")),
                norm(job.get("jd_raw_text")),
            ]
        )
        if q not in haystack:
            return False

    for expected, actual in (
        (department, job.get("department")),
        (location, job.get("location")),
        (employment_type, job.get("employment_type")),
    ):
        if norm(expected) and norm(expected) != norm(actual):
            return False
    return True


async def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = get_trace_id(req)
    if req.method == "OPTIONS":
        return options_response(trace_id=trace_id, req=req)

    store = get_careers_store()
    store_type = type(store).__name__
    query = (req.params.get("q") or req.params.get("query") or "").strip() or None
    department = (req.params.get("department") or "").strip() or None
    location = (req.params.get("location") or "").strip() or None
    employment_type = (req.params.get("employment_type") or req.params.get("employmentType") or "").strip() or None
    try:
        page = max(1, int(req.params.get("page", "1")))
    except ValueError:
        page = 1
    try:
        page_size = max(1, min(50, int(req.params.get("page_size", req.params.get("pageSize", "12")))))
    except ValueError:
        page_size = 12
    _logger.info(
        "Active careers store: %s (available=%s)",
        store_type,
        store.is_available,
    )

    # Wrap in try/except so a transient Supabase error doesn't return 500 to the jobseeker
    try:
        if store.is_available:
            all_jobs = store.list_active_jobs()
        else:
            all_jobs = []
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

    departments = sorted({str(job.get("department") or "").strip() for job in all_jobs if str(job.get("department") or "").strip()}, key=lambda value: value.lower())
    locations = sorted({str(job.get("location") or "").strip() for job in all_jobs if str(job.get("location") or "").strip()}, key=lambda value: value.lower())
    employment_types = sorted({str(job.get("employment_type") or "").strip() for job in all_jobs if str(job.get("employment_type") or "").strip()}, key=lambda value: value.lower())

    jobs = [
        job
        for job in all_jobs
        if _matches_filters(
            job,
            query=query,
            department=department,
            location=location,
            employment_type=employment_type,
        )
    ]
    total_count = len(jobs)
    total_pages = max(1, (total_count + page_size - 1) // page_size)
    if page > total_pages:
        page = total_pages
    start = (page - 1) * page_size
    end = start + page_size
    page_jobs = jobs[start:end]

    return ok_response(
        trace_id=trace_id,
        req=req,
        data={
            "jobs": page_jobs,
            "count": total_count,
            "store_type": store_type,
            "store_available": store.is_available,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "total_items": total_count,
            "facets": {
                "departments": departments,
                "locations": locations,
                "employment_types": employment_types,
            },
            "filters": {
                "query": query,
                "department": department,
                "location": location,
                "employment_type": employment_type,
            },
        },
    )