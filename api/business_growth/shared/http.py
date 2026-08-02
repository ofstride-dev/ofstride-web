import json
from typing import Any

import azure.functions as func


def _resolve_origin(req: func.HttpRequest) -> str:
    origin = (req.headers.get("Origin") or req.headers.get("origin") or "").strip()
    allowed = {
        "http://localhost:5173",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
        "https://localhost:5173",
    }
    if origin in allowed:
        return origin
    return "http://localhost:5173"


def cors_headers(req: func.HttpRequest) -> dict[str, str]:
    return {
        "Access-Control-Allow-Origin": _resolve_origin(req),
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Trace-Id, X-Requested-With",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
    }


def options_response(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(status_code=204, headers=cors_headers(req))


def json_response(req: func.HttpRequest, data: Any, status_code: int = 200) -> func.HttpResponse:
    headers = cors_headers(req)
    headers["Content-Type"] = "application/json"
    return func.HttpResponse(json.dumps(data), status_code=status_code, headers=headers)


def error_response(req: func.HttpRequest, message: str, status_code: int = 400) -> func.HttpResponse:
    return json_response(req, {"error": message}, status_code=status_code)