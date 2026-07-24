import azure.functions as func
import logging
import json
import os
from azure.communication.email import EmailClient
from azure.identity import ManagedIdentityCredential
from shared.security.admin_auth import AdminAuthError, require_authenticated_user


def _load_blob_uploader():
    from shared.persistence.blob_storage import upload_resume

    return upload_resume


def _load_supabase_client_factory():
    from supabase import create_client

    return create_client


def _load_notification_sender():
    from shared.engagement.communications import send_admin_notification

    return send_admin_notification


_acs_email_client: EmailClient | None = None


def _get_acs_endpoint() -> str:
    return (
        os.environ.get("ACS_ENDPOINT")
        or "https://acs-ofs-001.india.communication.azure.com"
    ).strip()


def _get_sender_address() -> str:
    return (
        os.environ.get("EMAIL_SENDER_ADDRESS")
        or "DoNotReply@eafd51a7-7800-4251-bf8f-a8b754530fc3.azurecomm.net"
    ).strip()


def _get_acs_email_client() -> EmailClient:
    global _acs_email_client
    if _acs_email_client is None:
        # Explicitly use system-assigned managed identity for ACS email sending.
        # This avoids DefaultAzureCredential selecting a user-assigned identity
        # from AZURE_CLIENT_ID in Function App settings.
        _acs_email_client = EmailClient(
            endpoint=_get_acs_endpoint(),
            credential=ManagedIdentityCredential(),
        )
    return _acs_email_client


def _send_applicant_confirmation_email(*, to_address: str, applicant_name: str) -> None:
    if not to_address:
        raise ValueError("Applicant email is required for confirmation email.")

    sender = _get_sender_address()
    if "@" not in sender:
        raise RuntimeError("Configured EMAIL_SENDER_ADDRESS is invalid.")

    message = {
        "senderAddress": sender,
        "content": {
            "subject": "Your details have been recorded - OfStride",
            "plainText": (
                f"Hi {applicant_name or 'there'},\n\n"
                "Your details have been recorded successfully. "
                "Thank you for submitting your profile to OfStride."
            ),
        },
        "recipients": {"to": [{"address": to_address}]},
    }

    poller = _get_acs_email_client().begin_send(message)
    poller.result()


def _to_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _missing_required_fields(form_data, required_fields):
    missing = []
    for field in required_fields:
        value = form_data.get(field)
        if value is None or str(value).strip() == "":
            missing.append(field)
    return missing

def handle_submit_profile(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Processing application intake request.")

    try:
        auth_ctx = require_authenticated_user(req)
        form_data = req.form
        uploaded_file = req.files.get('resume')

        required_fields = [
            "fullName",
            "mobileNumber",
            "emailId",
            "defenceService",
            "rankAtRetirement",
            "retirementDate",
        ]
        missing_required = _missing_required_fields(form_data, required_fields)
        if missing_required:
            return func.HttpResponse(
                json.dumps({"error": "Missing required fields", "missing": missing_required}),
                mimetype="application/json",
                status_code=400,
            )

        auth_email = str(auth_ctx.get("user_email") or "").strip().lower()
        form_email = str(form_data.get("emailId") or "").strip().lower()
        if not auth_email or auth_email != form_email:
            return func.HttpResponse(
                json.dumps({"error": "Authenticated email does not match submitted profile email."}),
                mimetype="application/json",
                status_code=403,
            )
        
        if not uploaded_file:
            return func.HttpResponse("Resume file missing.", status_code=400)
            
        file_bytes = uploaded_file.read()
        filename = uploaded_file.filename

        # Stream to Azure Blob Storage.
        veteran_resume_container = os.environ.get("VETERAN_RESUME_BLOB_CONTAINER", "veteran-resume").strip() or "veteran-resume"
        try:
            upload_resume = _load_blob_uploader()
            blob_url = upload_resume(file_bytes, filename, container_name=veteran_resume_container)
        except Exception as upload_error:
            logging.exception("Veteran resume upload failed for container '%s'", veteran_resume_container)
            return func.HttpResponse(
                json.dumps({
                    "error": "Resume upload failed",
                    "details": str(upload_error),
                    "container": veteran_resume_container,
                }),
                mimetype="application/json",
                status_code=500,
            )

        pin_code = form_data.get("pinCode")
        state = form_data.get("state")
        district = form_data.get("district")
        address_area = form_data.get("addressArea")

        # Backward compatibility for older frontend payloads using currentCityState.
        if (not state or not district or not address_area) and form_data.get("currentCityState"):
            legacy_location = str(form_data.get("currentCityState")).strip()
            if not address_area:
                address_area = legacy_location
            if not district:
                district = legacy_location
            if not state:
                state = legacy_location

        location_missing = []
        if not pin_code:
            location_missing.append("pinCode")
        if not state:
            location_missing.append("state")
        if not district:
            location_missing.append("district")
        if not address_area:
            location_missing.append("addressArea")
        if location_missing:
            return func.HttpResponse(
                json.dumps({"error": "Missing required location fields", "missing": location_missing}),
                mimetype="application/json",
                status_code=400,
            )

        # 4. Record to Supabase
        supabase_url = os.environ.get("SUPABASE_URL", "").strip()
        supabase_service_key = (
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
            or os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
        )
        if not supabase_url or not supabase_service_key:
            return func.HttpResponse(
                json.dumps({"error": "Supabase persistence is not configured on server."}),
                mimetype="application/json",
                status_code=500,
            )

        try:
            create_client = _load_supabase_client_factory()
        except Exception as import_error:
            logging.exception("Supabase client dependency unavailable")
            return func.HttpResponse(
                json.dumps({"error": "Supabase client is unavailable on server.", "details": str(import_error)}),
                mimetype="application/json",
                status_code=503,
            )

        supabase = create_client(supabase_url, supabase_service_key)
        profile_record = {
            "full_name": form_data.get("fullName"),
            "mobile_number": form_data.get("mobileNumber"),
            "email_id": form_data.get("emailId"),
            "pin_code": str(pin_code).strip(),
            "state": str(state).strip(),
            "district": str(district).strip(),
            "address_area": str(address_area).strip(),
            "defence_service": form_data.get("defenceService"),
            "rank_at_retirement": form_data.get("rankAtRetirement"),
            "retirement_date": form_data.get("retirementDate"),
            "preferred_job_location": form_data.get("preferredJobLocation"),
            "willing_to_relocate": _to_bool(form_data.get("willingToRelocate")),
            "linkedin_profile": form_data.get("linkedinProfile"),
            "expected_salary": form_data.get("expectedSalary"),
            "consent_to_share": _to_bool(form_data.get("consentToShare")),
            "resume_blob_url": blob_url,
            "ai_summary": None,
            "ai_recommendation": None,
            "has_corporate_experience": False,
        }
        supabase.table("veteran_profiles").insert(profile_record).execute()

        # 5. Fire Async Admin Email
        try:
            send_admin_notification = _load_notification_sender()
            send_admin_notification(profile_record["full_name"], profile_record["defence_service"])
        except Exception as notify_error:
            logging.warning("Admin notification skipped: %s", notify_error)

        try:
            _send_applicant_confirmation_email(
                to_address=str(profile_record.get("email_id") or "").strip().lower(),
                applicant_name=str(profile_record.get("full_name") or "").strip(),
            )
        except Exception as email_error:
            logging.exception("Applicant confirmation email failed")
            return func.HttpResponse(
                json.dumps({
                    "error": "Profile saved but confirmation email failed",
                    "details": str(email_error),
                }),
                mimetype="application/json",
                status_code=500,
            )

        return func.HttpResponse(json.dumps({"status": "success"}), mimetype="application/json", status_code=200)

    except AdminAuthError as auth_error:
        return func.HttpResponse(
            json.dumps({"error": str(auth_error)}),
            mimetype="application/json",
            status_code=401,
        )

    except Exception as e:
        logging.error(f"Execution Error: {str(e)}")
        return func.HttpResponse("Server error processing registration request.", status_code=500)