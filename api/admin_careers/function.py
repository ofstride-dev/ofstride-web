import json
import os
import re
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib import error as url_error
from urllib import request as url_request

import azure.functions as func

script_dir = os.path.dirname(os.path.abspath(__file__))
shared_path = os.path.join(script_dir, "..", "shared")
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

from core.api_contract import error_response, get_trace_id, ok_response, options_response
from persistence.careers_store import get_careers_store

# ── Constants ──────────────────────────────────────────────────────────────

ALLOWED_JOB_STATUSES = {"draft", "active", "archived"}
ALLOWED_APPLICATION_STATUSES = {"under_review", "shortlisted", "rejected"}
MAX_JD_BYTES = 2 * 1024 * 1024
ALLOWED_JD_EXTENSIONS = {".md", ".txt"}
ALLOWED_JD_TYPES = {"text/markdown", "text/plain"}

SKILL_LEXICON = [
    "python", "sql", "excel", "power bi", "tableau",
    "finance", "accounting", "hr", "recruitment", "compliance",
    "payroll", "gst", "tax", "legal", "operations", "strategy",
    "project management", "data analysis", "communication", "leadership",
]

# ── Helpers ────────────────────────────────────────────────────────────────


def _parse_connection_string(raw: str) -> dict[str, str]:
    out = {}
    for token in raw.split(";"):
        if not token or "=" not in token:
            continue
        k, v = token.split("=", 1)
        out[k.strip()] = v.strip()
    return out


def _blob_config(container_key: str) -> tuple | None:
    from azure.storage.blob import BlobServiceClient  # deferred import
    connection_string = (os.getenv("CAREERS_BLOB_CONNECTION_STRING") or "").strip()
    container_name = (os.getenv(container_key) or "").strip()
    if not connection_string or not container_name:
        return None
    parsed = _parse_connection_string(connection_string)
    account_name = parsed.get("AccountName", "")
    account_key = parsed.get("AccountKey")
    shared_sas = parsed.get("SharedAccessSignature")
    if not account_name or (not account_key and not shared_sas):
        return None
    return BlobServiceClient.from_connection_string(connection_string), container_name, account_name, account_key, shared_sas


def _blob_service():
    from azure.storage.blob import BlobServiceClient  # deferred import
    conn = (os.getenv("CAREERS_BLOB_CONNECTION_STRING") or "").strip()
    if not conn:
        return None
    return BlobServiceClient.from_connection_string(conn)


def _normalize_text(value: object) -> str:
    text = str(value or "").lower()
    return re.sub(r"\s+", " ", text).strip()


def _extract_present_skills(text: str) -> list[str]:
    present: list[str] = []
    for skill in SKILL_LEXICON:
        pattern = rf"(^|[^a-z0-9]){re.escape(skill)}([^a-z0-9]|$)"
        if re.search(pattern, text):
            present.append(skill)
    return present


def _post_json(url: str, payload: dict[str, object]) -> tuple[bool, str | None]:
    body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
    req_obj = url_request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with url_request.urlopen(req_obj, timeout=10) as response:
            if 200 <= response.status < 300:
                return True, None
            return False, f"http_{response.status}"
    except (url_error.HTTPError, url_error.URLError, TimeoutError) as exc:
        return False, str(exc)


def _parse_path(path: str) -> list[str]:
    """Parse the catch-all path into segments, stripping empty parts."""
    return [s for s in path.strip("/").split("/") if s]


# ── Route Handlers ─────────────────────────────────────────────────────────


async def _handle_list_applications(req: func.HttpRequest, trace_id: str, admin: dict) -> func.HttpResponse:
    status = (req.params.get("status") or "").strip() or None
    job_id = (req.params.get("job_id") or "").strip() or None
    try:
        limit = int(req.params.get("limit", "100"))
    except ValueError:
        limit = 100
    try:
        offset = int(req.params.get("offset", "0"))
    except ValueError:
        offset = 0

    store = get_careers_store()
    if not store.is_available:
        return error_response(error_type="infra", message="Careers store unavailable.", trace_id=trace_id, req=req, status_code=503)

    rows = store.list_applications(status=status, job_id=job_id, limit=limit, offset=offset)
    return ok_response(trace_id=trace_id, req=req, data={"items": rows, "count": len(rows), "requested_by": admin["user_name"]})


async def _handle_get_application(req: func.HttpRequest, trace_id: str, application_id: str) -> func.HttpResponse:
    if not application_id:
        return error_response(error_type="validation", message="application_id is required.", trace_id=trace_id, req=req, status_code=400)
    store = get_careers_store()
    detail = store.get_application_detail(application_id=application_id) if store.is_available else None
    if not detail:
        return error_response(error_type="validation", message="Application not found.", trace_id=trace_id, req=req, status_code=404)
    return ok_response(trace_id=trace_id, req=req, data=detail)


async def _handle_update_application_status(req: func.HttpRequest, trace_id: str, admin: dict, application_id: str) -> func.HttpResponse:
    if not application_id:
        return error_response(error_type="validation", message="application_id is required.", trace_id=trace_id, req=req, status_code=400)
    try:
        body = req.get_json()
    except ValueError:
        return error_response(error_type="validation", message="Request body must be valid JSON.", trace_id=trace_id, req=req, status_code=400)
    status = str((body or {}).get("status", "")).strip().lower()
    if status not in ALLOWED_APPLICATION_STATUSES:
        return error_response(error_type="validation", message="status must be one of: under_review, shortlisted, rejected", trace_id=trace_id, req=req, status_code=400)
    store = get_careers_store()
    updated = store.update_application_status(application_id=application_id, status=status) if store.is_available else False
    if not updated:
        return error_response(error_type="validation", message="Application not found.", trace_id=trace_id, req=req, status_code=404)
    store.log_admin_action(admin_user_id=admin["user_id"], action_type="update_status", entity_type="application", entity_id=application_id, action_detail=f"status={status}")
    return ok_response(trace_id=trace_id, req=req, data={"application_id": application_id, "status": status})


async def _handle_run_analysis(req: func.HttpRequest, trace_id: str, admin: dict, application_id: str) -> func.HttpResponse:
    if not application_id:
        return error_response(error_type="validation", message="application_id is required.", trace_id=trace_id, req=req, status_code=400)
    store = get_careers_store()
    if not store.is_available:
        return error_response(error_type="infra", message="Careers store unavailable.", trace_id=trace_id, req=req, status_code=503)
    detail = store.get_application_detail(application_id=application_id)
    if not detail:
        return error_response(error_type="validation", message="Application not found.", trace_id=trace_id, req=req, status_code=404)

    job = store.get_job_by_id(job_id=str(detail.get("job_id") or "")) or {}
    jd_text = _normalize_text(job.get("title"))
    jd_text = f"{jd_text} {_normalize_text(detail.get('job_title'))} {_normalize_text(job.get('department'))} {_normalize_text(job.get('employment_type'))}"
    jd_text = f"{jd_text} {_normalize_text(job.get('jd_markdown'))} {_normalize_text(job.get('jd_raw_text'))}"
    candidate_text = f"{_normalize_text(detail.get('cover_note'))} {_normalize_text(detail.get('linkedin_url'))}"

    required_skills = _extract_present_skills(jd_text)
    candidate_skills = _extract_present_skills(candidate_text)
    if not required_skills:
        required_skills = ["communication", "operations", "strategy"]

    matched_skills = sorted({skill for skill in required_skills if skill in candidate_skills})
    missing_skills = sorted({skill for skill in required_skills if skill not in candidate_skills})

    years = float(detail.get("years_experience") or 0)
    base = 40.0
    experience_boost = min(years, 15.0) * 2.0
    match_ratio = (len(matched_skills) / len(required_skills)) if required_skills else 0.0
    skill_boost = match_ratio * 40.0
    score = round(min(97.0, base + experience_boost + skill_boost), 1)

    if score >= 75:
        recommendation = "shortlist"
    elif score >= 60:
        recommendation = "review"
    else:
        recommendation = "hold"

    strengths_summary = f"Matched {len(matched_skills)} of {len(required_skills)} key skills" + (f": {', '.join(matched_skills)}." if matched_skills else ".")
    gaps_summary = f"Missing {len(missing_skills)} skills" + (f": {', '.join(missing_skills)}." if missing_skills else ".")

    updated = store.update_analysis_status(
        application_id=application_id, analysis_status="completed",
        analyzed_by=admin["user_name"], recommendation=recommendation, match_score=score,
        matched_skills_json=json.dumps(matched_skills, ensure_ascii=True),
        missing_skills_json=json.dumps(missing_skills, ensure_ascii=True),
        strengths_summary=strengths_summary, gaps_summary=gaps_summary,
    )
    if not updated:
        return error_response(error_type="infra", message="Failed to update analysis status.", trace_id=trace_id, req=req, status_code=500)

    store.log_admin_action(admin_user_id=admin["user_id"], action_type="run_analysis", entity_type="application", entity_id=application_id, action_detail=f"score={score:.1f};recommendation={recommendation}")
    return ok_response(trace_id=trace_id, req=req, data={
        "application_id": application_id, "analysis_status": "completed", "match_score": score,
        "recommendation": recommendation, "matched_skills": matched_skills,
        "missing_skills": missing_skills, "strengths_summary": strengths_summary, "gaps_summary": gaps_summary,
    })


async def _handle_notify_application(req: func.HttpRequest, trace_id: str, admin: dict, application_id: str) -> func.HttpResponse:
    if not application_id:
        return error_response(error_type="validation", message="application_id is required.", trace_id=trace_id, req=req, status_code=400)
    store = get_careers_store()
    if not store.is_available:
        return error_response(error_type="infra", message="Careers store unavailable.", trace_id=trace_id, req=req, status_code=503)
    detail = store.get_application_detail(application_id=application_id)
    if not detail:
        return error_response(error_type="validation", message="Application not found.", trace_id=trace_id, req=req, status_code=404)

    applicant_email = str(detail.get("email") or "").strip().lower()
    if not applicant_email:
        return error_response(error_type="validation", message="Application does not have a valid applicant email.", trace_id=trace_id, req=req, status_code=400)

    target = (
        (os.getenv("CONTACT_WEBHOOK_URL") or "").strip()
        or (os.getenv("MAKE_WEBHOOK_CHAT_URL") or "").strip()
        or (os.getenv("CAREERS_HR_WEBHOOK_URL") or "").strip()
    )
    if not target:
        return error_response(error_type="infra", message="No webhook configured for notifications.", trace_id=trace_id, req=req, status_code=503)

    payload = {
        "type": "career_applicant_followup", "source": "ofstride-website",
        "notify_requester_email": applicant_email,
        "notify_support_email": (os.getenv("CAREERS_HR_EMAIL") or "hr@ofstrideservices.com").strip(),
        "application_id": str(detail.get("id") or ""), "reference_id": str(detail.get("reference_id") or ""),
        "job_id": str(detail.get("job_id") or ""), "job_title": str(detail.get("job_title") or ""),
        "full_name": str(detail.get("full_name") or ""), "match_score": detail.get("match_score"),
        "recommendation": str(detail.get("recommendation") or ""), "analysis_status": str(detail.get("analysis_status") or ""),
        "action": "invite_for_further_discussion", "sent_by_admin": str(admin.get("user_name") or "admin"),
    }

    sent, send_error = _post_json(target, payload)
    if sent:
        store.mark_applicant_followup_sent(application_id=application_id)
    store.log_admin_action(admin_user_id=admin["user_id"], action_type="notify_applicant_followup", entity_type="application", entity_id=application_id, action_detail=f"sent={sent};error={send_error or ''}")
    return ok_response(trace_id=trace_id, req=req, data={"application_id": application_id, "sent": sent, "error": send_error})


async def _handle_cleanup(req: func.HttpRequest, trace_id: str, admin: dict) -> func.HttpResponse:
    try:
        body = req.get_json()
    except ValueError:
        body = {}
    older_than_hours = 24
    if isinstance(body, dict) and body.get("older_than_hours") is not None:
        try:
            older_than_hours = int(body.get("older_than_hours"))
        except (TypeError, ValueError):
            older_than_hours = 24
    store = get_careers_store()
    if not store.is_available:
        return error_response(error_type="infra", message="Careers store unavailable.", trace_id=trace_id, req=req, status_code=503)
    updated = store.mark_stale_drafts_upload_failed(older_than_hours=older_than_hours)
    store.log_admin_action(admin_user_id=admin["user_id"], action_type="cleanup_stale_drafts", entity_type="application", entity_id="bulk", action_detail=f"older_than_hours={older_than_hours};updated={updated}")
    return ok_response(trace_id=trace_id, req=req, data={"updated": updated, "older_than_hours": older_than_hours})


async def _handle_list_jobs(req: func.HttpRequest, trace_id: str, admin: dict) -> func.HttpResponse:
    store = get_careers_store()
    if not store.is_available:
        return error_response(error_type="infra", message="Careers store unavailable.", trace_id=trace_id, req=req, status_code=503)
    jobs = store.list_jobs(include_inactive=True)
    return ok_response(trace_id=trace_id, req=req, data={"items": jobs, "count": len(jobs)})


async def _handle_save_job(req: func.HttpRequest, trace_id: str, admin: dict) -> func.HttpResponse:
    try:
        body = req.get_json()
    except ValueError:
        return error_response(error_type="validation", message="Request body must be valid JSON.", trace_id=trace_id, req=req, status_code=400)
    if not isinstance(body, dict):
        return error_response(error_type="validation", message="Request body must be a JSON object.", trace_id=trace_id, req=req, status_code=400)
    title = str(body.get("title", "")).strip()
    jd_markdown = str(body.get("jd_markdown", "")).strip()
    jd_raw_text = str(body.get("jd_raw_text", "")).strip() or jd_markdown
    status = str(body.get("status", "draft")).strip().lower()
    if not title or not jd_markdown:
        return error_response(error_type="validation", message="Both 'title' and 'jd_markdown' are required.", trace_id=trace_id, req=req, status_code=400)
    if status not in ALLOWED_JOB_STATUSES:
        return error_response(error_type="validation", message="status must be one of: draft, active, archived", trace_id=trace_id, req=req, status_code=400)
    store = get_careers_store()
    saved = store.upsert_job(
        job_id=str(body.get("id", "")).strip() or None, title=title,
        department=str(body.get("department", "")).strip() or None, location=str(body.get("location", "")).strip() or None,
        employment_type=str(body.get("employment_type", "")).strip() or None,
        jd_markdown=jd_markdown, jd_raw_text=jd_raw_text,
        jd_blob_path=str(body.get("jd_blob_path", "")).strip() or None, jd_blob_container=str(body.get("jd_blob_container", "")).strip() or None,
        status=status, created_by=admin.get("user_name"),
    )
    if not saved:
        return error_response(error_type="infra", message="Failed to save job.", trace_id=trace_id, req=req, status_code=500)
    store.log_admin_action(admin_user_id=admin["user_id"], action_type="upsert_job", entity_type="job", entity_id=str(saved.get("id") or ""), action_detail=f"status={saved.get('status', '')}")
    return ok_response(trace_id=trace_id, req=req, data=saved)


async def _handle_init_jd_upload(req: func.HttpRequest, trace_id: str) -> func.HttpResponse:
    from azure.storage.blob import BlobSasPermissions, generate_blob_sas  # deferred import
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
    if not file_name or ext not in ALLOWED_JD_EXTENSIONS or content_type not in ALLOWED_JD_TYPES:
        return error_response(error_type="validation", message="Only .md or .txt JD files are supported.", trace_id=trace_id, req=req, status_code=400)
    if size_bytes <= 0 or size_bytes > MAX_JD_BYTES:
        return error_response(error_type="validation", message="JD file must be <= 2 MB.", trace_id=trace_id, req=req, status_code=400)
    config = _blob_config("CAREERS_JD_BLOB_CONTAINER")
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
        sas = generate_blob_sas(account_name=account_name, container_name=container_name, blob_name=blob_path, account_key=account_key, permission=BlobSasPermissions(write=True, create=True), expiry=datetime.now(timezone.utc) + timedelta(minutes=10), content_type=content_type)
        expires = 600
    else:
        sas = str(shared_sas or "").lstrip("?")
        expires = 3600
    upload_url = f"{service.primary_endpoint}/{container_name}/{blob_path}?{sas}"
    return ok_response(trace_id=trace_id, req=req, data={"upload": {"method": "PUT", "url": upload_url, "expires_in_seconds": expires, "required_headers": {"x-ms-blob-type": "BlockBlob", "Content-Type": content_type}}, "blob": {"container": container_name, "path": blob_path}})


async def _handle_publish_from_upload(req: func.HttpRequest, trace_id: str, admin: dict) -> func.HttpResponse:
    from azure.storage.blob import BlobServiceClient  # deferred import
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
        job_id=str(body.get("id", "")).strip() or None, title=title,
        department=str(body.get("department", "")).strip() or None, location=str(body.get("location", "")).strip() or None,
        employment_type=str(body.get("employment_type", "")).strip() or None,
        jd_markdown=jd_text, jd_raw_text=jd_text, jd_blob_path=blob_path, jd_blob_container=container,
        status=status, created_by=admin.get("user_name"),
    )
    if not saved:
        return error_response(error_type="infra", message="Failed to publish uploaded JD.", trace_id=trace_id, req=req, status_code=500)
    store.log_admin_action(admin_user_id=admin["user_id"], action_type="publish_job_from_upload", entity_type="job", entity_id=str(saved.get("id") or ""), action_detail=f"container={container};path={blob_path};status={status}")
    return ok_response(trace_id=trace_id, req=req, data=saved)


# ── Main Router ────────────────────────────────────────────────────────────


async def main(req: func.HttpRequest) -> func.HttpResponse:
    from security.admin_auth import AdminAuthError, require_admin  # deferred import

    trace_id = get_trace_id(req)
    if req.method == "OPTIONS":
        return options_response(trace_id=trace_id, req=req)

    # Authenticate
    try:
        admin = require_admin(req)
    except AdminAuthError as exc:
        return error_response(error_type="validation", message=str(exc), trace_id=trace_id, req=req, status_code=401)

    path = str(req.route_params.get("path") or "").strip() if req.route_params else ""
    segments = _parse_path(path)
    primary = segments[0] if segments else ""

    # ── GET /applications (list) ───────────────────────────────────────────
    if req.method == "GET" and primary == "applications" and len(segments) == 1:
        return await _handle_list_applications(req, trace_id, admin)

    # ── GET /applications/{id} (detail) ────────────────────────────────────
    if req.method == "GET" and primary == "applications" and len(segments) == 2:
        return await _handle_get_application(req, trace_id, segments[1])

    # ── POST /applications/{id}/status (update status) ─────────────────────
    if req.method == "POST" and primary == "applications" and len(segments) == 3 and segments[2] == "status":
        return await _handle_update_application_status(req, trace_id, admin, segments[1])

    # ── POST /applications/{id}/analysis (run analysis) ────────────────────
    if req.method == "POST" and primary == "applications" and len(segments) == 3 and segments[2] == "analysis":
        return await _handle_run_analysis(req, trace_id, admin, segments[1])

    # ── POST /applications/{id}/notify (send follow-up mail) ───────────────
    if req.method == "POST" and primary == "applications" and len(segments) == 3 and segments[2] == "notify":
        return await _handle_notify_application(req, trace_id, admin, segments[1])

    # ── GET /jobs (list) ───────────────────────────────────────────────────
    if req.method == "GET" and primary == "jobs" and len(segments) == 1:
        return await _handle_list_jobs(req, trace_id, admin)

    # ── POST /jobs (save job) ─────────────────────────────────────────────
    if req.method == "POST" and primary == "jobs" and len(segments) == 1:
        return await _handle_save_job(req, trace_id, admin)

    # ── POST /jd-upload/init (init JD upload) ─────────────────────────────
    if req.method == "POST" and primary == "jd-upload" and len(segments) == 2 and segments[1] == "init":
        return await _handle_init_jd_upload(req, trace_id)

    # ── POST /jobs/from-upload (publish from uploaded JD) ─────────────────
    if req.method == "POST" and primary == "jobs" and len(segments) == 2 and segments[1] == "from-upload":
        return await _handle_publish_from_upload(req, trace_id, admin)

    # ── POST /cleanup (clean stale drafts) ────────────────────────────────
    if req.method == "POST" and primary == "cleanup" and len(segments) == 1:
        return await _handle_cleanup(req, trace_id, admin)

    # ── Fallback 404 ──────────────────────────────────────────────────────
    return error_response(error_type="validation", message=f"Unknown admin-careers endpoint: {path}", trace_id=trace_id, req=req, status_code=404)