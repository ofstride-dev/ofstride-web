import sys


sys.path.insert(0, "api")

from business_growth.shared.journey import get_journey_by_assessment_session  # noqa: E402


class _Query:
    def __init__(self, data):
        self._data = data

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        class _Result:
            pass

        out = _Result()
        out.data = self._data
        return out


class _SupaNoWebsite:
    def table(self, name):
        if name == "assessment_session":
            return _Query([{"id": "sess-3", "business_profile_id": "bp-3", "metadata": {"chat_signals": ["price sensitivity"]}}])
        if name == "business_profile":
            return _Query([
                {
                    "id": "bp-3",
                    "name": "Acme",
                    "domain": "no-website",
                    "industry": "Legal",
                    "target_geo": "Mumbai",
                    "growth_goal": "Generate leads quickly",
                    "current_channels": [],
                    "budget_band": "low",
                    "urgency_band": "high",
                }
            ])
        if name == "audit_run":
            return _Query([])
        return _Query([])


def test_journey_profile_only_guidance_for_no_website():
    data = get_journey_by_assessment_session(_SupaNoWebsite(), "sess-3")

    assert data is not None
    assert data["resume_state"]["assessmentSessionId"] == "sess-3"
    assert data["profile_only_guidance"] is not None
    assert data["profile_only_guidance"]["mode"] == "profile_only"
    assert data["profile_only_guidance"]["uses_chat_signals"] is True
