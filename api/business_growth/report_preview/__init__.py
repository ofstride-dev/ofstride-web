import html

import azure.functions as func

from business_growth.shared.db import get_supabase
from business_growth.shared.http import error_response, json_response, options_response


def _badge_class(severity: str) -> str:
    sev = (severity or "").lower()
    if sev == "critical":
        return "sev-critical"
    if sev == "high":
        return "sev-high"
    if sev == "medium":
        return "sev-medium"
    return "sev-low"


def _render_report(payload: dict) -> str:
    diagnosis = payload.get("diagnosis") or {}
    roadmap = payload.get("roadmap") or []
    top_issues = payload.get("top_issues") or []
    examples = payload.get("examples") or []

    blockers = diagnosis.get("blockers") or []
    opportunities = diagnosis.get("opportunities") or []

    roadmap_rows = "".join(
        [
            (
                "<tr>"
                f"<td>{html.escape(str(item.get('title') or 'Untitled'))}</td>"
                f"<td>{html.escape(str(item.get('domain') or '-'))}</td>"
                f"<td>{html.escape(str(item.get('status') or '-'))}</td>"
                f"<td>{html.escape(str(item.get('priority_score') or '-'))}</td>"
                "</tr>"
            )
            for item in roadmap
        ]
    )

    issue_rows = "".join(
        [
            (
                "<li>"
                f"<span class='badge {_badge_class(str(issue.get('severity') or 'low'))}'>{html.escape(str(issue.get('severity') or 'low'))}</span> "
                f"{html.escape(str(issue.get('description') or issue.get('rule_id') or 'Issue'))}"
                "</li>"
            )
            for issue in top_issues
        ]
    )

    example_rows = "".join(
        [
            (
                "<div class='example-card'>"
                f"<h4>{html.escape(str(ex.get('type') or 'Change'))}</h4>"
                f"<p><strong>Before:</strong> {html.escape(str(ex.get('before') or '-'))}</p>"
                f"<p><strong>After:</strong> {html.escape(str(ex.get('after') or '-'))}</p>"
                "</div>"
            )
            for ex in examples
        ]
    )

    return f"""
<!doctype html>
<html lang='en'>
<head>
  <meta charset='utf-8' />
  <meta name='viewport' content='width=device-width,initial-scale=1' />
  <title>Business Growth Report Preview</title>
  <style>
    body {{ font-family: 'Segoe UI', Tahoma, sans-serif; margin: 32px; color: #0f172a; background: #f8fafc; }}
    .report {{ background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; }}
    h1 {{ margin: 0 0 8px; font-size: 28px; }}
    h2 {{ margin: 24px 0 12px; font-size: 20px; }}
    p {{ line-height: 1.5; }}
    .kpi {{ display: inline-block; margin-right: 16px; padding: 10px 14px; border-radius: 12px; background: #eff6ff; border: 1px solid #bfdbfe; }}
    ul {{ margin: 8px 0 0 20px; }}
    .badge {{ display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; text-transform: uppercase; margin-right: 8px; }}
    .sev-critical {{ background: #ffe4e6; color: #9f1239; }}
    .sev-high {{ background: #ffedd5; color: #9a3412; }}
    .sev-medium {{ background: #fef3c7; color: #92400e; }}
    .sev-low {{ background: #dcfce7; color: #166534; }}
    table {{ width: 100%; border-collapse: collapse; }}
    th, td {{ border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 14px; }}
    th {{ background: #f1f5f9; }}
    .example-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }}
    .example-card {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }}
  </style>
</head>
<body>
  <article class='report'>
    <h1>Executive Summary</h1>
    <p>This report summarizes the growth diagnosis and prioritized implementation roadmap.</p>
    <div>
      <span class='kpi'>Maturity Stage: <strong>{html.escape(str(diagnosis.get('maturity_stage') or '-'))}</strong></span>
      <span class='kpi'>Overall Score: <strong>{html.escape(str(diagnosis.get('overall_score') or '-'))}</strong></span>
      <span class='kpi'>Roadmap Items: <strong>{len(roadmap)}</strong></span>
    </div>

    <h2>Top Issues</h2>
    <ul>{issue_rows or '<li>No issues available</li>'}</ul>

    <h2>Key Blockers</h2>
    <ul>{''.join([f"<li>{html.escape(str(b))}</li>" for b in blockers]) or '<li>No blockers</li>'}</ul>

    <h2>Opportunities</h2>
    <ul>{''.join([f"<li>{html.escape(str(o))}</li>" for o in opportunities]) or '<li>No opportunities</li>'}</ul>

    <h2>Priority Roadmap</h2>
    <table>
      <thead>
        <tr><th>Title</th><th>Domain</th><th>Status</th><th>Priority</th></tr>
      </thead>
      <tbody>{roadmap_rows or "<tr><td colspan='4'>No roadmap items found</td></tr>"}</tbody>
    </table>

    <h2>Before and After Examples</h2>
    <div class='example-grid'>{example_rows or '<p>No before/after examples available yet.</p>'}</div>
  </article>
</body>
</html>
"""


def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response(req)

    diagnosis_id = req.params.get("growth_diagnosis_id")
    if not diagnosis_id:
        try:
            body = req.get_json()
        except Exception:
            body = {}
        diagnosis_id = body.get("growth_diagnosis_id") if isinstance(body, dict) else None

    if not diagnosis_id:
        return error_response(req, "Missing growth_diagnosis_id", status_code=400)

    supa = get_supabase()

    diagnosis_rows = supa.table("growth_diagnosis").select("*").eq("id", diagnosis_id).execute().data or []
    if not diagnosis_rows:
        return error_response(req, "Diagnosis not found", status_code=404)

    diagnosis = diagnosis_rows[0]
    audit_run_id = diagnosis.get("audit_run_id")

    roadmap = (
        supa.table("roadmap_item")
        .select("*")
        .eq("growth_diagnosis_id", diagnosis_id)
        .order("priority_score", desc=True)
        .execute()
        .data
        or []
    )

    top_issues = []
    examples = []
    if audit_run_id:
        top_issues = (
            supa.table("issue_finding")
            .select("rule_id,severity,description,evidence")
            .eq("audit_run_id", audit_run_id)
            .order("created_at", desc=True)
            .limit(8)
            .execute()
            .data
            or []
        )

        for issue in top_issues:
            rule_id = str(issue.get("rule_id") or "")
            evidence = issue.get("evidence") or {}
            if rule_id == "title_too_short":
                examples.append({
                    "type": "Title",
                    "before": evidence.get("title") or "(missing title)",
                    "after": "Business Growth Strategy | Ofstride",
                })
            if rule_id == "meta_description_weak":
                examples.append({
                    "type": "Meta Description",
                    "before": evidence.get("meta_description") or "(missing meta description)",
                    "after": "Drive measurable growth with consultant-led implementation and clear roadmap milestones.",
                })
            if rule_id == "missing_h1":
                examples.append({
                    "type": "H1",
                    "before": "No H1",
                    "after": "Accelerate Business Growth With a 90-Day Plan",
                })
            if len(examples) >= 4:
                break

    report_payload = {
        "diagnosis": diagnosis,
        "roadmap": roadmap,
        "top_issues": top_issues,
        "examples": examples,
    }

    rendered = _render_report(report_payload)

    return json_response(
        req,
        {
            "growth_diagnosis_id": diagnosis_id,
            "html": rendered,
            "summary": {
                "overall_score": diagnosis.get("overall_score"),
                "maturity_stage": diagnosis.get("maturity_stage"),
                "roadmap_items": len(roadmap),
                "issues_considered": len(top_issues),
            },
        },
    )
