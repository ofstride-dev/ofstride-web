import azure.functions as func
import os
from datetime import datetime, timezone

from business_growth.shared.db import get_supabase
from business_growth.shared.http import error_response, json_response, options_response
from business_growth.shared.run_status import mark_failed
from business_growth.shared.scoring import compute_technical_score


def _parse_iso(value: str | None) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def _int_env(name: str, default: int) -> int:
    raw = (os.environ.get(name) or "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except Exception:
        return default


def _is_stale_non_terminal(run: dict) -> bool:
    status = (run or {}).get("status")
    if status not in {"queued", "crawling"}:
        return False

    timeout_seconds = _int_env("BUSINESS_GROWTH_AUDIT_STALE_SECONDS", 300)
    now = datetime.now(timezone.utc)
    updated_at = _parse_iso((run or {}).get("updated_at"))
    created_at = _parse_iso((run or {}).get("created_at"))
    anchor = updated_at or created_at
    if anchor is None:
        return False

    if anchor.tzinfo is None:
        anchor = anchor.replace(tzinfo=timezone.utc)

    return (now - anchor).total_seconds() >= timeout_seconds


def _hydrate_metrics_from_children(supa, audit_run_id: str, run: dict) -> dict:
    """Fill missing summary metrics from persisted crawl rows.

    This keeps summary cards consistent even when audit_run counters lag behind
    inserted audit_page/issue_finding rows.
    """
    hydrated = dict(run or {})
    current_page_count = int((hydrated or {}).get("page_count") or 0)
    current_score = hydrated.get("technical_score")

    page_rows = (
        supa.table("audit_page")
        .select("id")
        .eq("audit_run_id", audit_run_id)
        .execute()
        .data
        or []
    )
    derived_page_count = len(page_rows)
    if derived_page_count > current_page_count:
        hydrated["page_count"] = derived_page_count

    if current_score is None:
        issue_rows = (
            supa.table("issue_finding")
            .select("severity")
            .eq("audit_run_id", audit_run_id)
            .execute()
            .data
            or []
        )
        # A score of 100 with no issues is valid and should be explicit.
        hydrated["technical_score"] = compute_technical_score(issue_rows)

    return hydrated

def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response(req)

    audit_run_id = req.params.get("audit_run_id")
    if not audit_run_id:
        return error_response(req, "Missing audit_run_id", status_code=400)

    supa = get_supabase()
    res = supa.table("audit_run").select("*").eq("id", audit_run_id).execute()
    if not res.data:
        return error_response(req, "Not found", status_code=404)

    run = res.data[0]
    if _is_stale_non_terminal(run):
        mark_failed(
            supa,
            audit_run_id,
            "Audit timed out before completion. Please re-run with a reachable URL or fewer pages.",
        )
        res = supa.table("audit_run").select("*").eq("id", audit_run_id).execute()
        if not res.data:
            return error_response(req, "Not found", status_code=404)
        run = res.data[0]

    run = _hydrate_metrics_from_children(supa, audit_run_id, run)

    return json_response(req, run)