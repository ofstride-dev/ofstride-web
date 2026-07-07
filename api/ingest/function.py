"""
Azure Function: Document ingestion endpoint
"""
import logging
import os
import sys
import base64

script_dir = os.path.dirname(os.path.abspath(__file__))
shared_path = os.path.join(script_dir, '..', 'shared')
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

import azure.functions as func

from core.api_contract import error_response, get_trace_id, ok_response, options_response
from ingestion.parsers import parse_file
from retrieval.qdrant_store import QdrantStore
from core.settings import get_settings
from security.rate_limiter import enforce_rate_limit, get_client_key

logger = logging.getLogger("ofstride")


def _validate_ingest_body(body: object) -> tuple[str, str, dict]:
    if not isinstance(body, dict):
        raise ValueError("Request body must be an object.")

    filename = str(body.get("filename", "")).strip()
    content_base64 = str(body.get("content_base64", "")).strip()
    metadata = body.get("metadata") or {}

    if not filename:
        raise ValueError("filename is required.")
    if not content_base64:
        raise ValueError("content_base64 is required.")
    if not isinstance(metadata, dict):
        raise ValueError("metadata must be an object.")

    return filename, content_base64, metadata


async def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = get_trace_id(req)
    settings = get_settings()
    
    if req.method == "OPTIONS":
        return options_response(trace_id=trace_id, req=req)

    client_key = get_client_key(req.headers.get("x-forwarded-for") if req.headers else None, trace_id)
    allowed, retry_after = enforce_rate_limit(route_name="ingest", client_key=client_key)
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
    
    if req.method != "POST":
        return error_response(
            error_type="validation",
            message="Method not allowed",
            trace_id=trace_id,
            req=req,
            status_code=405,
        )

    content_type = (req.headers.get("content-type") or "") if req.headers else ""
    if "application/json" not in content_type.lower():
        return error_response(
            error_type="validation",
            message="Content-Type must be application/json.",
            trace_id=trace_id,
            req=req,
            status_code=415,
        )

    expected_secret = (settings.ingest_shared_secret or "").strip()
    if expected_secret:
        incoming_secret = ""
        if req.headers:
            incoming_secret = (req.headers.get("x-ingest-token") or "").strip()
        if not incoming_secret or incoming_secret != expected_secret:
            return error_response(
                error_type="validation",
                message="Unauthorized ingest request.",
                trace_id=trace_id,
                req=req,
                status_code=401,
            )
    
    try:
        body = req.get_json()
        filename, content_base64, metadata = _validate_ingest_body(body)
    except ValueError as e:
        return error_response(
            error_type="validation",
            message="Invalid request payload.",
            trace_id=trace_id,
            req=req,
            status_code=400,
            details={"reason": str(e)},
        )

    allowed_extensions = {
        ext.strip().lower()
        for ext in settings.ingest_allowed_extensions.split(",")
        if ext.strip()
    }
    extension = os.path.splitext(filename)[1].lower()
    if extension not in allowed_extensions:
        return error_response(
            error_type="validation",
            message="Unsupported file extension.",
            trace_id=trace_id,
            req=req,
            status_code=400,
            details={"allowed_extensions": sorted(allowed_extensions)},
        )
    
    try:
        # Decode base64 content
        file_bytes = base64.b64decode(content_base64)
        if len(file_bytes) > settings.ingest_max_file_bytes:
            return error_response(
                error_type="validation",
                message="File exceeds ingest size limit.",
                trace_id=trace_id,
                req=req,
                status_code=413,
                details={
                    "max_bytes": settings.ingest_max_file_bytes,
                    "received_bytes": len(file_bytes),
                },
            )
        
        # Parse document
        parsed_docs = list(parse_file(file_bytes, filename))
        
        if not parsed_docs:
            return error_response(
                error_type="validation",
                message="No content extracted from file",
                trace_id=trace_id,
                req=req,
                status_code=400,
            )
        
        docs_to_store = []
        for parsed in parsed_docs:
            docs_to_store.append(
                {
                    "content": parsed.content,
                    "metadata": {
                        **parsed.metadata,
                        **metadata,
                        "ingested_at": __import__("datetime").datetime.utcnow().isoformat(),
                    },
                }
            )
        
        # Add to Qdrant
        store = QdrantStore()
        await store.ensure_collection()
        added = await store.add_documents(docs_to_store)
        
        return ok_response(
            trace_id=trace_id,
            req=req,
            data={
                "status": "success",
                "documents_ingested": added,
                "source_type": parsed_docs[0].source_type,
                "total_chars": sum(len(d.content) for d in parsed_docs),
            },
        )
        
    except Exception as e:
        logger.exception("Ingestion failed")
        return error_response(
            error_type="infra",
            message="Ingestion failed",
            trace_id=trace_id,
            req=req,
            status_code=500,
            details={
                "reason": str(e) if get_settings().env == "dev" else "Please try again"
            },
        )