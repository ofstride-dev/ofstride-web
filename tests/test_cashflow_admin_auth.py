import os
import sys
import unittest
from unittest.mock import patch


API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "api"))
if API_ROOT not in sys.path:
    sys.path.insert(0, API_ROOT)

from shared import admin_auth  # noqa: E402
from shared.tenant import TenantContext  # noqa: E402


class FakeRequest:
    def __init__(self, headers):
        self.headers = headers


class CashflowAdminAuthTests(unittest.TestCase):
    def test_profile_company_is_authoritative_over_jwt_metadata(self):
        identity = admin_auth._profile_to_identity(
            "11111111-1111-4111-8111-111111111111",
            {"role": "employee", "company_id": "22222222-2222-4222-8222-222222222222"},
            {"role": "employee", "company_id": None},
        )

        self.assertIsNone(identity["company_id"])

    def test_invalid_bearer_does_not_fall_back_to_local_headers(self):
        request = FakeRequest(
            {
                "Authorization": "Bearer expired-token",
                "x-user-id": "11111111-1111-4111-8111-111111111111",
                "x-company-id": "22222222-2222-4222-8222-222222222222",
                "x-app-role": "owner",
            }
        )

        with patch.object(admin_auth, "_authenticate_bearer", side_effect=RuntimeError("expired")):
            result = admin_auth.validate_identity_headers(request)

        self.assertFalse(result["ok"])
        self.assertEqual(result["status_code"], 401)

    def test_bearer_profile_company_must_be_a_uuid(self):
        identity = admin_auth._profile_to_identity(
            "11111111-1111-4111-8111-111111111111",
            {"role": "employee"},
            {"role": "employee", "company_id": "not-a-uuid"},
        )

        self.assertIsNone(identity["company_id"])
        self.assertEqual(identity["tenant_status"], "invalid_membership")

    def test_profile_diagnostics_distinguish_missing_profile_and_company(self):
        user_id = "11111111-1111-4111-8111-111111111111"
        auth_context = {"role": "employee"}

        missing_profile = admin_auth._profile_to_identity(user_id, auth_context, None)
        missing_company = admin_auth._profile_to_identity(user_id, auth_context, {"role": "employee"})

        self.assertEqual(missing_profile["tenant_status"], "missing_profile")
        self.assertEqual(missing_company["tenant_status"], "missing_company")

    def test_profile_lookup_failure_fails_closed_with_diagnostic_code(self):
        request = FakeRequest({"Authorization": "Bearer valid-token"})

        with patch.object(admin_auth, "_authenticate_bearer", side_effect=admin_auth.ProfileLookupError()):
            result = admin_auth.validate_identity_headers(request)

        self.assertFalse(result["ok"])
        self.assertEqual(result["status_code"], 503)
        self.assertEqual(result["error_code"], "profile_lookup_failed")

    def test_cashflow_guard_rejects_missing_company_membership(self):
        request = FakeRequest({})
        unresolved = {
            "ok": True,
            "identity": {
                "role": "employee",
                "company_id": None,
                "tenant_status": "missing_company",
            },
        }

        with patch.object(admin_auth, "validate_identity_headers", return_value=unresolved):
            result = admin_auth.require_cashflow_tenant(request)

        self.assertFalse(result["ok"])
        self.assertEqual(result["status_code"], 403)
        self.assertEqual(result["error_code"], "missing_company")

    def test_cashflow_guard_returns_canonical_company_id(self):
        request = FakeRequest({})
        company_id = "22222222-2222-4222-8222-222222222222"
        resolved = {
            "ok": True,
            "identity": {
                "user_id": "11111111-1111-4111-8111-111111111111",
                "role": "employee",
                "company_id": company_id,
                "tenant_status": "resolved",
            },
        }

        with patch.object(admin_auth, "validate_identity_headers", return_value=resolved):
            result = admin_auth.require_cashflow_tenant(request)

        self.assertTrue(result["ok"])
        self.assertEqual(result["company_id"], company_id)
        self.assertIsInstance(result["tenant"], TenantContext)
        self.assertEqual(result["tenant"].company_id, company_id)

    def test_tenant_context_is_independent_of_profile_storage_shape(self):
        context = admin_auth.context_from_identity(
            {
                "user_id": "11111111-1111-4111-8111-111111111111",
                "company_id": "22222222-2222-4222-8222-222222222222",
                "role": "Finance",
            }
        )

        self.assertEqual(context.role, "finance")
        self.assertEqual(context.company_id, "22222222-2222-4222-8222-222222222222")