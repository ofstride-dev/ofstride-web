"""
Simulate a Cal.com BOOKING_CREATED webhook locally for testing the ACS email routing.

Usage:
    # Quick test with curl (Windows CMD):
    curl -X POST http://localhost:7071/api/CalWebhook ^
      -H "Content-Type: application/json" ^
      -d "{\"triggerEvent\":\"BOOKING_CREATED\",\"payload\":{\"title\":\"Career Connect Consultation\",\"startTime\":\"2026-07-22T10:00:00Z\",\"attendees\":[{\"name\":\"Ravi Sharma\",\"email\":\"ravi.sharma@example.com\"}]}}"

    # Or run this Python script:
    python scripts/simulate_cal_webhook.py
"""

import json
import requests

LOCAL_FUNC_URL = "http://localhost:7071/api/CalWebhook"

# Simulated Cal.com BOOKING_CREATED payload
MOCK_PAYLOAD = {
    "triggerEvent": "BOOKING_CREATED",
    "payload": {
        "title": "Career Connect Consultation",
        "startTime": "2026-07-22T10:00:00Z",
        "attendees": [
            {
                "name": "Ravi Sharma",
                "email": "ravi.sharma@example.com"
            }
        ],
        "description": "Discussing second-career options for veteran transitioning.",
        "bookingId": "mock_booking_001",
        "eventTypeId": 12345,
        "eventTypeSlug": "30min",
        "responses": {
            "name": "Ravi Sharma",
            "email": "ravi.sharma@example.com",
            "notes": "Retired from Indian Army, looking at supply chain roles."
        },
        "metadata": {}
    }
}

# Alternative — BOOKING_CANCELLED (just logs, no email)
MOCK_CANCELLED = {
    "triggerEvent": "BOOKING_CANCELLED",
    "payload": {
        "title": "Career Connect Consultation",
        "startTime": "2026-07-22T10:00:00Z",
        "attendees": [
            {"name": "Ravi Sharma", "email": "ravi.sharma@example.com"}
        ]
    }
}


def send_booking_created():
    """POST a BOOKING_CREATED event to the local Function App."""
    print(f"📤 Sending BOOKING_CREATED to {LOCAL_FUNC_URL}...")
    resp = requests.post(LOCAL_FUNC_URL, json=MOCK_PAYLOAD, timeout=10)
    print(f"📥 HTTP {resp.status_code}: {resp.text}")
    return resp


def send_booking_cancelled():
    """POST a BOOKING_CANCELLED event to the local Function App."""
    print(f"📤 Sending BOOKING_CANCELLED to {LOCAL_FUNC_URL}...")
    resp = requests.post(LOCAL_FUNC_URL, json=MOCK_CANCELLED, timeout=10)
    print(f"📥 HTTP {resp.status_code}: {resp.text}")
    return resp


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "cancel":
        send_booking_cancelled()
    else:
        send_booking_created()

    print("\n✅ Done. Check your Function App logs for details.")
    print("📧 If ACS is configured, admin should receive an email at ADMIN_NOTIFICATION_EMAIL.")