import azure.functions as func
import logging
import json
from shared.engagement.communications import send_meeting_alert


def handle_cal_webhook(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Received webhook from Cal.com")

    try:
        req_body = req.get_json()
        trigger_event = req_body.get("triggerEvent")

        if trigger_event == "BOOKING_CREATED":
            payload = req_body.get("payload", {})
            send_meeting_alert(payload)
            return func.HttpResponse(
                json.dumps({"status": "Meeting processed and alert sent"}),
                mimetype="application/json",
                status_code=200
            )

        elif trigger_event == "BOOKING_CANCELLED":
            return func.HttpResponse("Cancellation logged", status_code=200)

        return func.HttpResponse("Event ignored", status_code=200)

    except ValueError:
        return func.HttpResponse("Invalid JSON payload", status_code=400)
    except Exception as e:
        logging.error(f"Webhook Error: {str(e)}")
        return func.HttpResponse("Internal Server Error", status_code=500)