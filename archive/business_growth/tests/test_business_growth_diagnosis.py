import sys


sys.path.insert(0, "api")

from business_growth.shared.diagnosis import build_diagnosis_payload  # noqa: E402


class _Query:
    def __init__(self, data):
        self._data = data

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def execute(self):
        class _Result:
            pass

        out = _Result()
        out.data = self._data
        return out


class _Supa:
    def table(self, name):
        if name == "issue_finding":
            return _Query([
                {"rule_id": "missing_viewport_meta", "severity": "high", "category": "technical"},
                {"rule_id": "meta_description_weak", "severity": "medium", "category": "onpage"},
            ])
        if name == "audit_run":
            return _Query([{"assessment_session_id": "sess-1"}])
        if name == "assessment_session":
            return _Query([{"business_profile_id": "bp-1"}])
        if name == "business_profile":
            return _Query([
                {
                    "industry": "Legal",
                    "target_geo": "Bengaluru",
                    "growth_goal": "Increase inbound leads",
                    "current_channels": [],
                    "budget_band": "low",
                    "urgency_band": "high",
                }
            ])
        return _Query([])


def test_build_diagnosis_payload_uses_profile_and_issues():
    payload = build_diagnosis_payload(_Supa(), "run-1")

    assert payload["audit_run_id"] == "run-1"
    assert payload["overall_score"] < 100
    assert any("Bengaluru" in item for item in payload["opportunities"])
    assert any("Legal" in item for item in payload["opportunities"])
    assert any("constrained budget" in item.lower() for item in payload["blockers"])
    assert payload["issue_counts"]["high"] >= 1
