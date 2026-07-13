import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import azure.functions as func
from azure.storage.blob import BlobSasPermissions, BlobServiceClient, generate_blob_sas

script_dir = os.path.dirname(os.path.abspath(__file__))
shared_path = os.path.join(script_dir, "..", "shared")
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

from core.api_contract import error_response, get_trace_id, ok_response, options_response
from security.admin_auth import AdminAuthError, require_admin

MAX_JD_BYTES = 2 * 1024 * 1024
ALLOWED_EXTENSIONS = {".md", ".txt"}
ALLOWED_TYPES = {"text/markdown", "text/plain"}


def _parse_connection_string(raw: str) -> dict[str, str]:
    out = {}
    for token in raw.split(";"):
        if not token or "=" not in token:
            continue
        k, v = token.split("=", 1)
        out[k.strip()] = v.strip()
    return out


def _blob_config():
    connection_string = (os.getenv("CAREERS_BLOB_CONNECTION_STRING") or "").strip()
    container_name = (os.getenv("CAREERS_JD_BLOB_CONTAINER") or "careers-jd").strip()
    if not connection_string:
        return None
    parsed = _parse_connection_string(connection_string)
    account_name = parsed.get("AccountName", "")
    account_key = parsed.get("AccountKey")
    shared_sas = parsed.get("SharedAccessSignature")
    if not account_name or (not account_key and not shared_sas):
        return None
    return BlobServiceClient.from_connection_string(connection_string), container_name, account_name, account_key, shared_sas


async def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = get_trace_id(req)
    if req.method == "OPTIONS":
        return options_response(trace_id=trace_id, req=req)

    try:
        require_admin(req)
    except AdminAuthError as exc:
        return error_response(error_type="validation", message=str(exc), trace_id=trace_id, req=req, status_code=401)

    try:
        body = req.get_json()
    except ValueError:
        return error_response(error_type="validation", message="Request body must be valid JSON.", trace_id=trace_id, req=req, status_code=400)

    if not isinstance(body, dict):
        return error_response(error_type="validation", message="Request body must be a JSON object.", trace_id=trace_id, req=req, status_code=400)

    file_name = str(body.get("file_name", "")).strip()
    content_type = str(body.get("content_type", "")).strip().lower()
    try:
        size_bytes = int(body.get("size_bytes"))
    except Exception:
        size_bytes = 0

    ext = Path(file_name).suffix.lower()
    if not file_name or ext not in ALLOWED_EXTENSIONS or content_type not in ALLOWED_TYPES:
        return error_response(error_type="validation", message="Only .md or .txt JD files are supported.", trace_id=trace_id, req=req, status_code=400)
    if size_bytes <= 0 or size_bytes > MAX_JD_BYTES:
        return error_response(error_type="validation", message="JD file must be <= 2 MB.", trace_id=trace_id, req=req, status_code=400)

    config = _blob_config()
    if not config:
        return error_response(error_type="infra", message="Blob storage is not configured for JD uploads.", trace_id=trace_id, req=req, status_code=503)

    service, container_name, account_name, account_key, shared_sas = config
    blob_path = f"jds/{datetime.now(timezone.utc):%Y/%m/%d}/{uuid.uuid4().hex}{ext}"

    container_client = service.get_container_client(container_name)
    try:
        container_client.create_container()
    except Exception:
        pass

    if account_key:
        sas = generate_blob_sas(
            account_name=account_name,
            container_name=container_name,
            blob_name=blob_path,
            account_key=account_key,
            permission=BlobSasPermissions(write=True, create=True),
            expiry=datetime.now(timezone.utc) + timedelta(minutes=10),
            content_type=content_type,
        )
        expires = 600
    else:
        sas = str(shared_sas or "").lstrip("?")
        expires = 3600

    upload_url = f"{service.primary_endpoint}/{container_name}/{blob_path}?{sas}"

    return ok_response(
        trace_id=trace_id,
        req=req,
        data={
            "upload": {
                "method": "PUT",
                "url": upload_url,
                "expires_in_seconds": expires,
                "required_headers": {
                    "x-ms-blob-type": "BlockBlob",
                    "Content-Type": content_type,
                },
            },
            "blob": {
                "container": container_name,
                "path": blob_path,
            },
        },
    )
