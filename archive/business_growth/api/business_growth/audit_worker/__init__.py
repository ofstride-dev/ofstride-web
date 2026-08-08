import azure.functions as func
import json
import logging

from business_growth.shared.crawler import crawl_and_score
from business_growth.shared.db import get_supabase
from business_growth.shared.run_status import mark_complete, mark_crawling, mark_failed


logger = logging.getLogger("business_growth.audit_worker")


def _persist(supa, audit_run_id: str, result: dict) -> tuple[int, int]:
    """Persist crawled pages + issues with real ids. Returns (page_count, score)."""
    issues_rows = []
    for page_data in result["pages"]:
        page = supa.table("audit_page").insert({
            "audit_run_id": audit_run_id,
            "url": page_data["url"],
            "status_code": page_data["status_code"],
            "title": page_data["title"],
            "meta_description": page_data["meta_description"],
            "h1": page_data["h1"],
            "canonical": page_data["canonical"],
            "has_viewport_meta": page_data["has_viewport_meta"],
            "link_count": page_data["link_count"],
            "image_count": page_data["image_count"],
            "is_indexable": True,
        }).execute()
        page_id = page.data[0]["id"]

        for issue in result["issues"]:
            if issue.get("_page_url") != page_data["url"]:
                continue
            issue["audit_run_id"] = audit_run_id
            issue["audit_page_id"] = page_id
            issues_rows.append(issue)

    if issues_rows:
        supa.table("issue_finding").insert(issues_rows).execute()

    return result["page_count"], result["technical_score"]


def _decode_message(msg: func.QueueMessage) -> dict:
    """Decode queue payload into a dict.

    Handles both standard JSON objects and double-encoded JSON strings.
    """
    raw = msg.get_body().decode("utf-8")
    data = json.loads(raw)
    if isinstance(data, str):
        data = json.loads(data)
    if not isinstance(data, dict):
        raise ValueError("Queue payload must be a JSON object")
    return data


def main(msg: func.QueueMessage) -> None:
    audit_run_id = None
    supa = None
    try:
        data = _decode_message(msg)
        audit_run_id = data.get("audit_run_id")
        root_url = data.get("root_url")
        max_pages = int(data.get("max_pages") or 50)
        max_depth = int(data.get("max_depth") or 3)
        if not audit_run_id or not root_url:
            raise ValueError("Missing audit_run_id or root_url in queue message")

        supa = get_supabase()
        mark_crawling(supa, audit_run_id)
        logger.info("audit_worker started audit_run_id=%s root_url=%s", audit_run_id, root_url)
        result = crawl_and_score(root_url, max_pages, max_depth)

        if int(result.get("page_count") or 0) == 0:
            mark_failed(
                supa,
                audit_run_id,
                "Audit could not crawl any pages. The site may block bots, be unreachable, or require JavaScript rendering.",
            )
            logger.warning("audit_worker zero-page crawl audit_run_id=%s root_url=%s", audit_run_id, root_url)
            return

        page_count, score = _persist(supa, audit_run_id, result)
        try:
            mark_complete(supa, audit_run_id, page_count, score)
            logger.info(
                "audit_worker completed audit_run_id=%s pages=%s score=%s",
                audit_run_id,
                page_count,
                score,
            )
        except Exception as terminal_exc:
            mark_failed(supa, audit_run_id, f"Failed to finalize audit run: {terminal_exc}")
            logger.exception("audit_worker failed to mark complete audit_run_id=%s", audit_run_id)
    except Exception as exc:
        if not audit_run_id:
            # Force retry/poison handling when message format is bad instead of
            # silently consuming and stranding the run at queued.
            raise
        if supa is None:
            try:
                supa = get_supabase()
            except Exception:
                return
        mark_failed(supa, audit_run_id, f"audit_worker error: {exc}")
        logger.exception("audit_worker crashed audit_run_id=%s", audit_run_id)