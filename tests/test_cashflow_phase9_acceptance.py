import os
import sys
import unittest


API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "api"))
if API_ROOT not in sys.path:
    sys.path.insert(0, API_ROOT)

from shared.tenant.context import TenantContext  # noqa: E402
from shared.tenant.policy import (  # noqa: E402
    can_approve_cashflow,
    can_create_payments,
    can_manage_invites,
    can_use_cashflow,
    can_view_expense_admin_queue,
)


COMPANY_A = "22222222-2222-4222-8222-222222222222"
USER_A = "11111111-1111-4111-8111-111111111111"


class CashflowPhase9AcceptanceTests(unittest.TestCase):
    def test_role_policy_matrix_is_consistent(self):
        for role in ("owner", "admin", "finance"):
            identity = {"role": role, "company_id": COMPANY_A}
            self.assertTrue(can_use_cashflow(identity))
            self.assertTrue(can_approve_cashflow(identity))
            self.assertTrue(can_manage_invites(identity))
            self.assertTrue(can_create_payments(identity))
            self.assertTrue(can_view_expense_admin_queue(identity))

        employee = {"role": "employee", "company_id": COMPANY_A}
        self.assertTrue(can_use_cashflow(employee))
        self.assertFalse(can_approve_cashflow(employee))
        self.assertFalse(can_manage_invites(employee))
        self.assertFalse(can_create_payments(employee))
        self.assertFalse(can_view_expense_admin_queue(employee))

    def test_missing_company_cannot_use_cashflow(self):
        self.assertFalse(can_use_cashflow({"role": "owner", "company_id": None}))
        self.assertFalse(can_use_cashflow({"role": "owner"}))

    def test_tenant_context_keeps_verified_membership_fields(self):
        context = TenantContext(USER_A, COMPANY_A, " Finance ")
        self.assertEqual(context.role, " Finance ")
        self.assertEqual(context.company_id, COMPANY_A)

    def test_membership_sql_requires_authenticated_owner_and_active_status(self):
        path = os.path.join(
            API_ROOT,
            "shared",
            "security",
            "cashflow_phase8_memberships.sql",
        )
        with open(path, encoding="utf-8") as handle:
            sql = handle.read()

        self.assertIn("m.user_id = auth.uid()", sql)
        self.assertIn("m.status = 'active'", sql)
        self.assertIn("WITH CHECK (false)", sql)
        self.assertIn("resolve_active_company_membership", sql)

    def test_invite_hardening_covers_one_time_email_and_company_guards(self):
        path = os.path.join(
            API_ROOT,
            "shared",
            "security",
            "cashflow_phase9_invite_hardening.sql",
        )
        with open(path, encoding="utf-8") as handle:
            sql = handle.read()

        self.assertIn("FOR UPDATE", sql)
        self.assertIn("v_invite.expires_at <= now()", sql)
        self.assertIn("lower(v_invite.email) <> v_email", sql)
        self.assertIn("User already belongs to another workspace", sql)
        self.assertIn("INSERT INTO public.company_memberships", sql)
        self.assertIn("status = 'accepted'", sql)
        self.assertIn("role = excluded.role", sql)
        self.assertIn("revoke_company_invite", sql)
        self.assertIn("company_id = v_company_id", sql)


if __name__ == "__main__":
    unittest.main()