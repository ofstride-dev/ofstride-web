import json
import importlib
import sys


sys.path.insert(0, "api")

audit_worker = importlib.import_module("business_growth.audit_worker.__init__")


class _Msg:
    def __init__(self, payload: dict):
        self._payload = payload

    def get_body(self) -> bytes:
        return json.dumps(self._payload).encode("utf-8")


def test_audit_worker_marks_complete_on_success(monkeypatch):
    calls = []

    monkeypatch.setattr(audit_worker, "get_supabase", lambda: object())
    monkeypatch.setattr(audit_worker, "crawl_and_score", lambda *_args, **_kwargs: {"pages": [], "issues": [], "page_count": 2, "technical_score": 78})
    monkeypatch.setattr(audit_worker, "_persist", lambda *_args, **_kwargs: (2, 78))
    monkeypatch.setattr(audit_worker, "mark_crawling", lambda _s, run_id: calls.append(("crawling", run_id)))
    monkeypatch.setattr(audit_worker, "mark_complete", lambda _s, run_id, count, score: calls.append(("complete", run_id, count, score)))
    monkeypatch.setattr(audit_worker, "mark_failed", lambda _s, run_id, err: calls.append(("failed", run_id, err)))

    audit_worker.main(_Msg({"audit_run_id": "run-1", "root_url": "https://example.com", "max_pages": 3, "max_depth": 1}))

    assert ("crawling", "run-1") in calls
    assert ("complete", "run-1", 2, 78) in calls
    assert not any(entry[0] == "failed" for entry in calls)


def test_audit_worker_marks_failed_on_exception(monkeypatch):
    calls = []

    monkeypatch.setattr(audit_worker, "get_supabase", lambda: object())
    monkeypatch.setattr(audit_worker, "mark_crawling", lambda _s, run_id: calls.append(("crawling", run_id)))
    monkeypatch.setattr(audit_worker, "mark_complete", lambda *_args, **_kwargs: calls.append(("complete",)))
    monkeypatch.setattr(audit_worker, "mark_failed", lambda _s, run_id, err: calls.append(("failed", run_id, err)))

    def _raise(*_args, **_kwargs):
        raise RuntimeError("crawl boom")

    monkeypatch.setattr(audit_worker, "crawl_and_score", _raise)

    audit_worker.main(_Msg({"audit_run_id": "run-2", "root_url": "https://example.com"}))

    assert ("crawling", "run-2") in calls
    assert any(entry[0] == "failed" and entry[1] == "run-2" for entry in calls)
    assert not any(entry[0] == "complete" for entry in calls)
