import os
import sys
import unittest

API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "api"))
if API_ROOT not in sys.path:
    sys.path.insert(0, API_ROOT)

from shared.tenant import audit  # noqa: E402
from shared.tenant.context import TenantContext  # noqa: E402


class Result:
    def __init__(self, data):
        self.data = data


class Query:
    def __init__(self, calls):
        self.calls = calls

    def insert(self, payload):
        self.calls.append(("insert", payload))
        return self

    def execute(self):
        return Result([])


class Client:
    def __init__(self):
        self.calls = []

    def table(self, name):
        self.calls.append(("table", name))
        return Query(self.calls)


class AuditTests(unittest.TestCase):
    def test_record_scopes_every_audit_row_to_context_company(self):
        client = Client()
        context = TenantContext("user-1", "company-2", "owner")

        audit.record(
            client,
            context,
            action="cashflow.ap.approve",
            resource_type="bill",
            resource_id="bill-9",
            result="success",
            details={"from_status": "pending"},
        )

        self.assertIn(("table", "cashflow_audit"), client.calls)
        inserts = [call[1] for call in client.calls if call[0] == "insert"]
        self.assertEqual(len(inserts), 1)
        payload = inserts[0]
        self.assertEqual(payload["company_id"], "company-2")
        self.assertEqual(payload["user_id"], "user-1")
        self.assertEqual(payload["role"], "owner")
        self.assertEqual(payload["action"], "cashflow.ap.approve")
        self.assertEqual(payload["resource_type"], "bill")
        self.assertEqual(payload["resource_id"], "bill-9")
        self.assertEqual(payload["result"], "success")
        self.assertEqual(payload["details"], {"from_status": "pending"})

    def test_record_never_raises_when_audit_table_is_missing(self):
        class BrokenClient:
            def table(self, name):
                raise RuntimeError("PGRST205: Could not find the table 'public.cashflow_audit'")

        context = TenantContext("user-1", "company-2", "owner")
        result = audit.record(BrokenClient(), context, action="cashflow.dashboard.read")

        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()