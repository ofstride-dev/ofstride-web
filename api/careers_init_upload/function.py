import base64
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import azure.functions as func

script_dir = os.path.dirname(os.path.abspath(__file__))
shared_path = os.path.join(script_dir, "..", "shared")
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

from core.api_contract import error_response, get_trace_id, ok_response, options_response
from core.blob_rest import blob_config_from_connection_string, blob_url, resolve_blob_connection_string, upload_blob
from persistence.careers_store import get_careers_store
from security.rate_limiter import enforce_rate_limit, get_client_key

import logging as _lg
_init_logger = _lg.getLogger("ofstride.careers_init_upload")


MAX_RESUME_BYTES = 5 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
ALLOWED_EXTENSIONS = {".pdf", ".docx"}


def _parse_connection_string(raw: str) -> dict[str, str]:
    parts: dict[str, str] = {}
    for token in raw.split(";"):
        if not token or "=" not in token:
            continue
        key, value = token.split("=", 1)
        parts[key.strip()] = value.strip()
    return parts


def _get_blob_config() -> tuple | None:
    connection_string = resolve_blob_connection_string()
    container_name = (
        (os.getenv("CAREERS_RESUME_BLOB_CONTAINER") or "").strip()
        or (os.getenv("CAREERS_BLOB_CONTAINER") or "").strip()
        or "careers-resumes"
    )
    config = blob_config_from_connection_string(connection_string)
    if not config:
        return None
    return config, container_name


def _decode_base64_content(value: str) -> bytes:
    raw = (value or "").strip()
    if not raw:
        return b""
    if raw.startswith("data:") and "," in raw:
        raw = raw.split(",", 1)[1]
    return base64.b64decode(raw)


def _content_type_for_resume(file_name: str, content_type: str) -> str:
    normalized = (content_type or "").strip().lower()
    ext = _extract_extension(file_name)
    if normalized in ALLOWED_CONTENT_TYPES:
        return normalized
    if ext == ".pdf":
        return "application/pdf"
    if ext == ".docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return normalized or "application/octet-stream"


def _upload_bytes_to_blob(config, container_name: str, blob_path: str, content_bytes: bytes, content_type: str) -> None:
    upload_blob(config, container=container_name, blob_path=blob_path, content=content_bytes, content_type=content_type)


def _extract_extension(filename: str) -> str:
    return Path(filename or "").suffix.lower().strip()


async def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = get_trace_id(req)
    if req.method == "OPTIONS":
        return options_response(trace_id=trace_id, req=req)

    client_key = get_client_key(req.headers.get("x-forwarded-for") if req.headers else None, trace_id)
    allowed, retry_after = enforce_rate_limit(route_name="careers_init_upload", client_key=client_key)
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

    if not isinstance(body, dict):
        return error_response(
            error_type="validation",
            message="Request body must be a JSON object.",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )

    job_id = str(body.get("job_id", "")).strip()
    full_name = str(body.get("full_name", "")).strip()
    email = str(body.get("email", "")).strip().lower()
    phone = str(body.get("phone", "")).strip() or None
    linkedin_url = str(body.get("linkedin_url", "")).strip() or None
    cover_note = str(body.get("cover_note", "")).strip() or None

    years_experience_raw = body.get("years_experience")
    years_experience = None
    if years_experience_raw not in (None, ""):
        try:
            years_experience = float(years_experience_raw)
        except (TypeError, ValueError):
            return error_response(
                error_type="validation",
                message="'years_experience' must be a number when provided.",
                trace_id=trace_id,
                req=req,
                status_code=400,
            )

    consent_accepted = bool(body.get("consent_accepted", False))
    resume_original_name = str(body.get("resume_original_name", "")).strip()
    resume_content_type = str(body.get("resume_content_type", "")).strip().lower()
    resume_size_bytes = body.get("resume_size_bytes")
    resume_content_base64 = str(body.get("resume_content_base64", "")).strip()

    if not job_id or not full_name or not email or not resume_original_name:
        return error_response(
            error_type="validation",
            message="'job_id', 'full_name', 'email', and 'resume_original_name' are required.",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )

    if not consent_accepted:
        return error_response(
            error_type="validation",
            message="Consent is required to submit an application.",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )

    try:
        resume_size_bytes = int(resume_size_bytes)
    except (TypeError, ValueError):
        return error_response(
            error_type="validation",
            message="'resume_size_bytes' must be a valid integer.",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )

    if resume_size_bytes <= 0 or resume_size_bytes > MAX_RESUME_BYTES:
        return error_response(
            error_type="validation",
            message="Resume size exceeds allowed limit (5 MB).",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )

    extension = _extract_extension(resume_original_name)
    resume_content_type = _content_type_for_resume(resume_original_name, resume_content_type)
    if extension not in ALLOWED_EXTENSIONS or resume_content_type not in ALLOWED_CONTENT_TYPES:
        return error_response(
            error_type="validation",
            message="Only PDF and DOCX resumes are allowed.",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )

    blob_config = _get_blob_config()
    if not blob_config:
        details = {
            "CAREERS_BLOB_CONNECTION_STRING_set": bool((os.getenv("CAREERS_BLOB_CONNECTION_STRING") or "").strip()),
            "AzureWebJobsStorage_set": bool((os.getenv("AzureWebJobsStorage") or "").strip()),
            "CAREERS_RESUME_BLOB_CONTAINER": (os.getenv("CAREERS_RESUME_BLOB_CONTAINER") or "").strip() or None,
            "CAREERS_BLOB_CONTAINER": (os.getenv("CAREERS_BLOB_CONTAINER") or "").strip() or None,
        }
        return error_response(
            error_type="infra",
            message="Blob storage is not configured. Set CAREERS_BLOB_CONNECTION_STRING (or AzureWebJobsStorage) and CAREERS_RESUME_BLOB_CONTAINER.",
            trace_id=trace_id,
            req=req,
            status_code=503,
            details=details,
        )

    store = get_careers_store()
    if not store.is_available:
        return error_response(
            error_type="infra",
            message="Careers store is unavailable.",
            trace_id=trace_id,
            req=req,
            status_code=503,
        )

    # ── Store calls wrapped in try/except for structured error responses ──

    try:
        active_job = store.get_active_job(job_id=job_id)
    except Exception as exc:
        return error_response(
            error_type="infra",
            message="Failed to verify job status.",
            trace_id=trace_id,
            req=req,
            status_code=500,
            details={"reason": str(exc)},
        )

    if not active_job:
        return error_response(
            error_type="validation",
            message="Job not found or not active.",
            trace_id=trace_id,
            req=req,
            status_code=404,
        )

    try:
        is_duplicate = store.has_recent_duplicate_application(job_id=job_id, email=email, window_days=30)
    except Exception as exc:
        return error_response(
            error_type="infra",
            message="Failed to check for duplicate application.",
            trace_id=trace_id,
            req=req,
            status_code=500,
            details={"reason": str(exc)},
        )

    if is_duplicate:
        return error_response(
            error_type="validation",
            message="An application for this job was already submitted in the last 30 days.",
            trace_id=trace_id,
            req=req,
            status_code=409,
            details={"code": "duplicate_application_window"},
        )

    application_id = f"app_{uuid.uuid4().hex}"
    reference_id = f"OFS-{datetime.now(timezone.utc):%Y%m%d}-{uuid.uuid4().hex[:6].upper()}"
    blob_path = f"resumes/{job_id}/{application_id}{extension}"

    try:
        created = store.create_application_draft(
            application_id=application_id,
            reference_id=reference_id,
            job_id=job_id,
            full_name=full_name,
            email=email,
            phone=phone,
            linkedin_url=linkedin_url,
            years_experience=years_experience,
            cover_note=cover_note,
            consent_accepted=consent_accepted,
            resume_blob_path=blob_path,
            resume_original_name=resume_original_name,
            resume_content_type=resume_content_type,
            resume_size_bytes=resume_size_bytes,
        )
    except Exception as exc:
        return error_response(
            error_type="infra",
            message="Failed to create application draft due to a store error.",
            trace_id=trace_id,
            req=req,
            status_code=500,
            details={"reason": str(exc)},
        )

    if not created:
        return error_response(
            error_type="infra",
            message="Failed to create application draft.",
            trace_id=trace_id,
            req=req,
            status_code=500,
        )

    config, container_name = blob_config

    uploaded = False
    if resume_content_base64:
        try:
            resume_bytes = _decode_base64_content(resume_content_base64)
        except Exception as exc:
            return error_response(
                error_type="validation",
                message="Resume file content is not valid base64.",
                trace_id=trace_id,
                req=req,
                status_code=400,
                details={"reason": str(exc)},
            )
        if not resume_bytes:
            return error_response(
                error_type="validation",
                message="Resume file content is empty.",
                trace_id=trace_id,
                req=req,
                status_code=400,
            )
        try:
            _upload_bytes_to_blob(config, container_name, blob_path, resume_bytes, resume_content_type)
            uploaded = True
        except Exception as exc:
            return error_response(
                error_type="infra",
                message="Failed to upload resume content to blob storage.",
                trace_id=trace_id,
                req=req,
                status_code=500,
                details={"reason": str(exc)},
            )

    if uploaded:
        upload_url = ""
        expires_in_seconds = 0
    else:
        upload_url = blob_url(config, container_name, blob_path=blob_path)
        expires_in_seconds = 3600

    return ok_response(
        trace_id=trace_id,
        req=req,
        data={
            "application_id": created["application_id"],
            "reference_id": created["reference_id"],
            "upload": {
                "method": "PUT",
                "url": upload_url,
                "expires_in_seconds": expires_in_seconds,
                "uploaded": uploaded,
                "required_headers": {
                    "x-ms-blob-type": "BlockBlob",
                    "Content-Type": resume_content_type,
                },
            },
        },
    )