import azure.functions as func
import json
import os
import uuid
from urllib.parse import urlparse

from business_growth.shared.db import get_supabase
from business_growth.shared.http import error_response, json_response, options_response
from business_growth.shared.run_status import mark_failed


def _int_env(name: str, default: int) -> int:
    raw = (os.environ.get(name) or "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except Exception:
        return default


def _coerce_domain(root_url: str) -> str:
    try:
        parsed = urlparse(root_url)
        if parsed.netloc:
            return parsed.netloc
    except Exception:
        pass
    return root_url


def _ensure_assessment_session(supa, assessment_session_id: str, root_url: str) -> str:
    """Open-mode fallback: ensure the provided assessment session exists.

    If a stale/missing session id is used while re-running an assessment,
    create a bootstrap business_profile + assessment_session so audit creation
    does not fail with an FK error.
    """
    requested_id = (assessment_session_id or "").strip()

    is_valid_uuid = True
    try:
        uuid.UUID(requested_id)
    except Exception:
        is_valid_uuid = False

    existing = []
    if is_valid_uuid:
        try:
            existing = (
                supa.table("assessment_session")
                .select("id")
                .eq("id", requested_id)
                .limit(1)
                .execute()
                .data
                or []
            )
        except Exception:
            existing = []

    if existing:
        return requested_id

    profile = (
        supa.table("business_profile")
        .insert(
            {
                "name": "Open Assessment Lead",
                "domain": _coerce_domain(root_url),
                "industry": None,
                "target_geo": None,
                "growth_goal": "",
                "current_channels": [],
                "budget_band": None,
                "urgency_band": None,
                "contact_name": "Open User",
                "contact_email": "open@ofstride.local",
                "contact_phone": None,
            }
        )
        .execute()
    )
    bp_id = profile.data[0]["id"]

    try:
        supa.table("assessment_session").insert(
            {
                "id": requested_id,
                "business_profile_id": bp_id,
                "status": "new",
                "metadata": {
                    "auto_bootstrapped": True,
                    "bootstrap_reason": "missing_assessment_session_on_audit_start",
                },
            }
        ).execute()
        return requested_id
    except Exception:
        # If caller supplied a non-uuid or otherwise invalid id, create a
        # regular session and use that id for this audit run.
        session = (
            supa.table("assessment_session")
            .insert(
                {
                    "business_profile_id": bp_id,
                    "status": "new",
                    "metadata": {
                        "auto_bootstrapped": True,
                        "bootstrap_reason": "invalid_assessment_session_id_on_audit_start",
                        "requested_assessment_session_id": requested_id,
                    },
                }
            )
            .execute()
        )
        return session.data[0]["id"]


def _should_run_inline_fallback() -> bool:
    explicit = (os.environ.get("BUSINESS_GROWTH_AUDIT_INLINE_FALLBACK") or "").strip().lower()
    if explicit in {"1", "true", "yes", "on"}:
        return True

    # Default to inline fallback for local execution only.
    is_local = not bool((os.environ.get("WEBSITE_SITE_NAME") or "").strip())
    return is_local


def _run_inline_audit_worker(payload: dict) -> None:
    from business_growth.audit_worker.__init__ import main as audit_worker_main

    class _InlineQueueMessage:
        def __init__(self, body: bytes):
            self._body = body

        def get_body(self) -> bytes:
            return self._body

    msg = _InlineQueueMessage(json.dumps(payload).encode("utf-8"))
    audit_worker_main(msg)

def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response(req)

    try:
        body = req.get_json()
    except Exception:
        return error_response(req, "Invalid JSON", status_code=400)

    if not isinstance(body, dict):
        return error_response(req, "Invalid JSON object", status_code=400)

    assessment_session_id = body.get("assessment_session_id")
    root_url = body.get("root_url")

    if not assessment_session_id or not root_url:
        return error_response(req, "Missing assessment_session_id or root_url", status_code=400)

    try:
        supa = get_supabase()
        assessment_session_id = _ensure_assessment_session(supa, assessment_session_id, root_url)
        run = supa.table("audit_run").insert({
            "assessment_session_id": assessment_session_id,
            "status": "queued",
            "root_url": root_url,
            "page_count": 0,
        }).execute()
        if not run.data:
            return error_response(req, "Audit run could not be created", status_code=500)
        audit_run_id = run.data[0]["id"]
    except Exception as exc:
        return error_response(req, f"Failed to create audit run: {str(exc)}", status_code=500)

    try:
        try:
            from azure.storage.queue import QueueClient
            from azure.core.exceptions import ResourceNotFoundError, ResourceExistsError
        except ModuleNotFoundError as dep_exc:
            try:
                mark_failed(supa, audit_run_id, f"Missing runtime dependency for queueing: {str(dep_exc)}")
            except Exception:
                pass
            return error_response(
                req,
                f"Missing runtime dependency for queueing: {str(dep_exc)}. Redeploy Function App with azure-storage-queue installed.",
                status_code=500,
            )

        connection_string = os.environ.get("AzureWebJobsStorage", "").strip()
        if not connection_string:
            raise ValueError("AzureWebJobsStorage is missing")

        queue_client = QueueClient.from_connection_string(
            connection_string,
            "audit-queue",
        )
        max_pages = _int_env("BUSINESS_GROWTH_AUDIT_MAX_PAGES", 12)
        max_depth = _int_env("BUSINESS_GROWTH_AUDIT_MAX_DEPTH", 2)

        payload = json.dumps({
            "audit_run_id": audit_run_id,
            "root_url": root_url,
            "max_pages": max_pages,
            "max_depth": max_depth
        })

        try:
            queue_client.create_queue()
        except ResourceExistsError:
            pass

        queue_payload = {
            "audit_run_id": audit_run_id,
            "root_url": root_url,
            "max_pages": max_pages,
            "max_depth": max_depth,
        }

        try:
            queue_client.send_message(payload)
        except ResourceNotFoundError:
            queue_client.create_queue()
            queue_client.send_message(payload)

        if _should_run_inline_fallback():
            try:
                _run_inline_audit_worker(queue_payload)
            except Exception:
                # Queue path remains primary; ignore inline fallback errors here.
                pass
    except Exception as exc:
        try:
            mark_failed(supa, audit_run_id, f"Failed to enqueue audit job: {str(exc)}")
        except Exception:
            pass
        return error_response(req, f"Failed to enqueue audit job: {str(exc)}", status_code=500)

    return json_response(req, {"audit_run_id": audit_run_id, "status": "queued"}, status_code=201)