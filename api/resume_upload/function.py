import base64
import os
import sys
import uuid
from pathlib import Path

import azure.functions as func

script_dir = os.path.dirname(os.path.abspath(__file__))
shared_path = os.path.join(script_dir, "..", "shared")
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

from core.api_contract import error_response, get_trace_id, ok_response, options_response
from core.blob_rest import resolve_blob_config_with_reason, upload_blob


MAX_RESUME_BYTES = 5 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
ALLOWED_EXTENSIONS = {".pdf", ".docx"}


def _extract_extension(filename: str) -> str:
    return Path(filename or "").suffix.lower().strip()


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


def _decode_base64_content(value: str) -> bytes:
    raw = (value or "").strip()
    if not raw:
        return b""
    if raw.startswith("data:") and "," in raw:
        raw = raw.split(",", 1)[1]
    return base64.b64decode(raw)


async def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = get_trace_id(req)
    if req.method == "OPTIONS":
        return options_response(trace_id=trace_id, req=req)

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

    file_name = str(body.get("file_name", "")).strip()
    file_content_base64 = str(body.get("file_content_base64", "")).strip()
    content_type = str(body.get("content_type", "")).strip().lower()

    if not file_name or not file_content_base64:
        return error_response(
            error_type="validation",
            message="'file_name' and 'file_content_base64' are required.",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )

    extension = _extract_extension(file_name)
    content_type = _content_type_for_resume(file_name, content_type)
    
    if extension not in ALLOWED_EXTENSIONS or content_type not in ALLOWED_CONTENT_TYPES:
        return error_response(
            error_type="validation",
            message="Only PDF and DOCX resumes are allowed.",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )

    try:
        file_content = _decode_base64_content(file_content_base64)
    except Exception as exc:
        return error_response(
            error_type="validation",
            message="Invalid base64 content.",
            trace_id=trace_id,
            req=req,
            status_code=400,
            details={"reason": str(exc)},
        )

    if len(file_content) <= 0 or len(file_content) > MAX_RESUME_BYTES:
        return error_response(
            error_type="validation",
            message="Resume size exceeds allowed limit (5 MB).",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )

    # Resolve blob config with diagnostics
    blob_config, diagnostics = resolve_blob_config_with_reason()
    if not blob_config:
        details = {
            "CAREERS_BLOB_CONNECTION_STRING_set": diagnostics.get("CAREERS_BLOB_CONNECTION_STRING_set"),
            "AzureWebJobsStorage_set": diagnostics.get("AzureWebJobsStorage_set"),
            "config_reason": diagnostics.get("config_reason"),
        }
        return error_response(
            error_type="infra",
            message="Blob storage is not configured.",
            trace_id=trace_id,
            req=req,
            status_code=503,
            details=details,
        )

    # Upload to blob storage with unique filename
    blob_path = f"resumes/{uuid.uuid4()}{extension}"
    container_name = "carers-blob-container"

    try:
        upload_blob(
            blob_config,
            container=container_name,
            blob_path=blob_path,
            content=file_content,
            content_type=content_type,
        )
    except Exception as exc:
        return error_response(
            error_type="infra",
            message="Failed to upload resume to blob storage.",
            trace_id=trace_id,
            req=req,
            status_code=500,
            details={"reason": str(exc)},
        )

    return ok_response(
        data={"uploaded": True},
        trace_id=trace_id,
        req=req,
    )
