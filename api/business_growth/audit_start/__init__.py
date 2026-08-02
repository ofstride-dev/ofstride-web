import azure.functions as func
import json
import os
from azure.storage.queue import QueueClient
from azure.core.exceptions import ResourceNotFoundError
from business_growth.shared.db import get_supabase
from business_growth.shared.http import error_response, json_response, options_response

def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response(req)

    try:
        body = req.get_json()
    except Exception:
        return error_response(req, "Invalid JSON", status_code=400)

    assessment_session_id = body.get("assessment_session_id")
    root_url = body.get("root_url")

    if not assessment_session_id or not root_url:
        return error_response(req, "Missing assessment_session_id or root_url", status_code=400)

    supa = get_supabase()
    run = supa.table("audit_run").insert({
        "assessment_session_id": assessment_session_id,
        "status": "queued",
        "root_url": root_url,
        "page_count": 0,
    }).execute()
    audit_run_id = run.data[0]["id"]

    try:
        connection_string = os.environ.get("AzureWebJobsStorage", "").strip()
        if not connection_string:
            raise ValueError("AzureWebJobsStorage is missing")

        queue_client = QueueClient.from_connection_string(
            connection_string,
            "audit-queue",
        )
        payload = json.dumps({
            "audit_run_id": audit_run_id,
            "root_url": root_url,
            "max_pages": 50,
            "max_depth": 3
        })

        queue_client.create_queue()
        try:
            queue_client.send_message(payload)
        except ResourceNotFoundError:
            queue_client.create_queue()
            queue_client.send_message(payload)
    except Exception as exc:
        try:
            supa.table("audit_run").update({"status": "failed"}).eq("id", audit_run_id).execute()
        except Exception:
            pass
        return error_response(req, f"Failed to enqueue audit job: {str(exc)}", status_code=500)

    return json_response(req, {"audit_run_id": audit_run_id, "status": "queued"}, status_code=201)