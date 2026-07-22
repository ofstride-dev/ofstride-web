"""
PyTest suite for Career Connect veteran intake flow.
Mocks: AzureOpenAI, BlobServiceClient, Supabase client.
"""
import json
import os
import pytest
from unittest.mock import patch, MagicMock, mock_open

# ── Fixtures ─────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def mock_env_vars():
    """Set required environment variables before each test."""
    with patch.dict(os.environ, {
        "SUPABASE_URL": "https://test.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "test-service-role-key",
        "COM_SERVICE_CON_STRING": "endpoint=https://test.communication.azure.com/;accesskey=test",
        "ADMIN_NOTIFICATION_EMAIL": "admin@test.com",
        "EMAIL_SERVICES_NAME": "ecs-ofs-001",
        "CAREERS_BLOB_CONNECTION_STRING": "DefaultEndpointsProtocol=https;AccountName=test;AccountKey=test;",
        "CAREERS_BLOB_CONTAINER": "resumes",
        "AZURE_OPENAI_ENDPOINT": "https://test.openai.azure.com",
        "AZURE_OPENAI_DEPLOYMENT": "gpt-4o-mini",
    }):
        yield


@pytest.fixture
def mock_blob_service():
    """Mock Azure BlobServiceClient and return a fake blob URL."""
    with patch("shared.persistence.blob_storage.BlobServiceClient") as mock_bs:
        mock_container = MagicMock()
        mock_container.exists.return_value = True
        mock_blob_client = MagicMock()
        mock_blob_client.url = "https://test.blob.core.windows.net/resumes/test-uuid-resume.pdf"
        mock_container.get_blob_client.return_value = mock_blob_client
        mock_service_instance = MagicMock()
        mock_service_instance.get_container_client.return_value = mock_container
        mock_bs.from_connection_string.return_value = mock_service_instance
        yield mock_bs


@pytest.fixture
def mock_supabase():
    """Mock Supabase create_client and table insert chain."""
    with patch("veteran_careers.intake.create_client") as mock_create:
        mock_supabase = MagicMock()
        mock_table = MagicMock()
        mock_insert = MagicMock()
        mock_table.insert.return_value = mock_insert
        mock_supabase.table.return_value = mock_table
        mock_create.return_value = mock_supabase
        yield mock_create


@pytest.fixture
def mock_analyze_resume():
    """Mock the analyze_resume function from vat_resume_analyzer."""
    with patch("veteran_careers.intake.analyze_resume") as mock_ar:
        yield mock_ar


@pytest.fixture
def mock_extract_text():
    """Mock the extract_text function from vat_resume_analyzer."""
    with patch("veteran_careers.intake.extract_text") as mock_et:
        yield mock_et


@pytest.fixture
def mock_send_admin_notification():
    """Mock send_admin_notification to avoid real ACS calls."""
    with patch("veteran_careers.intake.send_admin_notification") as mock_san:
        yield mock_san


# ── Test: Successful profile submission ──────────────────────────────────

@patch("veteran_careers.intake.upload_resume")
def test_submit_profile_success(mock_upload, mock_blob_service, mock_supabase,
                                 mock_analyze_resume, mock_extract_text,
                                 mock_send_admin_notification):
    """
    Simulate a successful intake: valid PDF upload → AI analysis → Supabase insert → email.
    """
    from veteran_careers.intake import SubmitProfile
    from azure.functions import HttpRequest, HttpResponse

    # Arrange — mock AI returns a clean (no corporate experience) result
    mock_extract_text.return_value = "Honorable discharge from Indian Army. 15 years logistics."
    mock_analyze_resume.return_value = {
        "summary": "Experienced logistics officer transitioning to civilian supply chain.",
        "recommendation": "Supply Chain Manager, Operations Lead",
        "has_corporate_experience": False,
    }
    mock_upload.return_value = "https://test.blob.core.windows.net/resumes/uuid-resume.pdf"

    # Build a fake multipart POST request
    body = (
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="fullName"\r\n\r\n'
        b"John Doe\r\n"
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="mobileNumber"\r\n\r\n'
        b"+911234567890\r\n"
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="emailId"\r\n\r\n'
        b"john.doe@example.com\r\n"
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="currentCityState"\r\n\r\n'
        b"New Delhi, Delhi\r\n"
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="defenceService"\r\n\r\n'
        b"Army\r\n"
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="rankAtRetirement"\r\n\r\n'
        b"Major\r\n"
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="retirementDate"\r\n\r\n'
        b"2025-06-30\r\n"
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="willingToRelocate"\r\n\r\n'
        b"true\r\n"
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="consentToShare"\r\n\r\n'
        b"true\r\n"
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="resume"; filename="resume.pdf"\r\n'
        b"Content-Type: application/pdf\r\n\r\n"
        b"%PDF-1.4 mock pdf content\r\n"
        b"--boundary--\r\n"
    )

    req = HttpRequest(
        method="POST",
        url="/api/SubmitProfile",
        headers={"Content-Type": "multipart/form-data; boundary=boundary"},
        body=body,
    )

    # Act
    response: HttpResponse = SubmitProfile.build().get_user_function()(req)

    # Assert
    assert response.status_code == 200
    body_json = json.loads(response.get_body().decode())
    assert body_json["status"] == "success"

    # Verify Supabase insert was called with correct data
    mock_supabase.assert_called_once()
    mock_supabase.return_value.table.assert_called_once_with("veteran_profiles")
    inserted = mock_supabase.return_value.table.return_value.insert.call_args[0][0]
    assert inserted["full_name"] == "John Doe"
    assert inserted["has_corporate_experience"] is False
    assert inserted["ai_summary"] == "Experienced logistics officer transitioning to civilian supply chain."

    # Verify admin notification was fired
    mock_send_admin_notification.assert_called_once_with("John Doe", "Army")


# ── Test: Rejection when has_corporate_experience is True ────────────────

@patch("veteran_careers.intake.upload_resume")
def test_submit_profile_rejected_corporate_experience(
    mock_upload, mock_blob_service, mock_supabase,
    mock_analyze_resume, mock_extract_text, mock_send_admin_notification
):
    """
    AI analysis flags corporate experience → HTTP 403 rejection.
    No Supabase insert, no blob upload, no email should occur.
    """
    from veteran_careers.intake import SubmitProfile
    from azure.functions import HttpRequest, HttpResponse

    # Arrange — AI detects corporate experience
    mock_extract_text.return_value = "Worked at Infosys for 3 years after retiring as Colonel."
    mock_analyze_resume.return_value = {
        "summary": "Post-retirement corporate experience at Infosys.",
        "recommendation": "Already placed in civilian sector.",
        "has_corporate_experience": True,
    }

    body = (
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="fullName"\r\n\r\n'
        b"Jane Smith\r\n"
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="mobileNumber"\r\n\r\n'
        b"+919876543210\r\n"
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="emailId"\r\n\r\n'
        b"jane.smith@example.com\r\n"
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="currentCityState"\r\n\r\n'
        b"Bangalore, Karnataka\r\n"
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="defenceService"\r\n\r\n'
        b"Air Force\r\n"
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="rankAtRetirement"\r\n\r\n'
        b"Wing Commander\r\n"
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="retirementDate"\r\n\r\n'
        b"2023-12-01\r\n"
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="willingToRelocate"\r\n\r\n'
        b"false\r\n"
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="consentToShare"\r\n\r\n'
        b"true\r\n"
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="resume"; filename="resume.pdf"\r\n'
        b"Content-Type: application/pdf\r\n\r\n"
        b"%PDF-1.4 mock pdf with corporate experience\r\n"
        b"--boundary--\r\n"
    )

    req = HttpRequest(
        method="POST",
        url="/api/SubmitProfile",
        headers={"Content-Type": "multipart/form-data; boundary=boundary"},
        body=body,
    )

    # Act
    response: HttpResponse = SubmitProfile.build().get_user_function()(req)

    # Assert — HTTP 403 rejection
    assert response.status_code == 403
    assert b"corporate experience" in response.get_body()

    # Verify no Supabase insert, no blob upload, no email were executed
    mock_supabase.return_value.table.return_value.insert.assert_not_called()
    mock_upload.assert_not_called()
    mock_send_admin_notification.assert_not_called()


# ── Test: Missing resume file ────────────────────────────────────────────

def test_submit_profile_missing_resume(mock_supabase):
    """Request without a resume file should return 400."""
    from veteran_careers.intake import SubmitProfile
    from azure.functions import HttpRequest, HttpResponse

    body = (
        b"--boundary\r\n"
        b'Content-Disposition: form-data; name="fullName"\r\n\r\n'
        b"No Resume\r\n"
        b"--boundary--\r\n"
    )

    req = HttpRequest(
        method="POST",
        url="/api/SubmitProfile",
        headers={"Content-Type": "multipart/form-data; boundary=boundary"},
        body=body,
    )

    response: HttpResponse = SubmitProfile.build().get_user_function()(req)
    assert response.status_code == 400
    assert b"Resume file missing" in response.get_body()