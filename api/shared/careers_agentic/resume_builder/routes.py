"""HTTP route handlers for the Resume Builder (``resume-builder/*`` paths).

These are dispatched from ``api/careers_manage/function.py`` so the feature
reuses the existing careers transport (auth, CORS, envelope, blob config)
without introducing a new Function App. All handlers return the shared
``ok_response``/``error_response`` envelope.

Phase 1 surface:
  POST   resume-builder/master-resume            upload + parse a master resume
  GET    resume-builder/master-resume            list master resumes
  GET    resume-builder/master-resume/{id}       get a master resume
  POST   resume-builder/master-resume/{id}/delete  delete a master resume
  POST   resume-builder/tailor                   tailor a master resume to a JD
  GET    resume-builder/versions/{draft_id}      list tailored versions
  GET    resume-builder/versions/{draft_id}/{v}  get a tailored version
"""

from __future__ import annotations

import base64
import binascii
import logging
from typing import Any

import azure.functions as func

from core.api_contract import error_response, ok_response
from persistence.resume_builder_store import get_resume_builder_store
from .resume_parser import parse_resume_document, parse_resume_to_json
from .resume_tailor import tailor_resume_to_jd

logger = logging.getLogger("ofstride.resume_builder.routes")

MAX_RESUME_BYTES = 5 * 1024 * 1024
ALLOWED_RESUME_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".md"}


def _decode_base64_content(raw: str) -> bytes:
    cleaned = "".join(raw.split())
    try:
        return base64.b64decode(cleaned, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError(f"Invalid base64 content: {exc}") from exc


def _get_json_body(req: func.HttpRequest) -> dict[str, Any]:
    try:
        return req.get_json() or {}
    except Exception:
        return {}


async def route_resume_builder(
    req: func.HttpRequest,
    *,
    trace_id: str,
    admin: dict[str, Any],
    segments: list[str],
) -> func.HttpResponse:
    """Dispatch a resume-builder/* request to the matching handler."""
    method = req.method.upper()
    primary = segments[0] if segments else ""

    # POST resume-builder/master-resume (upload + parse)
    if method == "POST" and primary == "master-resume" and len(segments) == 1:
        return await _handle_upload_master_resume(req, trace_id, admin)

    # GET resume-builder/master-resume (list)
    if method == "GET" and primary == "master-resume" and len(segments) == 1:
        return _handle_list_master_resumes(trace_id, admin)

    # GET resume-builder/master-resume/{id}
    if method == "GET" and primary == "master-resume" and len(segments) == 2:
        return _handle_get_master_resume(trace_id, segments[1])

    # POST resume-builder/master-resume/{id}/delete
    if method == "POST" and primary == "master-resume" and len(segments) == 3 and segments[2] == "delete":
        return _handle_delete_master_resume(trace_id, admin, segments[1])

    # POST resume-builder/tailor
    if method == "POST" and primary == "tailor" and len(segments) == 1:
        return await _handle_tailor(req, trace_id, admin)

    # GET resume-builder/versions/{draft_id}
    if method == "GET" and primary == "versions" and len(segments) == 2:
        return _handle_list_versions(trace_id, segments[1])

    # GET resume-builder/versions/{draft_id}/{version_id}
    if method == "GET" and primary == "versions" and len(segments) == 3:
        return _handle_get_version(trace_id, segments[1], segments[2])

    return error_response(
        error_type="validation",
        message=f"Unknown resume-builder endpoint: {method} {'/'.join(segments)}",
        trace_id=trace_id,
        req=req,
        status_code=404,
    )


async def _handle_upload_master_resume(req: func.HttpRequest, trace_id: str, admin: dict[str, Any]) -> func.HttpResponse:
    from pathlib import Path

    body = _get_json_body(req)
    filename = str(body.get("filename") or "").strip()
    content_b64 = str(body.get("content_base64") or "").strip()
    title = str(body.get("title") or "").strip()

    if not filename or not content_b64:
        return error_response(
            error_type="validation", message="filename and content_base64 are required.",
            trace_id=trace_id, req=req, status_code=400,
        )

    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_RESUME_EXTENSIONS:
        return error_response(
            error_type="validation",
            message=f"Unsupported resume type '{suffix}'. Allowed: {sorted(ALLOWED_RESUME_EXTENSIONS)}",
            trace_id=trace_id, req=req, status_code=400,
        )

    try:
        content = _decode_base64_content(content_b64)
    except ValueError as exc:
        return error_response(error_type="validation", message=str(exc), trace_id=trace_id, req=req, status_code=400)

    if len(content) == 0:
        return error_response(error_type="validation", message="Resume file is empty.", trace_id=trace_id, req=req, status_code=400)
    if len(content) > MAX_RESUME_BYTES:
        return error_response(error_type="validation", message="Resume file exceeds 5MB limit.", trace_id=trace_id, req=req, status_code=400)

    try:
        markdown = parse_resume_document(content, filename)
        if not markdown.strip():
            return error_response(
                error_type="validation",
                message="Could not extract any text from the resume. It may be a scanned/image-only PDF.",
                trace_id=trace_id, req=req, status_code=422,
            )
        resume_data = await parse_resume_to_json(markdown)
    except ValueError as exc:
        return error_response(error_type="validation", message=str(exc), trace_id=trace_id, req=req, status_code=422)
    except Exception as exc:
        logger.exception("Resume parsing failed: %s", exc)
        return error_response(error_type="provider", message=f"Resume parsing failed: {exc}", trace_id=trace_id, req=req, status_code=502)

    if not title:
        name = (resume_data.get("personalInfo") or {}).get("name") or ""
        title = name.strip() or filename

    store = get_resume_builder_store()
    if not store.is_available:
        return error_response(error_type="infra", message="Resume builder store is unavailable.", trace_id=trace_id, req=req, status_code=503)

    try:
        draft = store.save_master_resume(
            created_by=admin.get("user_id") or admin.get("user_name"),
            title=title,
            resume_data=resume_data,
            source_filename=filename,
        )
    except Exception as exc:
        logger.exception("Saving master resume failed: %s", exc)
        return error_response(error_type="infra", message=f"Failed to save resume: {exc}", trace_id=trace_id, req=req, status_code=500)

    return ok_response(data={"draft": draft, "extracted_text_chars": len(markdown)}, trace_id=trace_id, req=req)


def _handle_list_master_resumes(trace_id: str, admin: dict[str, Any]) -> func.HttpResponse:
    store = get_resume_builder_store()
    if not store.is_available:
        return error_response(error_type="infra", message="Resume builder store is unavailable.", trace_id=trace_id, status_code=503)
    drafts = store.list_master_resumes()
    return ok_response(data={"items": drafts, "count": len(drafts), "requested_by": admin.get("user_id")}, trace_id=trace_id)


def _handle_get_master_resume(trace_id: str, draft_id: str) -> func.HttpResponse:
    store = get_resume_builder_store()
    draft = store.get_master_resume(draft_id) if store.is_available else None
    if not draft:
        return error_response(error_type="validation", message="Master resume not found.", trace_id=trace_id, status_code=404)
    return ok_response(data={"draft": draft}, trace_id=trace_id)


def _handle_delete_master_resume(trace_id: str, admin: dict[str, Any], draft_id: str) -> func.HttpResponse:
    store = get_resume_builder_store()
    if not store.is_available:
        return error_response(error_type="infra", message="Resume builder store is unavailable.", trace_id=trace_id, status_code=503)
    deleted = store.delete_master_resume(draft_id)
    return ok_response(data={"deleted": deleted, "draft_id": draft_id}, trace_id=trace_id)


async def _handle_tailor(req: func.HttpRequest, trace_id: str, admin: dict[str, Any]) -> func.HttpResponse:
    body = _get_json_body(req)
    draft_id = str(body.get("draft_id") or "").strip()
    jd_text = str(body.get("jd_text") or "").strip()

    if not draft_id or not jd_text:
        return error_response(
            error_type="validation", message="draft_id and jd_text are required.",
            trace_id=trace_id, req=req, status_code=400,
        )

    store = get_resume_builder_store()
    if not store.is_available:
        return error_response(error_type="infra", message="Resume builder store is unavailable.", trace_id=trace_id, req=req, status_code=503)

    draft = store.get_master_resume(draft_id)
    if not draft or not draft.get("resume_data"):
        return error_response(error_type="validation", message="Master resume not found.", trace_id=trace_id, req=req, status_code=404)

    try:
        result = await tailor_resume_to_jd(draft["resume_data"], jd_text)
    except Exception as exc:
        logger.exception("Resume tailoring failed: %s", exc)
        return error_response(error_type="provider", message=f"Tailoring failed: {exc}", trace_id=trace_id, req=req, status_code=502)

    try:
        version = store.save_tailored_version(
            draft_id=draft_id,
            jd_text=jd_text[:20000],
            jd_keywords=result.jd_keywords,
            tailored_resume=result.tailored_resume,
            ats_score=result.ats_score,
            applied_changes=result.applied_changes,
            skipped_changes=result.skipped_changes,
            strategy_notes=result.strategy_notes,
            ai_used=result.ai_used,
            ai_provider=result.ai_provider,
            ai_error=result.ai_error,
        )
    except Exception as exc:
        logger.exception("Saving tailored version failed: %s", exc)
        return error_response(error_type="infra", message=f"Failed to save version: {exc}", trace_id=trace_id, req=req, status_code=500)

    return ok_response(
        data={
            "version": version,
            "ats_score": result.ats_score,
            "jd_keywords": result.jd_keywords,
            "tailored_resume": result.tailored_resume,
            "applied_changes": result.applied_changes,
            "skipped_changes": result.skipped_changes,
            "strategy_notes": result.strategy_notes,
            "ai_used": result.ai_used,
            "ai_provider": result.ai_provider,
            "ai_fallback_reason": result.ai_fallback_reason,
            "ai_error": result.ai_error,
        },
        trace_id=trace_id,
        req=req,
    )


def _handle_list_versions(trace_id: str, draft_id: str) -> func.HttpResponse:
    store = get_resume_builder_store()
    if not store.is_available:
        return error_response(error_type="infra", message="Resume builder store is unavailable.", trace_id=trace_id, status_code=503)
    versions = store.list_versions(draft_id)
    # Surface overall score at top-level for list rendering.
    for v in versions:
        if isinstance(v.get("ats_score"), dict) and v["ats_score"].get("overall_score") is not None:
            v["overall_score"] = v["ats_score"]["overall_score"]
        elif v.get("overall_score") is None:
            v["overall_score"] = None
    return ok_response(data={"items": versions, "count": len(versions), "draft_id": draft_id}, trace_id=trace_id)


def _handle_get_version(trace_id: str, draft_id: str, version_id: str) -> func.HttpResponse:
    store = get_resume_builder_store()
    version = store.get_version(draft_id, version_id) if store.is_available else None
    if not version:
        return error_response(error_type="validation", message="Tailored version not found.", trace_id=trace_id, status_code=404)
    return ok_response(data={"version": version}, trace_id=trace_id)


