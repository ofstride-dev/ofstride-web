import uuid
from typing import Any

import azure.functions as func


ALLOWED_ROLES = {"admin", "finance", "employer"}


def _get_header(req: func.HttpRequest, name: str) -> str | None:
    # Header lookups are usually case-insensitive, but this fallback keeps
    # behavior predictable across local mocks and runtime adapters.
    direct = req.headers.get(name)
    if direct is not None:
        return str(direct).strip() or None

    lowered = req.headers.get(name.lower())
    if lowered is not None:
        return str(lowered).strip() or None

    uppered = req.headers.get(name.upper())
    if uppered is not None:
        return str(uppered).strip() or None

    return None


def _is_valid_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except (ValueError, TypeError, AttributeError):
        return False


def validate_identity_headers(req: func.HttpRequest) -> dict[str, Any]:
    user_id = _get_header(req, "x-user-id")
    role_raw = _get_header(req, "x-app-role")
    role = (role_raw or "").strip().lower()

    # Fallback path: if explicit cashflow headers are missing, try validating
    # Supabase bearer auth and role using the shared security auth module.
    if not user_id or not role:
        try:
            from shared.security.admin_auth import require_role

            auth = require_role(req, ["admin", "finance", "employer"])
            bearer_user_id = str(auth.get("user_id") or "").strip()
            bearer_role = str(auth.get("role") or "").strip().lower()

            if bearer_user_id and bearer_role in ALLOWED_ROLES and _is_valid_uuid(bearer_user_id):
                return {
                    "ok": True,
                    "status_code": 200,
                    "error": None,
                    "identity": {
                        "user_id": bearer_user_id,
                        "role": bearer_role,
                    },
                }
        except Exception:
            # Keep original explicit-header validation errors below.
            pass

    if not user_id:
        return {
            "ok": False,
            "status_code": 401,
            "error": "Missing required header: x-user-id",
        }

    if not _is_valid_uuid(user_id):
        return {
            "ok": False,
            "status_code": 401,
            "error": "Invalid x-user-id format. Expected UUID.",
        }

    if not role:
        return {
            "ok": False,
            "status_code": 401,
            "error": "Missing required header: x-app-role",
        }

    if role not in ALLOWED_ROLES:
        return {
            "ok": False,
            "status_code": 403,
            "error": "Unauthorized: Admin, Finance, or Employer role required",
        }

    return {
        "ok": True,
        "status_code": 200,
        "error": None,
        "identity": {
            "user_id": user_id,
            "role": role,
        },
    }


def validate_admin_or_finance(req: func.HttpRequest) -> bool:
    return bool(validate_identity_headers(req).get("ok"))