"""
Azure Function: Health check endpoint
"""
import os
import sys

script_dir = os.path.dirname(os.path.abspath(__file__))
shared_path = os.path.join(script_dir, '..', 'shared')
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

import azure.functions as func

from core.api_contract import error_response, get_trace_id, ok_response, options_response
from core.settings import get_settings
from ingestion.codebase_kb_pipeline import get_codebase_kb_status
from core.llm_factory import get_llm_factory
from core.embedding_factory import get_embedding_factory
from observability.langfuse_tracer import get_tracer
from observability.quality_counters import get_quality_counters
from retrieval.qdrant_store import QdrantStore


async def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = get_trace_id(req)
    
    if req.method == "OPTIONS":
        return options_response(trace_id=trace_id, req=req)
    
    checks = {}
    status_code = 200
    
    # Check LLM
    try:
        factory = get_llm_factory()
        llm, provider = await factory.get_healthy_llm()
        checks["llm"] = {"status": "ok", "provider": provider.value}
    except Exception as e:
        checks["llm"] = {"status": "error", "detail": str(e)}
        status_code = 503
    
    # Check Embeddings
    try:
        emb = get_embedding_factory().get_instance()
        await emb.aembed_query("test")
        checks["embeddings"] = {"status": "ok"}
    except Exception as e:
        checks["embeddings"] = {"status": "error", "detail": str(e)}
        status_code = 503
    
    # Check vector store (Qdrant, Supabase Vector, or in-memory fallback)
    try:
        store = QdrantStore()
        await store.ensure_collection()
        info = await store.collection_info()
        checks["vector_store"] = {"status": "ok", "info": info}
    except Exception as e:
        checks["vector_store"] = {"status": "error", "detail": str(e)}
        status_code = 503

    # Check optional Langfuse observability (non-blocking)
    try:
        lf_status = get_tracer().status()
        checks["langfuse"] = {
            "status": "ok" if lf_status.get("enabled") else "disabled",
            "enabled": bool(lf_status.get("enabled")),
            "configured": bool(lf_status.get("configured")),
            "host": lf_status.get("host"),
            "reason": lf_status.get("reason"),
        }
    except Exception as e:
        checks["langfuse"] = {"status": "error", "detail": str(e)}

    # Check generated codebase KB pipeline status (non-blocking)
    try:
        kb_status = get_codebase_kb_status()
        state = kb_status.get("state", {}) if isinstance(kb_status, dict) else {}
        validation = state.get("validation", {}) if isinstance(state, dict) else {}
        checks["codebase_kb"] = {
            "status": "ok" if bool(state.get("indexed")) else "pending",
            "indexed": bool(state.get("indexed")),
            "markdown_exists": bool(kb_status.get("markdown_exists")),
            "markdown_file": kb_status.get("markdown_file"),
            "content_hash": state.get("content_hash"),
            "validation": validation,
        }
    except Exception as e:
        checks["codebase_kb"] = {"status": "error", "detail": str(e)}
    
    # Quality counters (non-blocking, in-memory)
    try:
        checks["quality"] = {
            "status": "ok",
            **get_quality_counters().snapshot(),
        }
    except Exception as e:
        checks["quality"] = {"status": "error", "detail": str(e)}

    data = {
        "status": "ready" if status_code == 200 else "not_ready",
        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        "checks": checks
    }

    if status_code == 200:
        return ok_response(data=data, trace_id=trace_id, req=req)

    return error_response(
        error_type="infra",
        message="One or more health checks failed.",
        trace_id=trace_id,
        req=req,
        status_code=status_code,
        details=data,
    )