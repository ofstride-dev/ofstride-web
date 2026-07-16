import base64
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
from core.blob_rest import resolve_blob_config_with_reason, upload_blob
from careers_agentic.jd_enhancer import enhance_jd_with_existing_llm
from careers_agentic.resume_analyzer import analyze_application
from persistence.careers_store import get_careers_store

import logging as _lg
_mgmt_logger = _lg.getLogger("ofstride.careers_manage")

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


def _parse_connection_string(raw: str) -> dict[str, str]:
    out = {}
    for token in raw.split(";"):
        if not token or "=" not in token:
            continue
        k, v = token.split("=", 1)
        out[k.strip()] = v.strip()
    return out


def _blob_config(container_key: str) -> tuple | None:
    try:
        from azure.storage.blob import BlobServiceClient  # deferred import
    except ImportError as exc:
        _mgmt_logger.error(
            "Blob SDK import failed -- sys.path[0:3]=%s AZ_ENV=%s",
            sys.path[:3] if hasattr(sys, 'path') else 'N/A',
            os.getenv("AZURE_FUNCTIONS_ENVIRONMENT", "local"),
        )
        raise RuntimeError(
            "azure-storage-blob SDK is not installed in the deployment. "
            "Ensure requirements.txt is built during deployment."
        ) from exc
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
    try:
        from azure.storage.blob import BlobServiceClient  # deferred import
    except ImportError as exc:
        _mgmt_logger.error(
            "Blob SDK import failed -- sys.path[0:3]=%s AZ_ENV=%s",
            sys.path[:3] if hasattr(sys, 'path') else 'N/A',
            os.getenv("AZURE_FUNCTIONS_ENVIRONMENT", "local"),
        )
        raise RuntimeError(
            "azure-storage-blob SDK is not installed in the deployment. "
            "Ensure requirements.txt is built during deployment."
        ) from exc
    conn = (os.getenv("CAREERS_BLOB_CONNECTION_STRING") or "").strip()
    if not conn:
        return None
    return BlobServiceClient.from_connection_string(conn)


def _ensure_container(service, container_name: str) -> None:
    try:
        container_client = service.get_container_client(container_name)
        container_client.create_container()
    except Exception:
        pass


def _upload_blob_bytes(*, service, container_name: str, blob_path: str, content_bytes: bytes, content_type: str) -> None:
    from azure.storage.blob import ContentSettings

    _ensure_container(service, container_name)
    blob_client = service.get_blob_client(container=container_name, blob=blob_path)
    blob_client.upload_blob(content_bytes, overwrite=True, content_settings=ContentSettings(content_type=content_type))


def _decode_base64_content(value: str) -> bytes:
    raw = (value or "").strip()
    if not raw:
        return b""
    if "," in raw and raw.startswith("data:"):
        raw = raw.split(",", 1)[1]
    return base64.b64decode(raw)


def _normalize_jd_content_type(file_name: str | None, content_type: str | None) -> str:
    normalized = (content_type or "").strip().lower()
    ext = Path(file_name or "").suffix.lower()
    if normalized in ALLOWED_JD_TYPES:
        return normalized
    if ext == ".md":
        return "text/markdown"
    if ext == ".txt":
        return "text/plain"
    return normalized or "text/plain"


def _normalize_resume_content_type(file_name: str | None, content_type: str | None) -> str:
    normalized = (content_type or "").strip().lower()
    ext = Path(file_name or "").suffix.lower()
    if normalized in {"application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}:
        return normalized
    if ext == ".pdf":
        return "application/pdf"
    if ext == ".docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return normalized


def _blob_persist_jd(*, job_id: str, jd_content: str) -> dict[str, str] | None:
    """Persist JD markdown content to blob storage as backup.
    This is a best-effort operation - failures are logged but not propagated.
    """
    try:
        config, _ = resolve_blob_config_with_reason()
        if config is None:
            _mgmt_logger.info("Blob persistence skipped (blob not configured) for job %s", job_id)
            return None
        container = (os.getenv("CAREERS_JD_BLOB_CONTAINER") or "careers-jd-container").strip()
        blob_path = f"jd/{job_id}.md"
        upload_blob(config, container=container, blob_path=blob_path, content=jd_content.encode("utf-8"), content_type="text/markdown")
        _mgmt_logger.info("JD content persisted to blob: %s/%s", container, blob_path)
        return {"container": container, "path": blob_path}
    except Exception as exc:
        _mgmt_logger.warning("JD blob persistence failed for job %s: %s", job_id, exc)
        return None


def _normalize_text(value: object) -> str:
    import re
    text = str(value or "").lower()
    return re.sub(r"\s+", " ", text).strip()


def _extract_present_skills(text: str) -> list[str]:
    import re
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

    try:
        body = req.get_json()
        auto_apply = bool((body or {}).get("auto_apply", False))
    except ValueError:
        auto_apply = False

    try:
        job = store.get_job_by_id(job_id=str(detail.get("job_id") or "")) or {}
        agentic = analyze_application(job=job, application=detail)
        matched_skills = agentic["matched_skills"]
        missing_skills = agentic["missing_skills"]
        strengths_summary = agentic["strengths_summary"]
        gaps_summary = agentic["gaps_summary"]
        score = float(agentic["match_score"])
        recommendation = str(agentic["recommendation"])
        suggested_status = str(agentic["suggested_status"])
    except Exception as exc:
        return error_response(
            error_type="infra",
            message="Failed to run analysis due to internal processing error.",
            trace_id=trace_id,
            req=req,
            status_code=500,
            details={"reason": str(exc)},
        )

    try:
        updated = store.update_analysis_status(
            application_id=application_id, analysis_status="completed",
            analyzed_by=admin["user_name"], recommendation=recommendation, match_score=score,
            matched_skills_json=json.dumps(matched_skills, ensure_ascii=True),
            missing_skills_json=json.dumps(missing_skills, ensure_ascii=True),
            strengths_summary=strengths_summary, gaps_summary=gaps_summary,
        )
    except Exception as exc:
        return error_response(
            error_type="infra",
            message="Failed to persist analysis result.",
            trace_id=trace_id,
            req=req,
            status_code=500,
            details={"reason": str(exc)},
        )
    if not updated:
        return error_response(error_type="infra", message="Failed to update analysis status.", trace_id=trace_id, req=req, status_code=500)

    store.log_admin_action(admin_user_id=admin["user_id"], action_type="run_analysis", entity_type="application", entity_id=application_id, action_detail=f"score={score:.1f};recommendation={recommendation}")

    auto_applied = False
    if auto_apply and suggested_status in ALLOWED_APPLICATION_STATUSES:
        auto_applied = bool(store.update_application_status(application_id=application_id, status=suggested_status))
        if auto_applied:
            store.log_admin_action(
                admin_user_id=admin["user_id"],
                action_type="auto_apply_analysis_status",
                entity_type="application",
                entity_id=application_id,
                action_detail=f"status={suggested_status}",
            )

    return ok_response(trace_id=trace_id, req=req, data={
        "application_id": application_id, "analysis_status": "completed", "match_score": score,
        "recommendation": recommendation, "matched_skills": matched_skills,
        "missing_skills": missing_skills, "strengths_summary": strengths_summary, "gaps_summary": gaps_summary,
        "suggested_status": suggested_status,
        "auto_applied": auto_applied,
        "admin_summary": agentic.get("admin_summary"),
    })


async def _handle_enhance_jd(req: func.HttpRequest, trace_id: str, admin: dict) -> func.HttpResponse:
    try:
        body = req.get_json()
    except ValueError:
        return error_response(error_type="validation", message="Request body must be valid JSON.", trace_id=trace_id, req=req, status_code=400)
    if not isinstance(body, dict):
        return error_response(error_type="validation", message="Request body must be a JSON object.", trace_id=trace_id, req=req, status_code=400)

    title = str(body.get("title") or "").strip()
    if not title:
        return error_response(error_type="validation", message="title is required for JD enhancement.", trace_id=trace_id, req=req, status_code=400)

    enhanced = await enhance_jd_with_existing_llm(
        title=title,
        department=str(body.get("department") or "").strip(),
        location=str(body.get("location") or "").strip(),
        employment_type=str(body.get("employment_type") or "").strip(),
        jd_markdown=str(body.get("jd_markdown") or "").strip(),
    )
    store = get_careers_store()
    if store.is_available:
        store.log_admin_action(
            admin_user_id=admin["user_id"],
            action_type="enhance_jd",
            entity_type="job",
            entity_id=str(body.get("id") or "adhoc"),
            action_detail=f"template_id={enhanced.get('template_id')}",
        )
    return ok_response(trace_id=trace_id, req=req, data=enhanced)


async def _handle_notify_application(req: func.HttpRequest, trace_id: str, admin: dict, application_id: str) -> func.HttpResponse:
    from urllib import error as url_error
    from urllib import request as url_request
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
    jd_file_name = str(body.get("jd_file_name", "")).strip() or None
    jd_file_content_type = _normalize_jd_content_type(jd_file_name, str(body.get("jd_file_content_type", "")))
    jd_content_base64 = str(body.get("jd_content_base64", "")).strip()
    status = str(body.get("status", "draft")).strip().lower()
    requested_job_id = str(body.get("id", "")).strip() or None
    final_job_id = requested_job_id or f"job_{uuid.uuid4().hex}"
    if not title:
        return error_response(error_type="validation", message="'title' is required.", trace_id=trace_id, req=req, status_code=400)
    if not jd_markdown and not jd_content_base64:
        return error_response(error_type="validation", message="Either 'jd_markdown' or 'jd_content_base64' is required.", trace_id=trace_id, req=req, status_code=400)
    if status not in ALLOWED_JOB_STATUSES:
        return error_response(error_type="validation", message="status must be one of: draft, active, archived", trace_id=trace_id, req=req, status_code=400)
    store = get_careers_store()
    if not store.is_available:
        return error_response(error_type="infra", message="Careers store unavailable.", trace_id=trace_id, req=req, status_code=503)
    jd_blob_meta: dict[str, str] | None = None
    if jd_content_base64:
        try:
            jd_bytes = _decode_base64_content(jd_content_base64)
        except Exception as exc:
            return error_response(error_type="validation", message="JD file content is not valid base64.", trace_id=trace_id, req=req, status_code=400, details={"reason": str(exc)})
        if not jd_bytes:
            return error_response(error_type="validation", message="JD file content is empty.", trace_id=trace_id, req=req, status_code=400)
        if not jd_markdown:
            try:
                jd_markdown = jd_bytes.decode("utf-8")
                jd_raw_text = jd_markdown
            except UnicodeDecodeError:
                return error_response(error_type="validation", message="JD file must be UTF-8 text.", trace_id=trace_id, req=req, status_code=400)
        try:
            config, _ = resolve_blob_config_with_reason()
            if config is None:
                return error_response(error_type="infra", message="Blob storage is not configured for JD uploads.", trace_id=trace_id, req=req, status_code=503)
            container = (os.getenv("CAREERS_JD_BLOB_CONTAINER") or "careers-jd-container").strip()
            jd_blob_meta = {"container": container, "path": f"jd/{final_job_id}.md"}
            upload_blob(config, container=container, blob_path=jd_blob_meta["path"], content=jd_markdown.encode("utf-8"), content_type="text/markdown")
        except Exception as exc:
            return error_response(error_type="infra", message="Failed to upload JD content to blob storage.", trace_id=trace_id, req=req, status_code=500, details={"reason": str(exc)})
    try:
        saved = store.upsert_job(
            job_id=final_job_id, title=title,
            department=str(body.get("department", "")).strip() or None, location=str(body.get("location", "")).strip() or None,
            employment_type=str(body.get("employment_type", "")).strip() or None,
            jd_markdown=jd_markdown, jd_raw_text=jd_raw_text,
            jd_blob_path=(jd_blob_meta or {}).get("path") or str(body.get("jd_blob_path", "")).strip() or None,
            jd_blob_container=(jd_blob_meta or {}).get("container") or str(body.get("jd_blob_container", "")).strip() or None,
            status=status, created_by=admin.get("user_name"),
        )
    except Exception as exc:
        return error_response(error_type="infra", message="Failed to save job due to a store error.", trace_id=trace_id, req=req, status_code=500, details={"reason": str(exc)})
    if not saved:
        return error_response(error_type="infra", message="Failed to save job.", trace_id=trace_id, req=req, status_code=500)

    # Also persist JD content to blob storage as backup, if blob is configured.
    if not jd_blob_meta:
        jd_blob_meta = _blob_persist_jd(job_id=str(saved.get("id", "")), jd_content=jd_markdown)

    store.log_admin_action(admin_user_id=admin["user_id"], action_type="upsert_job", entity_type="job", entity_id=str(saved.get("id") or ""), action_detail=f"status={saved.get('status', '')}")
    return ok_response(trace_id=trace_id, req=req, data=saved)


async def _handle_init_jd_upload(req: func.HttpRequest, trace_id: str) -> func.HttpResponse:
    try:
        from azure.storage.blob import BlobSasPermissions, generate_blob_sas  # deferred import
    except ImportError as exc:
        return error_response(
            error_type="infra",
            message="Blob storage SDK is unavailable in the deployment.",
            trace_id=trace_id,
            req=req,
            status_code=503,
            details={"reason": str(exc)},
        )
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
    try:
        config = _blob_config("CAREERS_JD_BLOB_CONTAINER")
    except Exception as exc:
        return error_response(
            error_type="infra",
            message="Blob storage SDK is unavailable in the deployment.",
            trace_id=trace_id,
            req=req,
            status_code=503,
            details={"reason": str(exc)},
        )
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
    try:
        from azure.storage.blob import BlobServiceClient  # deferred import
    except ImportError as exc:
        return error_response(
            error_type="infra",
            message="Blob storage SDK is unavailable in the deployment.",
            trace_id=trace_id,
            req=req,
            status_code=503,
            details={"reason": str(exc)},
        )
    try:
        body = req.get_json()
    except ValueError:
        return error_response(error_type="validation", message="Request body must be valid JSON.", trace_id=trace_id, req=req, status_code=400)
    if not isinstance(body, dict):
        return error_response(error_type="validation", message="Request body must be a JSON object.", trace_id=trace_id, req=req, status_code=400)
    title = str(body.get("title", "")).strip()
    blob_path = str(body.get("blob_path", "")).strip()
    container = str(body.get("blob_container", "")).strip() or (os.getenv("CAREERS_JD_BLOB_CONTAINER") or "careers-jd-container").strip()
    status = str(body.get("status", "draft")).strip().lower()
    if not title or not blob_path:
        return error_response(error_type="validation", message="title and blob_path are required.", trace_id=trace_id, req=req, status_code=400)
    if status not in ALLOWED_JOB_STATUSES:
        return error_response(error_type="validation", message="status must be one of: draft, active, archived", trace_id=trace_id, req=req, status_code=400)
    try:
        service = _blob_service()
    except Exception as exc:
        return error_response(
            error_type="infra",
            message="Blob storage SDK is unavailable in the deployment.",
            trace_id=trace_id,
            req=req,
            status_code=503,
            details={"reason": str(exc)},
        )
    if not service:
        return error_response(error_type="infra", message="Blob storage is not configured.", trace_id=trace_id, req=req, status_code=503)
    jd_content_base64 = str(body.get("jd_content_base64", "")).strip()
    try:
        if jd_content_base64:
            jd_bytes = _decode_base64_content(jd_content_base64)
            if not jd_bytes:
                return error_response(error_type="validation", message="JD file content is empty.", trace_id=trace_id, req=req, status_code=400)
            config, _ = resolve_blob_config_with_reason()
            if config is None:
                return error_response(error_type="infra", message="Blob storage is not configured.", trace_id=trace_id, req=req, status_code=503)
            upload_blob(config, container=container, blob_path=blob_path, content=jd_bytes, content_type=_normalize_jd_content_type(blob_path, str(body.get("content_type", ""))))
            jd_text = jd_bytes.decode("utf-8")
        else:
            blob_client = service.get_blob_client(container=container, blob=blob_path)
            content = blob_client.download_blob().readall()
            jd_text = content.decode("utf-8")
    except UnicodeDecodeError:
        return error_response(error_type="validation", message="Uploaded JD content must be UTF-8 text.", trace_id=trace_id, req=req, status_code=400)
    except Exception as exc:
        return error_response(error_type="infra", message="Unable to read or upload JD file from storage.", trace_id=trace_id, req=req, status_code=400, details={"reason": str(exc)})
    store = get_careers_store()
    if not store.is_available:
        return error_response(error_type="infra", message="Careers store unavailable.", trace_id=trace_id, req=req, status_code=503)
    try:
        saved = store.upsert_job(
            job_id=str(body.get("id", "")).strip() or None, title=title,
            department=str(body.get("department", "")).strip() or None, location=str(body.get("location", "")).strip() or None,
            employment_type=str(body.get("employment_type", "")).strip() or None,
            jd_markdown=jd_text, jd_raw_text=jd_text, jd_blob_path=blob_path, jd_blob_container=container,
            status=status, created_by=admin.get("user_name"),
        )
    except Exception as exc:
        return error_response(error_type="infra", message="Failed to publish uploaded JD due to a store error.", trace_id=trace_id, req=req, status_code=500, details={"reason": str(exc)})
    if not saved:
        return error_response(error_type="infra", message="Failed to publish uploaded JD.", trace_id=trace_id, req=req, status_code=500)
    store.log_admin_action(admin_user_id=admin["user_id"], action_type="publish_job_from_upload", entity_type="job", entity_id=str(saved.get("id") or ""), action_detail=f"container={container};path={blob_path};status={status}")
    return ok_response(trace_id=trace_id, req=req, data=saved)


# ── Main Router ────────────────────────────────────────────────────────────


async def main(req: func.HttpRequest) -> func.HttpResponse:
    from security.admin_auth import AdminAuthError, require_role  # deferred import

    trace_id = get_trace_id(req)
    if req.method == "OPTIONS":
        return options_response(trace_id=trace_id, req=req)

    # Authenticate — allow both admin and employer roles for careers management
    try:
        admin = require_role(req, allowed_roles=["admin", "employer"])
    except AdminAuthError as exc:
        return error_response(error_type="validation", message=str(exc), trace_id=trace_id, req=req, status_code=401)

    path = str(req.params.get("_path") or "").strip()
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

    # ── POST /jd/enhance (enhance JD content) ──────────────────────────────
    if req.method == "POST" and primary == "jd" and len(segments) == 2 and segments[1] == "enhance":
        return await _handle_enhance_jd(req, trace_id, admin)

    # ── POST /jobs/from-upload (publish from uploaded JD) ─────────────────
    if req.method == "POST" and primary == "jobs" and len(segments) == 2 and segments[1] == "from-upload":
        return await _handle_publish_from_upload(req, trace_id, admin)

    # ── POST /cleanup (clean stale drafts) ────────────────────────────────
    if req.method == "POST" and primary == "cleanup" and len(segments) == 1:
        return await _handle_cleanup(req, trace_id, admin)

    # ── Fallback 404 ──────────────────────────────────────────────────────
    return error_response(error_type="validation", message=f"Unknown careers/manage endpoint: {path}", trace_id=trace_id, req=req, status_code=404)
