import json
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API_DIR = ROOT / "api"
SHARED_DIR = API_DIR / "shared"

if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))
if str(SHARED_DIR) not in sys.path:
    sys.path.insert(0, str(SHARED_DIR))


from careers_agentic.resume_builder import routes


class FakeResumeBuilderStore:
    def __init__(self, drafts=None, versions=None):
        self._drafts = drafts or {}
        self._versions = versions or {}
        self.is_available = True

    def list_master_resumes(self, created_by=None):
        items = list(self._drafts.values())
        if created_by:
            items = [row for row in items if row.get("created_by") == created_by]
        return items

    def get_master_resume(self, draft_id):
        return self._drafts.get(draft_id)

    def delete_master_resume(self, draft_id):
        existed = draft_id in self._drafts
        if existed:
            self._drafts.pop(draft_id, None)
        return existed

    def list_versions(self, draft_id):
        return list(self._versions.get(draft_id, []))

    def get_version(self, draft_id, version_id):
        for item in self._versions.get(draft_id, []):
            if item.get("id") == version_id:
                return item
        return None


def _body(resp):
    return json.loads(resp.get_body().decode("utf-8"))


def _admin_ctx(role, user_id, user_name=None, user_email=None):
    return {
        "role": role,
        "user_id": user_id,
        "user_name": user_name or user_id,
        "user_email": user_email,
    }


def test_employer_cannot_get_other_users_master_resume(monkeypatch):
    store = FakeResumeBuilderStore(
        drafts={
            "d1": {"id": "d1", "created_by": "owner-a", "title": "Owner A"},
            "d2": {"id": "d2", "created_by": "owner-b", "title": "Owner B"},
        }
    )
    monkeypatch.setattr(routes, "get_resume_builder_store", lambda: store)

    employer = _admin_ctx("employer", "owner-a")
    response = routes._handle_get_master_resume("t-1", employer, "d2")

    assert response.status_code == 404
    payload = _body(response)
    assert payload["ok"] is False
    assert payload["error"]["type"] == "validation"


def test_admin_can_get_any_master_resume(monkeypatch):
    store = FakeResumeBuilderStore(
        drafts={
            "d2": {"id": "d2", "created_by": "owner-b", "title": "Owner B"},
        }
    )
    monkeypatch.setattr(routes, "get_resume_builder_store", lambda: store)

    admin = _admin_ctx("admin", "admin-1", user_email="admin@example.com")
    response = routes._handle_get_master_resume("t-2", admin, "d2")

    assert response.status_code == 200
    payload = _body(response)
    assert payload["ok"] is True
    assert payload["data"]["draft"]["id"] == "d2"


def test_employer_list_master_resumes_is_filtered_to_owner(monkeypatch):
    store = FakeResumeBuilderStore(
        drafts={
            "d1": {"id": "d1", "created_by": "owner-a", "title": "Owner A"},
            "d2": {"id": "d2", "created_by": "owner-b", "title": "Owner B"},
        }
    )
    monkeypatch.setattr(routes, "get_resume_builder_store", lambda: store)

    employer = _admin_ctx("employer", "owner-a")
    response = routes._handle_list_master_resumes("t-3", employer)

    assert response.status_code == 200
    payload = _body(response)
    assert payload["ok"] is True
    ids = [row["id"] for row in payload["data"]["items"]]
    assert ids == ["d1"]


def test_employer_cannot_list_or_get_other_users_versions(monkeypatch):
    store = FakeResumeBuilderStore(
        drafts={
            "d2": {"id": "d2", "created_by": "owner-b", "title": "Owner B"},
        },
        versions={
            "d2": [
                {
                    "id": "v1",
                    "draft_id": "d2",
                    "version_number": 1,
                    "ats_score": {"overall_score": 75.0},
                }
            ]
        },
    )
    monkeypatch.setattr(routes, "get_resume_builder_store", lambda: store)

    employer = _admin_ctx("employer", "owner-a")
    list_response = routes._handle_list_versions("t-4", employer, "d2")
    get_response = routes._handle_get_version("t-4", employer, "d2", "v1")

    assert list_response.status_code == 404
    assert _body(list_response)["ok"] is False
    assert get_response.status_code == 404
    assert _body(get_response)["ok"] is False


def test_owner_can_delete_own_master_resume(monkeypatch):
    store = FakeResumeBuilderStore(
        drafts={
            "d1": {"id": "d1", "created_by": "owner-a", "title": "Owner A"},
        }
    )
    monkeypatch.setattr(routes, "get_resume_builder_store", lambda: store)
    monkeypatch.setattr(routes, "get_careers_store", lambda: type("_S", (), {"is_available": False})())

    employer = _admin_ctx("employer", "owner-a")
    response = routes._handle_delete_master_resume("t-5", employer, "d1")

    assert response.status_code == 200
    payload = _body(response)
    assert payload["ok"] is True
    assert payload["data"]["deleted"] is True


def test_employer_cannot_delete_other_users_master_resume(monkeypatch):
    store = FakeResumeBuilderStore(
        drafts={
            "d2": {"id": "d2", "created_by": "owner-b", "title": "Owner B"},
        }
    )
    monkeypatch.setattr(routes, "get_resume_builder_store", lambda: store)

    employer = _admin_ctx("employer", "owner-a")
    response = routes._handle_delete_master_resume("t-6", employer, "d2")

    assert response.status_code == 404
    payload = _body(response)
    assert payload["ok"] is False
    assert payload["error"]["type"] == "validation"
