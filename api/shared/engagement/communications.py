import os
from azure.communication.email import EmailClient

def get_email_client():
    connection_string = os.environ.get("COM_SERVICE_CON_STRING")
    if not connection_string:
        return None
    return EmailClient.from_connection_string(connection_string)

def send_admin_notification(veteran_name: str, service: str):
    try:
        email_client = get_email_client()
        if not email_client: return

        message = {
            "content": {
                "subject": f"New Veteran Profile Registered: {veteran_name}",
                "plainText": f"A new profile has been uploaded for a veteran from the {service}. Review the details in the Supabase dashboard.",
            },
            "recipients": {"to": [{"address": os.environ.get("ADMIN_NOTIFICATION_EMAIL", "admin@ofstrideservices.com")}]},
            "senderAddress": os.environ.get("EMAIL_SERVICES_NAME", "ecs-ofs-001")
        }
        email_client.begin_send(message)
    except Exception as e:
        print(f"Failed to dispatch alert email: {str(e)}")

def send_meeting_alert(booking_data: dict):
    try:
        email_client = get_email_client()
        if not email_client: return

        attendee_name = booking_data.get("attendees", [{"name": "Unknown"}])[0].get("name")
        attendee_email = booking_data.get("attendees", [{"email": "Unknown"}])[0].get("email")
        start_time = booking_data.get("startTime", "TBD")
        meeting_title = booking_data.get("title", "New Meeting")
        
        message = {
            "content": {
                "subject": f"New Meeting Booked: {meeting_title}",
                "plainText": f"A new meeting was booked via Cal.com.\n\nAttendee: {attendee_name} ({attendee_email})\nTime: {start_time}"
            },
            "recipients": {"to": [{"address": os.environ.get("ADMIN_NOTIFICATION_EMAIL", "admin@ofstrideservices.com")}]},
            "senderAddress": os.environ.get("EMAIL_SERVICES_NAME", "ecs-ofs-001")
        }
        email_client.begin_send(message)
    except Exception as e:
        print(f"Failed to send meeting alert: {str(e)}")