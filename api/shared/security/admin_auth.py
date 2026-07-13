"""Admin authentication for Azure Functions careers endpoints.

Phase 0 implementation (unblock):
- Recreates the missing ``require_admin`` / ``AdminAuthError`` contract so the
  eight admin_careers_* functions can import and load.
- Supports Supabase JWT verification when SUPABASE_URL (and optionally
  SUPABASE_JWT_SECRET) are configured.
- Falls back to a server-side x-admin-key comparison using ADMIN_API_KEY in
  dev/test environments only. This is intentionally temporary and will be
  removed once Supabase Auth is fully wired on the frontend.

Expected shape of the returned admin context::

    {
        "user_id": str,      # matches the JWT 'sub' claim or local id
        "user_name": str,    # email, name, or local label
    }

The existing store.log_admin_action(admin_user_id=..., ...) calls keep working
because both keys are always present.
"""

from __future__ import annotations

import hmac
import logging
import os
from typing import Any

import azure.functions as func
import jwt

_logger = logging.getLogger("ofstride.admin_auth")


class AdminAuthError(Exception):
    """Raised when an admin request fails authentication or authorization."""


# ---------------------------------------------------------------------------
# Environment helpers
# ---------------------------------------------------------------------------


def _env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip() or default


def _is_local_key_allowed() -> bool:
    """Local key fallback is only safe in dev/test or when explicitly enabled."""
    env = (_env("ENV") or "").lower()
    if env in {"dev", "development", "local", "test"}:
        return True
    return _env("ADMIN_DEV_AUTH_FALLBACK", "false").lower() in {"1", "true", "yes", "on"}


def _get_allowed_admin_roles() -> set[str]:
    raw = _env("ADMIN_ALLOWED_ROLES", "admin")
    return {role.strip().lower() for role in raw.split(",") if role.strip()}


def _get_allowed_admin_emails() -> set[str]:
    raw = _env("ADMIN_ALLOWED_EMAILS", "")
    return {email.strip().lower() for email in raw.split(",") if email.strip()}


# ---------------------------------------------------------------------------
# Request extraction
# ---------------------------------------------------------------------------


def _extract_bearer_token(req: func.HttpRequest) -> str | None:
    auth_header = req.headers.get("Authorization") or req.headers.get("authorization")
    if not auth_header:
        return None
    parts = auth_header.strip().split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


def _extract_admin_key(req: func.HttpRequest) -> str | None:
    return (
        req.headers.get("x-admin-key")
        or req.headers.get("X-Admin-Key")
        or req.headers.get("X-ADMIN-KEY")
    )

# ---------------------------------------------------------------------------
# Supabase JWT verification
# ---------------------------------------------------------------------------


def _verify_supabase_jwt(token: str) -> dict[str, Any]:
    """Verify a Supabase Auth access token and confirm admin privileges."""
    supabase_url = _env("SUPABASE_URL")
    if not supabase_url:
        raise AdminAuthError("Supabase authentication is not configured.")

    issuer = supabase_url.rstrip("/") + "/auth/v1"
    audience = _env("SUPABASE_AUTH_AUDIENCE", "authenticated")
    jwt_secret = _env("SUPABASE_JWT_SECRET")

    try:
        if jwt_secret:
            # Hosted/self-hosted Supabase configured with the JWT secret.
            payload = jwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256"],
                audience=audience,
                issuer=issuer,
            )
        else:
            # Fall back to JWKS verification (RS256).
            jwks_url = issuer + "/.well-known/jwks.json"
            jwks_client = jwt.PyJWKClient(jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=audience,
                issuer=issuer,
            )
    except jwt.ExpiredSignatureError as exc:
        raise AdminAuthError("Admin token has expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise AdminAuthError("Invalid admin token.") from exc

    # ------------------------------------------------------------------
    # Authorize: require an explicit admin role or an allow-listed email.
    # ------------------------------------------------------------------
    app_metadata = payload.get("app_metadata") or {}
    user_metadata = payload.get("user_metadata") or {}
    email = (
        payload.get("email")
        or user_metadata.get("email")
        or payload.get("preferred_username")
        or ""
    ).strip()

    roles: set[str] = set()
    if isinstance(payload.get("role"), str):
        roles.add(payload["role"].lower())
    if isinstance(app_metadata.get("role"), str):
        roles.add(app_metadata["role"].lower())
    if isinstance(app_metadata.get("roles"), list):
        roles.update(str(r).lower() for r in app_metadata["roles"] if r)

    allowed_roles = _get_allowed_admin_roles()
    allowed_emails = _get_allowed_admin_emails()
    is_admin_by_role = bool(roles & allowed_roles)
    is_admin_by_email = bool(email) and email.lower() in allowed_emails

    if not is_admin_by_role and not is_admin_by_email:
        raise AdminAuthError("Admin privileges required.")

    user_id = str(payload.get("sub") or payload.get("user_id") or "unknown")
    user_name = (
        user_metadata.get("name")
        or user_metadata.get("full_name")
        or email
        or payload.get("preferred_username")
        or user_id
    )

    return {"user_id": user_id, "user_name": str(user_name)}


# ---------------------------------------------------------------------------
# Local development fallback (server-side key, never in production)
# ---------------------------------------------------------------------------


def _verify_local_admin_key(req: func.HttpRequest) -> dict[str, Any] | None:
    admin_key = _env("ADMIN_API_KEY")
    if not admin_key:
        return None

    provided = _extract_admin_key(req)
    if not provided:
        return None

    if hmac.compare_digest(provided.strip(), admin_key.strip()):
        return {"user_id": "admin-local", "user_name": "Local Admin"}

    return None


# ---------------------------------------------------------------------------
# Public contract
# ---------------------------------------------------------------------------


def require_admin(req: func.HttpRequest) -> dict[str, Any]:
    """Authenticate an admin request and return a stable admin context.

    Order of checks:
      1. Supabase Authorization: Bearer <jwt> token.
      2. Dev-only x-admin-key header compared with server-side ADMIN_API_KEY.
    """
    # 1. Quick bypass for validation (set ADMIN_AUTH_DISABLED=true in Function App Settings)
    bypass = _env("ADMIN_AUTH_DISABLED", "false")
    if bypass.lower() in {"1", "true", "yes", "on"}:
        _logger.warning("Admin auth bypass enabled (ADMIN_AUTH_DISABLED=true). Do not use in production.")
        return {"user_id": "admin-bypass", "user_name": "Admin (No Auth)"}

    # 2. Supabase JWT
    token = _extract_bearer_token(req)
    if token:
        return _verify_supabase_jwt(token)

    # 2. Local key fallback (dev/test only)
    if _is_local_key_allowed():
        fallback = _verify_local_admin_key(req)
        if fallback:
            _logger.warning(
                "Admin request authenticated via local key fallback (user=%s). "
                "This is intended for development only.",
                fallback["user_id"],
            )
            return fallback

    raise AdminAuthError("Admin authentication required.")

