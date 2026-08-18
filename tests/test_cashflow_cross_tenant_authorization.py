import json
import os
import sys
import unittest
from unittest.mock import patch

API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "api"))
if API_ROOT not in sys.path:
    sys.path.insert(0, API_ROOT)

import cashflow_ap  # noqa: E402
import cashflow_ar  # noqa: E402
import cashflow_invites  # noqa: E402
import cashflow_payments  # noqa: E402
import cashflow_pettycash  # noqa: E402
import export_gstr  # noqa: E402
import export_legacy_ledger  # noqa: E402
from shared.tenant import TenantContext  # noqa: E402

COMPANY_A = "22222222-2222-4222-8222-222222222222"
COMPANY_B = "33333333-3333-4333-8333-333333333333"
USER_A = "11111111-1111-4111-8111-111111111111"


def _auth(company_id=COMPANY_A, role="owner", ok=True):
    identity = {
        "user_id": USER_A,
        "company_id": company_id,
        "role": role,
        "email": "owner-a@example.com",
        "full_name": "Owner A",
        "tenant_status": "resolved",
    }
    return {
        "ok": ok,
        "status_code": 200 if ok else 401,
        "error": None,
        "identity": identity,
        "company_id": company_id,
        "tenant": TenantContext(identity["user_id"], company_id, role, identity["email"], identity["full_name"]),
    }


def _unauth(status_code=401):
    return {"ok": False, "status_code": status_code, "error": "Authentication required."}


def _missing_company():
    return {
        "ok": False,
        "status_code": 403,
        "error": "Complete workspace onboarding before using Cashflow.",
        "error_code": "missing_company",
    }


class Result:
    def __init__(self, data):
        self.data = data


class Query:
    def __init__(self, client, table):
        self.client = client
        self.table = table

    def select(self, *_a):
        return self

    def eq(self, key, value):
        self.client.scoped.setdefault(self.table, []).append((key, value))
        return self

    def in_(self, *_a):
        return self

    def gte(self, *_a):
        return self

    def lte(self, *_a):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a):
        return self

    def single(self):
        return self

    def execute(self):
        return Result(self.client.rows.get(self.table) or [])


class SupabaseClient:
    def __init__(self, rows=None):
        self.rows = rows or {}
        self.scoped = {}

    def table(self, name):
        return Query(self, name)


class FakeRequest:
    def __init__(self, method="GET", action=None, params=None, body=None, headers=None):
        self.method = method
        self.route_params = {"action": action} if action else {}
        self.params = params or {}
        self.headers = headers or {}
        self._body = body
        self.accessed_json = False

    def get_json(self):
        self.accessed_json = True
        if self._body is None:
            raise ValueError("No JSON body")
        return self._body


class CrossTenantAuthorizationTests(unittest.TestCase):
    def parse(self, response):
        return json.loads(response.get_body().decode("utf-8"))

    def test_invites_rejects_non_approver_with_403(self):
        req = FakeRequest(method="POST", action="notify", body={"email": "x@example.com", "invite_token": "t", "accept_url": "u"})
        with patch.object(cashflow_invites, "require_cashflow_tenant", return_value=_auth(role="employee")):
            resp = cashflow_invites.main(req)
        self.assertEqual(resp.status_code, 403)

    def test_invites_requires_authentication(self):
        req = FakeRequest(method="POST", action="notify")
        with patch.object(cashflow_invites, "require_cashflow_tenant", return_value=_unauth()):
            resp = cashflow_invites.main(req)
        self.assertEqual(resp.status_code, 401)

    def test_export_gstr_requires_authentication(self):
        req = FakeRequest(params={"start_date": "2026-01-01", "end_date": "2026-01-31"})
        with patch.object(export_gstr, "require_cashflow_tenant", return_value=_unauth()):
            resp = export_gstr.main(req)
        self.assertEqual(resp.status_code, 401)

    def test_export_gstr_rejects_missing_company_membership(self):
        req = FakeRequest(params={"start_date": "2026-01-01", "end_date": "2026-01-31"})
        with patch.object(export_gstr, "require_cashflow_tenant", return_value=_missing_company()):
            resp = export_gstr.main(req)
        self.assertEqual(resp.status_code, 403)

    def test_legacy_export_requires_authentication(self):
        req = FakeRequest()
        with patch.object(export_legacy_ledger, "require_cashflow_tenant", return_value=_unauth()):
            resp = export_legacy_ledger.main(req)
        self.assertEqual(resp.status_code, 401)

    def test_payments_requires_authentication(self):
        req = FakeRequest(method="GET")
        with patch.object(cashflow_payments, "require_cashflow_tenant", return_value=_unauth()):
            resp = cashflow_payments.main(req)
        self.assertEqual(resp.status_code, 401)

    def test_payments_list_rejects_on_missing_company_membership(self):
        req = FakeRequest(method="GET")
        with patch.object(cashflow_payments, "require_cashflow_tenant", return_value=_missing_company()):
            resp = cashflow_payments.main(req)
        self.assertEqual(resp.status_code, 403)

    def test_ap_approve_rejects_non_approver_with_403(self):
        req = FakeRequest(method="POST", action="approve", body={"bill_id": "bill-1"})
        client = SupabaseClient()
        with patch.object(cashflow_ap, "require_cashflow_tenant", return_value=_auth(role="employee")), \
                patch.object(cashflow_ap, "get_supabase_client", return_value=client):
            resp = cashflow_ap.main(req)
        self.assertEqual(resp.status_code, 403)

    def test_ap_approve_returns_404_for_cross_tenant_bill_scoped_to_company(self):
        req = FakeRequest(method="POST", action="approve", body={"bill_id": "bill-of-b"})
        client = SupabaseClient()
        with patch.object(cashflow_ap, "require_cashflow_tenant", return_value=_auth(company_id=COMPANY_A)), \
                patch.object(cashflow_ap, "get_supabase_client", return_value=client):
            resp = cashflow_ap.main(req)
        payload = self.parse(resp)
        self.assertEqual(resp.status_code, 404)
        self.assertFalse(payload["ok"])
        bill_filters = client.scoped.get("cashflow_bills", [])
        self.assertIn(("company_id", COMPANY_A), bill_filters)
        self.assertNotIn(("company_id", COMPANY_B), bill_filters)

    def test_ar_approve_rejects_non_approver_with_403(self):
        req = FakeRequest(method="POST", action="approve", body={"invoice_id": "inv-1"})
        client = SupabaseClient()
        with patch.object(cashflow_ar, "require_cashflow_tenant", return_value=_auth(role="employee")), \
                patch.object(cashflow_ar, "get_supabase_client", return_value=client):
            resp = cashflow_ar.main(req)
        self.assertEqual(resp.status_code, 403)

    def test_ar_approve_returns_404_for_cross_tenant_invoice_scoped_to_company(self):
        req = FakeRequest(method="POST", action="approve", body={"invoice_id": "inv-of-b"})
        client = SupabaseClient()
        with patch.object(cashflow_ar, "require_cashflow_tenant", return_value=_auth(company_id=COMPANY_A)), \
                patch.object(cashflow_ar, "get_supabase_client", return_value=client):
            resp = cashflow_ar.main(req)
        self.assertEqual(resp.status_code, 404)
        invoice_filters = client.scoped.get("cashflow_invoices", [])
        self.assertIn(("company_id", COMPANY_A), invoice_filters)
        self.assertNotIn(("company_id", COMPANY_B), invoice_filters)

    def test_pettycash_approve_rejects_non_approver_with_403(self):
        req = FakeRequest(method="POST", action="approve", body={"entry_id": "entry-1"})
        client = SupabaseClient()
        with patch.object(cashflow_pettycash, "require_cashflow_tenant", return_value=_auth(role="employee")), \
                patch.object(cashflow_pettycash, "get_supabase_client", return_value=client):
            resp = cashflow_pettycash.main(req)
        self.assertEqual(resp.status_code, 403)

    def test_pettycash_approve_returns_404_for_cross_tenant_entry_scoped_to_company(self):
        req = FakeRequest(method="POST", action="approve", body={"entry_id": "entry-of-b"})
        client = SupabaseClient()
        with patch.object(cashflow_pettycash, "require_cashflow_tenant", return_value=_auth(company_id=COMPANY_A)), \
                patch.object(cashflow_pettycash, "get_supabase_client", return_value=client):
            resp = cashflow_pettycash.main(req)
        self.assertEqual(resp.status_code, 404)
        entry_filters = client.scoped.get("cashflow_petty_cash", [])
        self.assertIn(("company_id", COMPANY_A), entry_filters)
        self.assertNotIn(("company_id", COMPANY_B), entry_filters)


if __name__ == "__main__":
    unittest.main()