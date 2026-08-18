import os
import json
import sys
import unittest
from datetime import date
from unittest.mock import patch

API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "api"))
if API_ROOT not in sys.path:
    sys.path.insert(0, API_ROOT)

import cashflow_dashboard as dashboard_adapter  # noqa: E402
from cashflow.dashboard import DashboardRepository  # noqa: E402
from shared.tenant import TenantContext  # noqa: E402


class FakeResult:
    data = []


class FakeQuery:
    def __init__(self, calls):
        self.calls = calls

    def select(self, value):
        self.calls.append(("select", value))
        return self

    def eq(self, key, value):
        self.calls.append(("eq", key, value))
        return self

    def gte(self, key, value):
        self.calls.append(("gte", key, value))
        return self

    def lte(self, key, value):
        self.calls.append(("lte", key, value))
        return self

    def in_(self, key, value):
        self.calls.append(("in", key, value))
        return self

    def order(self, key, desc=False):
        self.calls.append(("order", key, desc))
        return self

    def execute(self):
        return FakeResult()


class FakeClient:
    def __init__(self):
        self.calls = []

    def table(self, name):
        self.calls.append(("table", name))
        return FakeQuery(self.calls)


class AdapterResult:
    def __init__(self, data=None):
        self.data = data or []


class AdapterQuery(FakeQuery):
    def __init__(self, client, table_name):
        super().__init__(client.calls)
        self.client = client
        self.table_name = table_name

    def execute(self):
        if self.client.error:
            raise self.client.error
        return AdapterResult(self.client.rows.get(self.table_name, []))


class AdapterClient(FakeClient):
    def __init__(self, rows=None, error=None):
        super().__init__()
        self.rows = rows or {}
        self.error = error

    def table(self, name):
        self.calls.append(("table", name))
        return AdapterQuery(self, name)


class FakeRequest:
    def __init__(self, params=None):
        self.params = params or {}


def response_payload(response):
    return json.loads(response.get_body().decode("utf-8"))


class DashboardRepositoryTests(unittest.TestCase):
    def test_all_dashboard_reads_are_scoped_to_context_company(self):
        client = FakeClient()
        context = TenantContext("user-1", "company-2", "owner")
        DashboardRepository(client).read_window(context, date(2026, 1, 1), date(2026, 1, 31))

        company_filters = [call for call in client.calls if call[:2] == ("eq", "company_id")]
        self.assertEqual(len(company_filters), 5)
        self.assertTrue(all(call[2] == "company-2" for call in company_filters))

    def test_trend_reads_are_scoped_to_context_company(self):
        client = FakeClient()
        context = TenantContext("user-1", "company-2", "owner")
        DashboardRepository(client).read_trend(context, date(2025, 9, 1), date(2026, 1, 31))

        company_filters = [call for call in client.calls if call[:2] == ("eq", "company_id")]
        self.assertEqual(len(company_filters), 2)
        self.assertTrue(all(call[2] == context.company_id for call in company_filters))


class DashboardAdapterTests(unittest.TestCase):
    identity = {
        "user_id": "11111111-1111-4111-8111-111111111111",
        "company_id": "22222222-2222-4222-8222-222222222222",
        "role": "owner",
    }

    def invoke(self, params, client):
        auth = {"ok": True, "identity": self.identity}
        with patch.object(dashboard_adapter, "require_cashflow_tenant", return_value=auth), \
                patch.object(dashboard_adapter, "get_supabase_client", return_value=client):
            return dashboard_adapter.main(FakeRequest(params))

    def test_date_ranges_support_presets_and_custom_inclusive_windows(self):
        today = date.today()
        self.assertEqual(dashboard_adapter._resolve_range("1d", "", "")[:2], (today, today))
        self.assertEqual((dashboard_adapter._resolve_range("7d", "", "")[1] - dashboard_adapter._resolve_range("7d", "", "")[0]).days, 6)
        self.assertEqual(
            dashboard_adapter._resolve_range("month", "2026-01-05", "2026-01-12"),
            (date(2026, 1, 5), date(2026, 1, 12), "custom"),
        )
        with self.assertRaisesRegex(ValueError, "start_date must be <= end_date"):
            dashboard_adapter._resolve_range("custom", "2026-01-12", "2026-01-05")

        client = AdapterClient()
        context = TenantContext("user-1", "company-2", "owner")
        DashboardRepository(client).read_window(context, date(2026, 1, 5), date(2026, 1, 12))
        range_filters = [call for call in client.calls if call[0] in ("gte", "lte")]
        self.assertEqual(len(range_filters), 10)
        self.assertTrue(all(call[2] in ("2026-01-05", "2026-01-12") for call in range_filters))

    def test_missing_table_returns_zero_dashboard_with_compatible_response_shape(self):
        response = self.invoke({}, AdapterClient(error=RuntimeError("PGRST205: Could not find the table 'public.cashflow_transactions'")))
        payload = response_payload(response)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload["ok"])
        self.assertIsNone(payload["error"])
        self.assertIn("trace_id", payload)
        self.assertEqual(payload["data"]["summary"]["cash_inflow"], 0)
        self.assertEqual(payload["data"]["trend"], {"monthly": []})

    def test_adapter_aggregates_window_and_trend_into_public_shape(self):
        rows = {
            "cashflow_transactions": [
                {"amount": "100.00", "invoice_id": "invoice-1", "bill_id": None},
                {"amount": 40, "invoice_id": None, "bill_id": "bill-1"},
            ],
            "cashflow_petty_cash": [{"cash_in": "10", "cash_out": "3"}],
            "cashflow_invoices": [{"amount": 200, "gst_amount": 36}],
            "cashflow_bills": [
                {"amount": 80, "gst_amount": 14.4, "due_date": "2099-01-01", "cashflow_entities": {"name": "Vendor", "msme_category": "micro"}},
            ],
        }
        response = self.invoke({"period": "custom", "start_date": "2026-01-01", "end_date": "2026-01-31"}, AdapterClient(rows))
        payload = response_payload(response)
        data = payload["data"]

        self.assertTrue(payload["ok"])
        self.assertEqual(data["period"], {"key": "custom", "start_date": "2026-01-01", "end_date": "2026-01-31", "days": 31})
        self.assertEqual(data["summary"]["cash_received"], 100.0)
        self.assertEqual(data["summary"]["cash_payable"], 94.4)
        self.assertEqual(data["summary"]["cash_inflow"], 110.0)
        self.assertEqual(data["summary"]["cash_outflow"], 43.0)
        self.assertEqual(data["summary"]["net_cash_position"], 67.0)
        self.assertEqual(data["msme_alerts"][0]["vendor"], "Vendor")
        self.assertEqual(set(data.keys()), {"period", "summary", "msme_alerts", "trend"})
        self.assertIn("monthly", data["trend"])

    def test_invalid_custom_date_returns_canonical_error_response(self):
        response = self.invoke({"period": "custom", "start_date": "bad", "end_date": "2026-01-31"}, AdapterClient())
        payload = response_payload(response)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(payload["ok"])
        self.assertEqual(payload["error"], "Invalid date format. Use YYYY-MM-DD")
        self.assertIsNone(payload["data"])


if __name__ == "__main__":
    unittest.main()