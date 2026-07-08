"""
Azure Function: Website crawl and ingestion endpoint
"""
import logging
import os
import sys

script_dir = os.path.dirname(os.path.abspath(__file__))
shared_path = os.path.join(script_dir, '..', 'shared')
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

import azure.functions as func

from core.api_contract import error_response, get_trace_id, ok_response, options_response
from core.settings import get_settings
from ingestion.website_crawler import crawl_approved_pages, crawled_page_to_documents
from retrieval.qdrant_store import QdrantStore

logger = logging.getLogger("ofstride")


async def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = get_trace_id(req)

    if req.method == "OPTIONS":
        return options_response(trace_id=trace_id, req=req)

    if req.method != "POST":
        return error_response(
            error_type="validation",
            message="Method not allowed",
            trace_id=trace_id,
            req=req,
            status_code=405,
        )

    # Secret header check
    settings = get_settings()
    expected_secret = os.environ.get("INGEST_SHARED_SECRET", "")
    if expected_secret:
        provided_secret = (req.headers.get("X-Crawl-Secret") or "") if req.headers else ""
        if provided_secret != expected_secret:
            return error_response(
                error_type="validation",
                message="Unauthorized",
                trace_id=trace_id,
                req=req,
                status_code=401,
            )

    try:
        pages = await crawl_approved_pages()
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("Unexpected error during crawl: %s", exc)
        return error_response(
            error_type="infra",
            message="Crawl failed unexpectedly.",
            trace_id=trace_id,
            req=req,
            status_code=500,
        )

    chunk_size = settings.ingest_chunk_size
    chunk_overlap = settings.ingest_chunk_overlap

    store = QdrantStore()
    await store.ensure_collection()

    errors: list[str] = []
    total_chunks = 0

    for page in pages:
        try:
            docs = crawled_page_to_documents(
                page,
                chunk_size=chunk_size,
                overlap=chunk_overlap,
            )
            if docs:
                await store.add_documents(docs)
                total_chunks += len(docs)
                logger.info("Ingested %d chunks for %s", len(docs), page.url)
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Failed to ingest page %s: %s", page.url, exc)
            errors.append(page.url)

    return ok_response(
        data={
            "pages_crawled": len(pages),
            "chunks_ingested": total_chunks,
            "errors": errors,
        },
        trace_id=trace_id,
        req=req,
    )
