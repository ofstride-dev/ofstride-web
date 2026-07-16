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
    try:
        from azure.storage.blob import BlobServiceClient  # lazy import
    except ImportError as exc:
        _init_logger.error(
            "Blob SDK import failed -- sys.path[0:3]=%s AZ_ENV=%s",
            sys.path[:3] if hasattr(sys, 'path') else 'N/A',
            os.getenv("AZURE_FUNCTIONS_ENVIRONMENT", "local"),
        )
        raise RuntimeError(
            "azure-storage-blob SDK is not installed in the deployment. "
            "Ensure requirements.txt is built during deployment."
        ) from exc
    connection_string = (os.getenv("CAREERS_BLOB_CONNECTION_STRING") or "").strip()
    container_name = (
        (os.getenv("CAREERS_RESUME_BLOB_CONTAINER") or "").strip()
        or (os.getenv("CAREERS_BLOB_CONTAINER") or "").strip()
        or "careers-resumes"
    )
    if not connection_string:
        return None

    parsed = _parse_connection_string(connection_string)
    account_name = parsed.get("AccountName", "")
    account_key = parsed.get("AccountKey")
    shared_sas = parsed.get("SharedAccessSignature")
    if not account_name:
        return None
    if not account_key and not shared_sas:
        return None

    service = BlobServiceClient.from_connection_string(connection_string)
    return service, container_name, account_name, account_key, shared_sas


def _ensure_container(service, container_name: str) -> None:
    try:
        container_client = service.get_container_client(container_name)
        container_client.create_container()
    except Exception:
        pass


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


def _upload_bytes_to_blob(service, container_name: str, blob_path: str, content_bytes: bytes, content_type: str) -> None:
    from azure.storage.blob import ContentSettings

    _ensure_container(service, container_name)
    blob_client = service.get_blob_client(container=container_name, blob=blob_path)
    blob_client.upload_blob(content_bytes, overwrite=True, content_settings=ContentSettings(content_type=content_type))


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

    try:
        blob_config = _get_blob_config()
    except Exception as exc:
        return error_response(
            error_type="infra",
            message="Blob storage SDK is unavailable in the deployment.",
            trace_id=trace_id,
            req=req,
            status_code=503,
            details={"reason": str(exc)},
        )
    if not blob_config:
        return error_response(
            error_type="infra",
            message="Blob storage is not configured. Set CAREERS_BLOB_CONNECTION_STRING and CAREERS_RESUME_BLOB_CONTAINER.",
            trace_id=trace_id,
            req=req,
            status_code=503,
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

    service_client, container_name, account_name, account_key, shared_sas = blob_config
    container_client = service_client.get_container_client(container_name)
    try:
        container_client.create_container()
    except Exception:
        # Container likely already exists; ignore creation errors for idempotency.
        pass

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
            _upload_bytes_to_blob(service_client, container_name, blob_path, resume_bytes, resume_content_type)
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

    if account_key:
        from azure.storage.blob import BlobSasPermissions, generate_blob_sas  # lazy import
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        sas_token = generate_blob_sas(
            account_name=account_name,
            container_name=container_name,
            blob_name=blob_path,
            account_key=account_key,
            permission=BlobSasPermissions(write=True, create=True),
            expiry=expires_at,
            content_type=resume_content_type,
        )
        expires_in_seconds = 600
    else:
        sas_token = str(shared_sas or "").lstrip("?")
        expires_in_seconds = 3600

    upload_url = f"{service_client.primary_endpoint}/{container_name}/{blob_path}?{sas_token}"

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