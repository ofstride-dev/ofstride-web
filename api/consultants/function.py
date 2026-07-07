"""
Azure Function: Direct consultant search
"""
import os
import sys

script_dir = os.path.dirname(os.path.abspath(__file__))
shared_path = os.path.join(script_dir, '..', 'shared')
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

import azure.functions as func

from core.api_contract import error_response, get_trace_id, ok_response, options_response
from retrieval.qdrant_store import QdrantStore
from security.rate_limiter import enforce_rate_limit, get_client_key


async def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = get_trace_id(req)
    
    if req.method == "OPTIONS":
        return options_response(trace_id=trace_id, req=req)

    client_key = get_client_key(req.headers.get("x-forwarded-for") if req.headers else None, trace_id)
    allowed, retry_after = enforce_rate_limit(route_name="consultants_search", client_key=client_key)
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
    
    query = req.params.get("query", "")
    if not query:
        return error_response(
            error_type="validation",
            message="query parameter required",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )
    
    try:
        store = QdrantStore()
        docs = await store.similarity_search(
            query=query,
            k=10,
            filters={"source_type": {"$in": ["consultant_profile", "consultant_cv", "consultant_data"]}}
        )
        
        consultants = []
        for doc in docs:
            consultants.append({
                "name": doc.metadata.get("consultant_name", doc.metadata.get("source", "Unknown")),
                "skills": doc.metadata.get("skills", []),
                "experience_years": doc.metadata.get("experience_years"),
                "availability": doc.metadata.get("availability"),
                "summary": doc.page_content[:500],
                "metadata": {k: v for k, v in doc.metadata.items() if k not in ["skills"]}
            })
        
        return ok_response(
            trace_id=trace_id,
            req=req,
            data={
                "consultants": consultants,
                "total": len(consultants),
                "query": query,
            },
        )
        
    except Exception as e:
        return error_response(
            error_type="retrieval",
            message="Consultant search failed.",
            trace_id=trace_id,
            req=req,
            status_code=500,
            details={"reason": str(e)},
        )