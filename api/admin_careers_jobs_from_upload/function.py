import os
import sys

import azure.functions as func
from azure.storage.blob import BlobServiceClient

script_dir = os.path.dirname(os.path.abspath(__file__))
shared_path = os.path.join(script_dir, "..", "shared")
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

from core.api_contract import error_response, get_trace_id, ok_response, options_response
from persistence.careers_store import get_careers_store
from security.admin_auth import AdminAuthError, require_admin

ALLOWED_JOB_STATUSES = {"draft", "active", "archived"}


def _blob_service() -> BlobServiceClient | None:
    conn = (os.getenv("CAREERS_BLOB_CONNECTION_STRING") or "").strip()
    if not conn:
        return None
    return BlobServiceClient.from_connection_string(conn)


async def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = get_trace_id(req)
    if req.method == "OPTIONS":
        return options_response(trace_id=trace_id, req=req)

    try:
        admin = require_admin(req)
    except AdminAuthError as exc:
        return error_response(error_type="validation", message=str(exc), trace_id=trace_id, req=req, status_code=401)

    try:
        body = req.get_json()
    except ValueError:
        return error_response(error_type="validation", message="Request body must be valid JSON.", trace_id=trace_id, req=req, status_code=400)

    if not isinstance(body, dict):
        return error_response(error_type="validation", message="Request body must be a JSON object.", trace_id=trace_id, req=req, status_code=400)

    title = str(body.get("title", "")).strip()
    blob_path = str(body.get("blob_path", "")).strip()
    container = str(body.get("blob_container", "")).strip() or (os.getenv("CAREERS_JD_BLOB_CONTAINER") or "careers-jd").strip()
    status = str(body.get("status", "draft")).strip().lower()

    if not title or not blob_path:
        return error_response(error_type="validation", message="title and blob_path are required.", trace_id=trace_id, req=req, status_code=400)
    if status not in ALLOWED_JOB_STATUSES:
        return error_response(error_type="validation", message="status must be one of: draft, active, archived", trace_id=trace_id, req=req, status_code=400)

    service = _blob_service()
    if not service:
        return error_response(error_type="infra", message="Blob storage is not configured.", trace_id=trace_id, req=req, status_code=503)

    try:
        blob_client = service.get_blob_client(container=container, blob=blob_path)
        content = blob_client.download_blob().readall()
        jd_text = content.decode("utf-8")
    except Exception as exc:
        return error_response(error_type="infra", message="Unable to read uploaded JD file from storage.", trace_id=trace_id, req=req, status_code=400, details={"reason": str(exc)})

    store = get_careers_store()
    if not store.is_available:
        return error_response(error_type="infra", message="Careers store unavailable.", trace_id=trace_id, req=req, status_code=503)

    saved = store.upsert_job(
        job_id=str(body.get("id", "")).strip() or None,
        title=title,
        department=str(body.get("department", "")).strip() or None,
        location=str(body.get("location", "")).strip() or None,
        employment_type=str(body.get("employment_type", "")).strip() or None,
        jd_markdown=jd_text,
        jd_raw_text=jd_text,
        jd_blob_path=blob_path,
        jd_blob_container=container,
        status=status,
        created_by=admin.get("user_name"),
    )
    if not saved:
        return error_response(error_type="infra", message="Failed to publish uploaded JD.", trace_id=trace_id, req=req, status_code=500)

    store.log_admin_action(
        admin_user_id=admin["user_id"],
        action_type="publish_job_from_upload",
        entity_type="job",
        entity_id=str(saved.get("id") or ""),
        action_detail=f"container={container};path={blob_path};status={status}",
    )

    return ok_response(trace_id=trace_id, req=req, data=saved)
