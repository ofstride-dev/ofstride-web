import os
import sys
import unittest

API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "api"))
if API_ROOT not in sys.path:
    sys.path.insert(0, API_ROOT)

from cashflow.pettycash import PettyCashRepository  # noqa: E402
from shared.tenant import TenantContext  # noqa: E402


class Result:
    def __init__(self, data):
        self.data = data


class Query:
    def __init__(self, client):
        self.client = client
        self.rows = client.rows

    def select(self, value):
        self.client.calls.append(("select", value))
        return self

    def eq(self, key, value):
        self.client.calls.append(("eq", key, value))
        return self

    def order(self, key, desc=False):
        self.client.calls.append(("order", key, desc))
        return self

    def limit(self, value):
        self.client.calls.append(("limit", value))
        return self

    def insert(self, payload):
        self.client.calls.append(("insert", payload))
        return self

    def update(self, payload):
        self.client.calls.append(("update", payload))
        return self

    def execute(self):
        return Result(self.rows)


class Client:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.calls = []

    def table(self, name):
        self.calls.append(("table", name))
        return Query(self)


class PettyCashRepositoryTests(unittest.TestCase):
    def setUp(self):
        self.context = TenantContext("user-1", "company-2", "owner")

    def test_list_is_scoped_to_context_company(self):
        client = Client([{"id": "entry-1"}])
        result = PettyCashRepository(client).list_entries(self.context)
        self.assertEqual(result.data, [{"id": "entry-1"}])
        self.assertIn(("eq", "company_id", "company-2"), client.calls)

    def test_create_adds_tenant_and_recorder(self):
        client = Client([{"id": "entry-1"}])
        PettyCashRepository(client).create_entry(self.context, {"description": "Taxi"})
        payload = next(call[1] for call in client.calls if call[0] == "insert")
        self.assertEqual(payload["company_id"], "company-2")
        self.assertEqual(payload["recorded_by"], "user-1")
        self.assertEqual(payload["status"], "pending")

    def test_approval_read_and_update_are_tenant_scoped(self):
        client = Client([{"id": "entry-1", "status": "pending"}])
        repository = PettyCashRepository(client)
        repository.get_entry(self.context, "entry-1")
        repository.approve_entry(self.context, "entry-1")
        filters = [call for call in client.calls if call[0] == "eq"]
        self.assertEqual(filters.count(("eq", "company_id", "company-2")), 2)
        self.assertEqual(filters.count(("eq", "id", "entry-1")), 2)


if __name__ == "__main__":
    unittest.main()