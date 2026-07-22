import azure.functions as func
import logging
import json
import os
from shared.security.admin_auth import AdminAuthError, require_authenticated_user

# Create the Blueprint
veteran_bp = func.Blueprint()


def _load_resume_tools():
    from shared.careers_agentic.vat_resume_analyzer import extract_text, analyze_resume

    return extract_text, analyze_resume


def _load_blob_uploader():
    from shared.persistence.blob_storage import upload_resume

    return upload_resume


def _load_supabase_client_factory():
    from supabase import create_client

    return create_client


def _load_notification_sender():
    from shared.engagement.communications import send_admin_notification

    return send_admin_notification


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

@veteran_bp.route(route="SubmitProfile", auth_level=func.AuthLevel.ANONYMOUS, methods=["POST"])
def SubmitProfile(req: func.HttpRequest) -> func.HttpResponse:
    return handle_submit_profile(req)


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

        ai_data = {
            "summary": None,
            "recommendation": None,
            "has_corporate_experience": False,
        }

        # 1. Parse and analyze resume when analyzer dependencies are available.
        # If unavailable in the cloud runtime, continue the core submission path.
        try:
            extract_text, analyze_resume = _load_resume_tools()
            resume_text = extract_text(file_bytes, filename)
            if resume_text.strip():
                try:
                    ai_data = analyze_resume(resume_text)
                except Exception as ai_error:
                    logging.warning("Resume AI analysis failed, continuing submission: %s", ai_error)
            else:
                logging.warning("Resume text extraction returned empty content; skipping AI analysis.")
        except Exception as import_error:
            logging.warning("Resume analyzer dependencies unavailable; continuing without AI analysis: %s", import_error)

        # 3. Stream to Azure Blob Storage
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
            "ai_summary": ai_data.get("summary"),
            "ai_recommendation": ai_data.get("recommendation"),
            "has_corporate_experience": bool(ai_data.get("has_corporate_experience", False))
        }
        supabase.table("veteran_profiles").insert(profile_record).execute()

        # 5. Fire Async Admin Email
        try:
            send_admin_notification = _load_notification_sender()
            send_admin_notification(profile_record["full_name"], profile_record["defence_service"])
        except Exception as notify_error:
            logging.warning("Admin notification skipped: %s", notify_error)

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