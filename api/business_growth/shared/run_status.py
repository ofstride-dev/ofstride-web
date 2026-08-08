"""Terminal-status helpers for audit_run rows.

Guarantees that every audit_run reaches a terminal state (complete/failed)
with a populated completed_at, so the UI never sees a stranded
queued/crawling row. Used by audit_worker (and audit_start on enqueue failure).
"""
from datetime import datetime, timezone


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def mark_terminal_status(
    supa,
    audit_run_id: str,
    status: str,
    *,
    page_count: int | None = None,
    technical_score: int | None = None,
    error_message: str | None = None,
) -> None:
    """Write a terminal audit_run status with consistent fields.

    This centralizes terminal-write semantics so all callers (start/worker)
    stamp completed_at and optional diagnostics the same way.
    """
    payload = {
        "status": status,
        "completed_at": _now_iso(),
    }
    if page_count is not None:
        payload["page_count"] = page_count
    if technical_score is not None:
        payload["technical_score"] = technical_score
    if error_message is not None:
        payload["error_message"] = str(error_message)[:500]
    elif status == "complete":
        payload["error_message"] = None

    supa.table("audit_run").update(payload).eq("id", audit_run_id).execute()


def mark_crawling(supa, audit_run_id: str) -> None:
    """Transition a run to crawling (non-terminal). Best-effort."""
    try:
        supa.table("audit_run").update({"status": "crawling"}).eq("id", audit_run_id).execute()
    except Exception:
        pass


def mark_complete(supa, audit_run_id: str, page_count: int, technical_score: int) -> None:
    """Terminal success: complete + completed_at + scores."""
    mark_terminal_status(
        supa,
        audit_run_id,
        "complete",
        page_count=page_count,
        technical_score=technical_score,
    )


def mark_failed(supa, audit_run_id: str, error_message: str) -> None:
    """Terminal failure: failed + completed_at + error_message."""
    try:
        mark_terminal_status(
            supa,
            audit_run_id,
            "failed",
            error_message=error_message,
        )
    except Exception:
        # Last-resort: we must not raise from a terminal write or the message
        # will retry forever. Swallow DB errors here.
        pass
