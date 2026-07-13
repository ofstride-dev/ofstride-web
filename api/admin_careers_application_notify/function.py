import json
import os
import sys
from urllib import error as url_error
from urllib import request as url_request

import azure.functions as func

script_dir = os.path.dirname(os.path.abspath(__file__))
shared_path = os.path.join(script_dir, "..", "shared")
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

from core.api_contract import error_response, get_trace_id, ok_response, options_response
from persistence.careers_store import get_careers_store
from security.admin_auth import AdminAuthError, require_admin


def _target_webhook() -> str | None:
    return (
        (os.getenv("CONTACT_WEBHOOK_URL") or "").strip()
        or (os.getenv("MAKE_WEBHOOK_CHAT_URL") or "").strip()
        or (os.getenv("CAREERS_HR_WEBHOOK_URL") or "").strip()
    )


def _post_json(url: str, payload: dict[str, object]) -> tuple[bool, str | None]:
    body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
    req = url_request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with url_request.urlopen(req, timeout=10) as response:
            if 200 <= response.status < 300:
                return True, None
            return False, f"http_{response.status}"
    except (url_error.HTTPError, url_error.URLError, TimeoutError) as exc:
        return False, str(exc)


async def main(req: func.HttpRequest) -> func.HttpResponse:
    trace_id = get_trace_id(req)
    if req.method == "OPTIONS":
        return options_response(trace_id=trace_id, req=req)

    try:
        admin = require_admin(req)
    except AdminAuthError as exc:
        return error_response(
            error_type="validation",
            message=str(exc),
            trace_id=trace_id,
            req=req,
            status_code=401,
        )

    application_id = (req.route_params.get("application_id") if req.route_params else "") or ""
    application_id = application_id.strip()
    if not application_id:
        return error_response(
            error_type="validation",
            message="application_id is required.",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )

    store = get_careers_store()
    if not store.is_available:
        return error_response(
            error_type="infra",
            message="Careers store unavailable.",
            trace_id=trace_id,
            req=req,
            status_code=503,
        )

    detail = store.get_application_detail(application_id=application_id)
    if not detail:
        return error_response(
            error_type="validation",
            message="Application not found.",
            trace_id=trace_id,
            req=req,
            status_code=404,
        )

    applicant_email = str(detail.get("email") or "").strip().lower()
    if not applicant_email:
        return error_response(
            error_type="validation",
            message="Application does not have a valid applicant email.",
            trace_id=trace_id,
            req=req,
            status_code=400,
        )

    target = _target_webhook()
    if not target:
        return error_response(
            error_type="infra",
            message="No webhook configured for notifications.",
            trace_id=trace_id,
            req=req,
            status_code=503,
        )

    payload = {
        "type": "career_applicant_followup",
        "source": "ofstride-website",
        "notify_requester_email": applicant_email,
        "notify_support_email": (os.getenv("CAREERS_HR_EMAIL") or "hr@ofstrideservices.com").strip(),
        "application_id": str(detail.get("id") or ""),
        "reference_id": str(detail.get("reference_id") or ""),
        "job_id": str(detail.get("job_id") or ""),
        "job_title": str(detail.get("job_title") or ""),
        "full_name": str(detail.get("full_name") or ""),
        "match_score": detail.get("match_score"),
        "recommendation": str(detail.get("recommendation") or ""),
        "analysis_status": str(detail.get("analysis_status") or ""),
        "action": "invite_for_further_discussion",
        "sent_by_admin": str(admin.get("user_name") or "admin"),
    }

    sent, send_error = _post_json(target, payload)
    if sent:
        store.mark_applicant_followup_sent(application_id=application_id)

    store.log_admin_action(
        admin_user_id=admin["user_id"],
        action_type="notify_applicant_followup",
        entity_type="application",
        entity_id=application_id,
        action_detail=f"sent={sent};error={send_error or ''}",
    )

    return ok_response(
        trace_id=trace_id,
        req=req,
        data={
            "application_id": application_id,
            "sent": sent,
            "error": send_error,
        },
    )
