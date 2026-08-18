import os
import sys
import unittest

API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "api"))
if API_ROOT not in sys.path:
    sys.path.insert(0, API_ROOT)

from cashflow.payments import PaymentsRepository  # noqa: E402


class Result:
    def __init__(self, data):
        self.data = data


class PaymentsRepositoryTests(unittest.TestCase):
    def test_payment_must_not_exceed_parent_amount(self):
        error = PaymentsRepository.validate_payment(Result([{"amount": 100, "status": "approved"}]), 100.01)
        self.assertEqual(error, "Payment amount cannot exceed the parent document amount.")

    def test_cancelled_parent_cannot_be_paid(self):
        error = PaymentsRepository.validate_payment(Result([{"amount": 100, "status": "cancelled"}]), 1)
        self.assertEqual(error, "Payments cannot be recorded for a cancelled document.")

    def test_transaction_date_uses_iso_contract(self):
        error = PaymentsRepository.validate_payment(Result([{"amount": 100, "status": "approved"}]), 1, "2026-02-30")
        self.assertEqual(error, "Invalid transaction_date. Use YYYY-MM-DD.")

    def test_valid_partial_payment_is_accepted(self):
        self.assertIsNone(
            PaymentsRepository.validate_payment(Result([{"amount": 100, "status": "approved"}]), 40, "2026-02-28")
        )


if __name__ == "__main__":
    unittest.main()