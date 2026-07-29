"""HTTP trigger for /api/analyze-resume.

POST  /api/analyze-resume  { job_id, candidate_ids[] }  ->  { batch_id, status }
GET   /api/analyze-resume?batch_id=xxx     ->  { status, results[] }
"""
from __future__ import annotations
import json
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from typing import Any

import azure.functions as func

script_dir = os.path.dirname(os.path.abspath(__file__))
shared_path = os.path.join(script_dir, "..", "shared")
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

from core.api_contract import error_response, get_trace_id, ok_response, options_response
from persistence.careers_store import get_careers_store

# Lazy-import the pipeline (avoids circular import at cold-start)
_pipeline = None

_logger = logging.getLogger("ofstride.analyze_resume")


def _get_pipeline():
    global _pipeline
    if _pipeline is None:
        from pipeline.orchestrator import run_pipeline  # type: ignore
        _pipeline = run_pipeline
    return _pipeline


async def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = get_trace_id(req)
    if req.method == "OPTIONS":
        return options_response(trace_id=trace_id, req=req)

    # ── GET: status polling ────────────────────────────────────────────
    if req.method == "GET":
        batch_id = str(req.params.get("batch_id") or "").strip()
        if not batch_id:
            return error_response(
                error_type="validation",
                message="Query parameter 'batch_id' is required.",
                trace_id=trace_id, req=req, status_code=400,
            )
        store = get_careers_store()
        batch = store.get_analysis_batch(batch_id=batch_id) if hasattr(store, "get_analysis_batch") else None
        if not batch:
            return error_response(
                error_type="not_found",
                message="Analysis batch not found.",
                trace_id=trace_id, req=req, status_code=404,
            )
        return ok_response(trace_id=trace_id, req=req, data=batch)

    # ── POST: start analysis ───────────────────────────────────────────
    if req.method == "POST":
        try:
            body = req.get_json()
        except ValueError:
            return error_response(
                error_type="validation",
                message="Request body must be valid JSON.",
                trace_id=trace_id, req=req, status_code=400,
            )

        if not isinstance(body, dict):
            return error_response(
                error_type="validation",
                message="Request body must be a JSON object.",
                trace_id=trace_id, req=req, status_code=400,
            )

        job_id = str(body.get("job_id") or "").strip()
        candidate_ids = body.get("candidate_ids", [])
        if not isinstance(candidate_ids, list):
            candidate_ids = [candidate_ids]
        candidate_ids = [str(c).strip() for c in candidate_ids if str(c).strip()]

        if not job_id or not candidate_ids:
            return error_response(
                error_type="validation",
                message="'job_id' and 'candidate_ids' are required.",
                trace_id=trace_id, req=req, status_code=400,
            )

        store = get_careers_store()
        job = store.get_job_by_id(job_id=job_id) if hasattr(store, "get_job_by_id") else {}
        if not job:
            return error_response(
                error_type="not_found",
                message="Job not found.",
                trace_id=trace_id, req=req, status_code=404,
            )

        batch_id = f"batch_{uuid.uuid4().hex}"
        jd_text = str(job.get("jd_markdown") or job.get("jd_raw_text") or "")
        results: list[dict[str, Any]] = []

        pipeline = _get_pipeline()

        for cid in candidate_ids:
            candidate = store.get_application_by_id(application_id=cid) if hasattr(store, "get_application_by_id") else {}
            if not candidate:
                results.append({"candidate_id": cid, "status": "error", "error": "Candidate not found"})
                continue
            resume_text = str(candidate.get("resume_excerpt") or candidate.get("cover_note") or "")
            if not resume_text:
                results.append({"candidate_id": cid, "status": "error", "error": "No resume text available"})
                continue
            try:
                analysis = await pipeline(
                    jd_text=jd_text,
                    resume_text=resume_text,
                    job_title=str(job.get("title", "")),
                    department=str(job.get("department", "")),
                )
                results.append({"candidate_id": cid, "status": "completed", "analysis": analysis})
            except Exception as exc:
                _logger.exception("Pipeline failed for candidate %s", cid)
                results.append({"candidate_id": cid, "status": "error", "error": str(exc)})

        return ok_response(
            trace_id=trace_id,
            req=req,
            data={
                "batch_id": batch_id,
                "status": "completed",
                "total": len(candidate_ids),
                "completed": sum(1 for r in results if r["status"] == "completed"),
                "errors": sum(1 for r in results if r["status"] == "error"),
                "results": results,
            },
        )

    return error_response(
        error_type="validation",
        message=f"Method {req.method} not allowed.",
        trace_id=trace_id, req=req, status_code=405,
    )
