import azure.functions as func
import json
import requests
from bs4 import BeautifulSoup
from business_growth.shared.db import get_supabase

def main(msg: func.QueueMessage) -> None:
    data = json.loads(msg.get_body().decode("utf-8"))
    audit_run_id = data["audit_run_id"]
    root_url = data["root_url"]

    supa = get_supabase()
    supa.table("audit_run").update({"status": "crawling"}).eq("id", audit_run_id).execute()

    try:
        resp = requests.get(root_url, timeout=15)
        status_code = resp.status_code
        html = resp.text
    except Exception:
        supa.table("audit_run").update({"status": "failed"}).eq("id", audit_run_id).execute()
        return

    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.string.strip() if soup.title and soup.title.string else ""
    meta_desc = ""
    h1 = ""
    canonical = ""
    has_viewport = False

    for meta in soup.find_all("meta"):
        name = (meta.get("name") or "").lower()
        if name == "description":
            meta_desc = meta.get("content", "") or ""
        if name == "viewport":
            has_viewport = True

    canon = soup.find("link", rel=lambda v: v and "canonical" in v)
    if canon and canon.get("href"):
        canonical = canon.get("href")

    h1_tag = soup.find("h1")
    if h1_tag:
        h1 = h1_tag.get_text(strip=True)

    links = soup.find_all("a", href=True)
    images = soup.find_all("img")

    page = supa.table("audit_page").insert({
        "audit_run_id": audit_run_id,
        "url": root_url,
        "status_code": status_code,
        "title": title,
        "meta_description": meta_desc,
        "h1": h1,
        "canonical": canonical,
        "has_viewport_meta": has_viewport,
        "link_count": len(links),
        "image_count": len(images),
        "is_indexable": True,
    }).execute()

    page_id = page.data[0]["id"]
    issues = []

    if not title or len(title) < 10:
        issues.append({
            "audit_run_id": audit_run_id,
            "audit_page_id": page_id,
            "category": "onpage",
            "rule_id": "title_too_short",
            "severity": "high",
            "description": "Page title is missing or too short.",
            "evidence": {"title": title},
        })
    if not meta_desc or len(meta_desc) < 50:
        issues.append({
            "audit_run_id": audit_run_id,
            "audit_page_id": page_id,
            "category": "onpage",
            "rule_id": "meta_description_weak",
            "severity": "medium",
            "description": "Meta description is missing or too short.",
            "evidence": {"meta_description": meta_desc},
        })
    if not h1:
        issues.append({
            "audit_run_id": audit_run_id,
            "audit_page_id": page_id,
            "category": "onpage",
            "rule_id": "missing_h1",
            "severity": "medium",
            "description": "Page has no H1 heading.",
            "evidence": {},
        })

    if issues:
        supa.table("issue_finding").insert(issues).execute()

    supa.table("audit_run").update({
        "status": "complete",
        "page_count": 1,
        "technical_score": 70,
    }).eq("id", audit_run_id).execute()