"""Multi-page website crawler (BFS over internal links).

Replaces the single-page crawl in audit_worker. Discovers internal links up to
max_pages / max_depth, parses each page, and returns parsed page results +
issues + a computed technical score. DB persistence is left to the caller
(audit_worker) so this module stays pure and testable.

Public API:
    crawl_and_score(root_url, max_pages, max_depth) -> CrawlResult
"""
from __future__ import annotations

import time
from urllib import request as urllib_request
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

from business_growth.shared.rules import detect_page_issues, detect_broken_links
from business_growth.shared.scoring import compute_technical_score


def _same_host(url: str, root: str) -> bool:
    try:
        return urlparse(url).netloc == urlparse(root).netloc
    except Exception:
        return False


def _normalize(url: str) -> str:
    """Strip fragment; keep path/query."""
    if url and not urlparse(url).scheme:
        url = f"https://{url}"
    p = urlparse(url)
    return p._replace(fragment="").geturl()


def _is_http_url(url: str) -> bool:
    try:
        return urlparse(url).scheme in {"http", "https"}
    except Exception:
        return False


def _fetch_html(session, url: str, timeout: int = 15) -> tuple[int, str]:
    """Fetch HTML with a browser-like UA and stdlib fallback.

    Keeps dependencies light while improving compatibility with sites that
    reject default client signatures.
    """
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/127.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        resp = session.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        return resp.status_code, resp.text or ""
    except Exception:
        pass

    req = urllib_request.Request(url, headers=headers)
    with urllib_request.urlopen(req, timeout=timeout) as response:
        status = int(getattr(response, "status", 200) or 200)
        raw = response.read()
        charset = response.headers.get_content_charset() or "utf-8"
        return status, raw.decode(charset, errors="replace")


def _parse_page(html: str, url: str) -> dict:
    """Extract on-page fields from raw HTML."""
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

    links = [a.get("href") for a in soup.find_all("a", href=True)]
    images = soup.find_all("img")
    images_no_alt = sum(1 for img in images if not (img.get("alt") or "").strip())
    text = soup.get_text(" ", strip=True)
    text_length = len(text.split())

    internal_hrefs = []
    for href in links:
        abs_url = _normalize(urljoin(url, href))
        if _is_http_url(abs_url) and _same_host(abs_url, url):
            internal_hrefs.append(abs_url)

    return {
        "url": url,
        "status_code": 200,
        "title": title,
        "meta_description": meta_desc,
        "h1": h1,
        "canonical": canonical,
        "has_viewport_meta": has_viewport,
        "link_count": len(links),
        "image_count": len(images),
        "images_without_alt": images_no_alt,
        "text_length": text_length,
        "internal_hrefs": list(dict.fromkeys(internal_hrefs)),  # dedup, preserve order
    }


def crawl_and_score(root_url: str, max_pages: int = 50, max_depth: int = 3, max_runtime_seconds: int = 120) -> dict:
    """BFS-crawl internal pages from root_url. Returns:
        {pages: [...parsed...], issues: [...issue dicts w/o ids...],
         broken_links: {page_url: [bad urls]}, page_count, technical_score}
    Network/parse failures are recorded as failed pages, not raised, so the
    whole crawl is resilient.
    """
    import requests  # lazy import: keeps module importable without the dep

    root_url = _normalize(root_url)
    visited: set[str] = set()
    queue = [(root_url, 0, None)]
    pages: list[dict] = []
    all_issues: list[dict] = []
    broken_links: dict[str, list[str]] = {}
    session = requests.Session()
    started_at = time.monotonic()

    while queue and len(pages) < max_pages:
        if (time.monotonic() - started_at) >= max_runtime_seconds:
            break

        url, depth, source_url = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)

        try:
            status_code, html = _fetch_html(session, url, timeout=15)
            if status_code >= 400:
                broken_links.setdefault(source_url or root_url, []).append(url)
                continue
        except Exception:
            broken_links.setdefault(source_url or root_url, []).append(url)
            continue

        parsed = _parse_page(html, url)
        parsed["status_code"] = status_code
        pages.append(parsed)

        page_issues = detect_page_issues("__RUN__", "__PAGE__", parsed)
        for issue in page_issues:
            issue["_page_url"] = url
            all_issues.append(issue)

        if depth < max_depth:
            for href in parsed["internal_hrefs"]:
                if href not in visited and href not in [q[0] for q in queue]:
                    queue.append((href, depth + 1, url))

    for page in pages:
        bad = broken_links.get(page["url"], [])
        if bad:
            bl_issues = detect_broken_links("__RUN__", "__PAGE__", bad)
            for issue in bl_issues:
                issue["_page_url"] = page["url"]
            all_issues.extend(bl_issues)

    score = compute_technical_score(all_issues)

    return {
        "pages": pages,
        "issues": all_issues,
        "broken_links": broken_links,
        "page_count": len(pages),
        "technical_score": score,
    }
