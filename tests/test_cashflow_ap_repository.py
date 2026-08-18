import os
import sys
import unittest

API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "api"))
if API_ROOT not in sys.path:
    sys.path.insert(0, API_ROOT)

from cashflow.ap import APRepository, MissingTableError  # noqa: E402
from shared.tenant import TenantContext  # noqa: E402


class Result:
    def __init__(self, data):
        self.data = data


class Query:
    def __init__(self, calls):
        self.calls = calls
        self.error = None

    def select(self, value):
        self.calls.append(("select", value))
        return self

    def eq(self, key, value):
        self.calls.append(("eq", key, value))
        return self

    def order(self, key, desc=False):
        self.calls.append(("order", key, desc))
        return self

    def insert(self, payload):
        self.calls.append(("insert", payload))
        self.did_insert = True
        return self

    def execute(self):
        if self.error:
            raise self.error
        rows = getattr(self, "insert_rows", None)
        if getattr(self, "did_insert", False) and rows is not None:
            return Result(rows)
        return Result(self.rows)


class Client:
    def __init__(self, rows=None, error=None, insert_rows=None):
        self.calls = []
        self.rows = rows or []
        self.error = error
        self.insert_rows = insert_rows if insert_rows is not None else rows

    def table(self, name):
        self.calls.append(("table", name))
        q = Query(self.calls)
        q.rows = self.rows
        q.error = self.error
        q.insert_rows = self.insert_rows
        return q


class APRepositoryTests(unittest.TestCase):
    def test_list_bills_is_scoped_to_context_company(self):
        client = Client(rows=[{"id": "bill-1"}])
        context = TenantContext("user-1", "company-2", "owner")
        result = APRepository(client).list_bills(context)

        self.assertEqual(result.data, [{"id": "bill-1"}])
        self.assertIn(("table", "cashflow_bills"), client.calls)
        self.assertIn(("eq", "company_id", "company-2"), client.calls)

    def test_list_bills_orders_by_created_at_desc(self):
        client = Client(rows=[])
        APRepository(client).list_bills(TenantContext("user-1", "company-2", "owner"))

        self.assertIn(("order", "created_at", True), client.calls)

    def test_list_bills_raises_missing_table_for_unmigrated_table(self):
        client = Client(error=RuntimeError("PGRST205: Could not find the table 'public.cashflow_bills'"))
        with self.assertRaises(MissingTableError):
            APRepository(client).list_bills(TenantContext("user-1", "company-2", "owner"))

    def test_get_or_create_vendor_resolves_existing_vendor_scoped_to_company(self):
        client = Client(rows=[{"id": "vendor-9"}])
        context = TenantContext("user-1", "company-2", "owner")
        vendor_id = APRepository(client).get_or_create_vendor(context, "Acme", "GSTIN-1")

        self.assertEqual(vendor_id, "vendor-9")
        self.assertIn(("eq", "company_id", "company-2"), client.calls)
        self.assertIn(("eq", "name", "Acme"), client.calls)
        self.assertIn(("eq", "entity_type", "vendor"), client.calls)

    def test_get_or_create_vendor_inserts_with_tenant_company(self):
        client = Client(rows=[], insert_rows=[{"id": "vendor-new"}])
        context = TenantContext("user-1", "company-2", "owner")
        vendor_id = APRepository(client).get_or_create_vendor(context, "Acme", "GSTIN-1")

        self.assertEqual(vendor_id, "vendor-new")
        inserts = [call for call in client.calls if call[0] == "insert"]
        self.assertEqual(len(inserts), 1)
        payload = inserts[0][1]
        self.assertEqual(payload["company_id"], "company-2")
        self.assertEqual(payload["name"], "Acme")
        self.assertEqual(payload["entity_type"], "vendor")
        self.assertEqual(payload["gstin"], "GSTIN-1")

    def test_get_or_create_vendor_defaults_missing_name_safely(self):
        client = Client(rows=[], insert_rows=[{"id": "vendor-new"}])
        APRepository(client).get_or_create_vendor(TenantContext("user-1", "company-2", "owner"), None)

        inserts = [call for call in client.calls if call[0] == "insert"]
        self.assertEqual(inserts[0][1]["name"], "Unassigned Vendor")


if __name__ == "__main__":
    unittest.main()