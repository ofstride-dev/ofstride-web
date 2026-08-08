import importlib
import os

import azure.functions as func

from business_growth.shared.http import json_response, options_response


def _check_worker_importable() -> tuple[bool, str | None]:
    try:
        importlib.import_module("business_growth.audit_worker.__init__")
        return True, None
    except Exception as exc:
        return False, str(exc)


def _check_wrapper_present() -> tuple[bool, str | None]:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    wrapper_fn = os.path.join(script_dir, "..", "..", "business_growth_audit_worker", "function.json")
    exists = os.path.exists(wrapper_fn)
    return exists, None if exists else "Top-level queue trigger wrapper not found"


def _check_storage_configured() -> tuple[bool, str | None]:
    has_value = bool((os.environ.get("AzureWebJobsStorage") or "").strip())
    return has_value, None if has_value else "AzureWebJobsStorage is missing"


def _check_queue_sdk() -> tuple[bool, str | None]:
    try:
        importlib.import_module("azure.storage.queue")
        return True, None
    except Exception as exc:
        return False, str(exc)


def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response(req)

    checks = {
        "worker_importable": _check_worker_importable(),
        "wrapper_present": _check_wrapper_present(),
        "storage_configured": _check_storage_configured(),
        "queue_sdk": _check_queue_sdk(),
    }

    payload_checks = {}
    ok = True
    for key, (passed, message) in checks.items():
        payload_checks[key] = {"ok": passed, "message": message}
        ok = ok and passed

    return json_response(
        req,
        {
            "ok": ok,
            "checks": payload_checks,
        },
        status_code=200 if ok else 503,
    )
