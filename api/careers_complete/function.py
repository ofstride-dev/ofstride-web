import base64
import os
import sys
import logging

import azure.functions as func

script_dir = os.path.dirname(os.path.abspath(__file__))
shared_path = os.path.join(script_dir, "..", "shared")
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

from core.api_contract import error_response, get_trace_id, ok_response, options_response
from core.blob_rest import get_blob_properties, resolve_blob_config_with_reason, upload_blob
from engagement.communications import send_career_applicant_ack, send_career_hr_notification
from persistence.careers_store import get_careers_store
from security.rate_limiter import enforce_rate_limit, get_client_key

_comp_logger = logging.getLogger("ofstride.careers_complete")

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

def _get_blob_config():
    container_name = (
        (os.getenv("CAREERS_RESUME_BLOB_CONTAINER") or "").strip()
        or (os.getenv("CAREERS_BLOB_CONTAINER") or "").strip()
        or "careers-resumes"
    )
    config, diagnostics = resolve_blob_config_with_reason()
    if not config:
        return None, diagnostics
    return (config, container_name), diagnostics


def _decode_base64_content(value: str) -> bytes:
    raw = (value or "").strip()
    if not raw:
        return b""
    if raw.startswith("data:") and "," in raw:
        raw = raw.split(",", 1)[1]
    return base64.b64decode(raw)


def _upload_blob_content(config, container_name: str, blob_path: str, content_bytes: bytes, content_type: str) -> None:
    upload_blob(config, container=container_name, blob_path=blob_path, content=content_bytes, content_type=content_type)


async def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = get_trace_id(req)
    if req.method == "OPTIONS":
        return options_response(trace_id=trace_id, req=req)

    client_key = get_client_key(req.headers.get("x-forwarded-for") if req.headers else None, trace_id)
    allowed, retry_after = enforce_rate_limit(route_name="careers_complete", client_key=client_key)
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

    application_id = str(body.get("application_id", "")).strip()
    resume_content_base64 = str(body.get("resume_content_base64", "")).strip()
    if not application_id:
        return error_response(
            error_type="validation",
            message="'application_id' is required.",
            trace_id=trace_id,
            req=req,
            status_code=400,
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

    app = store.get_application_by_id(application_id=application_id)
    if not app:
        return error_response(
            error_type="validation",
            message="Application not found.",
            trace_id=trace_id,
            req=req,
            status_code=404,
        )

    if str(app.get("submission_status", "")).strip() != "draft_upload_pending":
        return error_response(
            error_type="validation",
            message="Application is not pending upload finalization.",
            trace_id=trace_id,
            req=req,
            status_code=409,
        )

    blob_path = str(app.get("resume_blob_path", "")).strip()
    blob_config, diagnostics = _get_blob_config()
    if not blob_config:
        details = {
            "CAREERS_RESUME_BLOB_CONTAINER": (os.getenv("CAREERS_RESUME_BLOB_CONTAINER") or "").strip() or None,
            "CAREERS_BLOB_CONTAINER": (os.getenv("CAREERS_BLOB_CONTAINER") or "").strip() or None,
            **(diagnostics or {}),
        }
        return error_response(
            error_type="infra",
            message="Blob storage is not configured. Set CAREERS_BLOB_CONNECTION_STRING (or AzureWebJobsStorage) and CAREERS_RESUME_BLOB_CONTAINER.",
            trace_id=trace_id,
            req=req,
            status_code=503,
            details=details,
        )
    config, container_name = blob_config

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
            _upload_blob_content(config, container_name, blob_path, resume_bytes, str(app.get("resume_content_type") or "application/octet-stream"))
        except Exception as exc:
            return error_response(
                error_type="infra",
                message="Failed to upload resume content to blob storage.",
                trace_id=trace_id,
                req=req,
                status_code=500,
                details={"reason": str(exc)},
            )

    try:
        blob_props = get_blob_properties(config, container=container_name, blob_path=blob_path)
    except Exception as exc:
        return error_response(
            error_type="validation",
            message="Uploaded resume not found in blob storage.",
            trace_id=trace_id,
            req=req,
            status_code=400,
            details={"reason": str(exc)},
        )
    if not blob_props:
        return error_response(
            error_type="validation",
            message="Uploaded resume not found in blob storage.",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )

    expected_size = int(app.get("resume_size_bytes") or 0)
    actual_size = int(blob_props.get("Content-Length") or blob_props.get("content-length") or 0)
    if expected_size != actual_size:
        return error_response(
            error_type="validation",
            message="Uploaded file size does not match the declared resume size.",
            trace_id=trace_id,
            req=req,
            status_code=400,
            details={"expected": expected_size, "actual": actual_size},
        )

    actual_content_type = str(blob_props.get("Content-Type") or blob_props.get("content-type") or "").lower().strip()
    expected_content_type = str(app.get("resume_content_type") or "").lower().strip()
    if expected_content_type not in ALLOWED_CONTENT_TYPES or actual_content_type != expected_content_type:
        return error_response(
            error_type="validation",
            message="Uploaded file content type is invalid.",
            trace_id=trace_id,
            req=req,
            status_code=400,
            details={"expected": expected_content_type, "actual": actual_content_type},
        )

    finalized = store.finalize_submission(application_id=application_id)
    if not finalized:
        return error_response(
            error_type="infra",
            message="Could not finalize application submission.",
            trace_id=trace_id,
            req=req,
            status_code=500,
        )

    app_after = store.get_application_by_id(application_id=application_id) or {}
    job = store.get_job_by_id(job_id=str(app_after.get("job_id") or "")) or {}
    hr_email = (os.getenv("CAREERS_HR_EMAIL") or "hr@ofstrideservices.com").strip()
    candidate_name = str(app_after.get("full_name") or "")
    applicant_email = str(app_after.get("email") or "").strip().lower()
    job_title = str(job.get("title") or "")
    reference_id = str(finalized.get("reference_id") or "")
    submitted_at = str(app_after.get("submitted_at") or "")

    hr_sent, hr_error = send_career_hr_notification(
        to_address=hr_email,
        candidate_name=candidate_name,
        applicant_email=applicant_email,
        job_title=job_title,
        reference_id=reference_id,
        application_id=application_id,
        submitted_at=submitted_at,
    )
    if hr_sent:
        store.mark_hr_email_sent(application_id=application_id)

    applicant_sent, applicant_error = send_career_applicant_ack(
        to_address=applicant_email,
        candidate_name=candidate_name,
        job_title=job_title,
        reference_id=reference_id,
    )

    return ok_response(
        trace_id=trace_id,
        req=req,
        data={
            **finalized,
            "applicant_notification": {
                "sent": applicant_sent,
                "error": applicant_error,
            },
            "hr_notification": {
                "sent": hr_sent,
                "error": hr_error,
            },
        },
    )