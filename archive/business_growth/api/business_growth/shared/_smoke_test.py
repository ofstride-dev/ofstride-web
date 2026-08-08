"""Quick smoke test for the Phase 2 crawler parser + rules (run with .venv312)."""
import sys

sys.path.insert(0, "api")

from business_growth.shared.crawler import _parse_page  # noqa: E402
from business_growth.shared.rules import detect_page_issues  # noqa: E402

HTML = """<html><head><title>Short</title></head>
<body><h1>Hi</h1>
<a href="/about">About</a>
<img src="x"><img src="y" alt="hi">
</body></html>"""

parsed = _parse_page(HTML, "https://ex.com/")
print("title=", repr(parsed["title"]))
print("meta=", repr(parsed["meta_description"]))
print("h1=", repr(parsed["h1"]))
print("viewport=", parsed["has_viewport_meta"])
print("links=", parsed["link_count"])
print("imgs=", parsed["image_count"])
print("no_alt=", parsed["images_without_alt"])
print("text_len=", parsed["text_length"])
print("internal=", parsed["internal_hrefs"])

issues = detect_page_issues("RUN", "PAGE", parsed)
print("detected rules:", [i["rule_id"] for i in issues])
print("issue_count=", len(issues))
