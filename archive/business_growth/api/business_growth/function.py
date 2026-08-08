import importlib
import os
import sys

import azure.functions as func

script_dir = os.path.dirname(os.path.abspath(__file__))
api_root = os.path.join(script_dir, "..")
shared_path = os.path.join(api_root, "shared")

if api_root not in sys.path:
    sys.path.insert(0, api_root)
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

from business_growth.shared.http import error_response


ROUTE_MODULE_MAP = {
    "intake": "intake_submit",
    "health/worker": "health_worker",
    "audit/start": "audit_start",
    "audit/summary": "audit_summary",
    "audit/pages": "audit_pages",
    "audit/issues": "audit_issues",
    "diagnosis/generate": "diagnosis_generate",
    "diagnosis": "diagnosis_get",
    "roadmap/generate": "roadmap_generate",
    "roadmap": "roadmap_get",
    "roadmap/update": "roadmap_update",
    "guidance/generate": "guidance_generate",
    "review/start": "review_start",
    "review/approve": "review_approve",
    "review/history": "review_history",
    "journey": "journey_get",
    "report/preview": "report_preview",
    "kpi": "kpi_get",
    "kpi/record": "kpi_record",
}


def _normalize_path(req: func.HttpRequest) -> str:
    wildcard = (req.route_params or {}).get("path") or ""
    return str(wildcard).strip("/")


def main(req: func.HttpRequest) -> func.HttpResponse:
    path = _normalize_path(req)
    module_name = ROUTE_MODULE_MAP.get(path)

    if not module_name:
        return error_response(req, f"Unknown business growth route: {path}", status_code=404)

    try:
        module = importlib.import_module(f"business_growth.{module_name}.__init__")
    except Exception as exc:
        return error_response(req, f"Route load failure for '{path}': {str(exc)}", status_code=500)

    try:
        return module.main(req)
    except Exception as exc:
        return error_response(req, f"Route execution failure for '{path}': {str(exc)}", status_code=500)