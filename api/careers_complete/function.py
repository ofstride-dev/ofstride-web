import os
import sys
import json
from urllib import error as url_error
from urllib import request as url_request

import azure.functions as func

script_dir = os.path.dirname(os.path.abspath(__file__))
shared_path = os.path.join(script_dir, "..", "shared")
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

from core.api_contract import error_response, get_trace_id, ok_response, options_response
from persistence.careers_store import get_careers_store
from security.rate_limiter import enforce_rate_limit, get_client_key

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _hr_webhook_target() -> str | None:
    return (
        (os.getenv("CONTACT_WEBHOOK_URL") or "").strip()
        or (os.getenv("MAKE_WEBHOOK_CHAT_URL") or "").strip()
        or (os.getenv("CAREERS_HR_WEBHOOK_URL") or "").strip()
    )


def _send_hr_notification(payload: dict[str, object]) -> tuple[bool, str | None]:
    target = _hr_webhook_target()
    if not target:
        return False, "hr_webhook_not_configured"

    body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
    req = url_request.Request(
        target,
        data=body,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )

    try:
        with url_request.urlopen(req, timeout=8) as response:
            if 200 <= response.status < 300:
                return True, None
            return False, f"hr_webhook_http_{response.status}"
    except (url_error.HTTPError, url_error.URLError, TimeoutError) as exc:
        return False, str(exc)


def _get_blob_client(blob_path: str):
    from azure.storage.blob import BlobServiceClient  # lazy import
    connection_string = (os.getenv("CAREERS_BLOB_CONNECTION_STRING") or "").strip()
    container_name = (os.getenv("CAREERS_BLOB_CONTAINER") or "resumes").strip()
    if not connection_string:
        return None

    service = BlobServiceClient.from_connection_string(connection_string)
    return service.get_blob_client(container=container_name, blob=blob_path)


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
    blob_client = _get_blob_client(blob_path)
    if not blob_client:
        return error_response(
            error_type="infra",
            message="Blob storage is not configured. Set CAREERS_BLOB_CONNECTION_STRING and CAREERS_BLOB_CONTAINER.",
            trace_id=trace_id,
            req=req,
            status_code=503,
        )

    try:
        blob_props = blob_client.get_blob_properties()
    except Exception as exc:
        return error_response(
            error_type="validation",
            message="Uploaded resume not found in blob storage.",
            trace_id=trace_id,
            req=req,
            status_code=400,
            details={"reason": str(exc)},
        )

    expected_size = int(app.get("resume_size_bytes") or 0)
    actual_size = int(getattr(blob_props, "size", 0) or 0)
    if expected_size != actual_size:
        return error_response(
            error_type="validation",
            message="Uploaded file size does not match the declared resume size.",
            trace_id=trace_id,
            req=req,
            status_code=400,
            details={"expected": expected_size, "actual": actual_size},
        )

    actual_content_type = str((blob_props.content_settings.content_type or "")).lower().strip()
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
    hr_payload = {
        "type": "career_application_received",
        "source": "ofstride-website",
        "submitted_at": str(app_after.get("submitted_at") or ""),
        "notify_support_email": hr_email,
        "application_id": application_id,
        "reference_id": str(finalized.get("reference_id") or ""),
        "job_id": str(app_after.get("job_id") or ""),
        "job_title": str(job.get("title") or ""),
        "applicant_email": str(app_after.get("email") or ""),
    }

    hr_sent, hr_error = _send_hr_notification(hr_payload)
    if hr_sent:
        store.mark_hr_email_sent(application_id=application_id)

    return ok_response(
        trace_id=trace_id,
        req=req,
        data={
            **finalized,
            "hr_notification": {
                "sent": hr_sent,
                "error": hr_error,
            },
        },
    )
