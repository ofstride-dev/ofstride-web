import sys


sys.path.insert(0, "api")

from business_growth.shared.roadmap import build_roadmap_items  # noqa: E402


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


class _Supa:
    def table(self, name):
        if name == "issue_finding":
            return _Query([
                {"rule_id": "thin_content", "severity": "medium", "category": "content"},
                {"rule_id": "canonical_missing", "severity": "low", "category": "technical"},
            ])
        if name == "audit_run":
            return _Query([{"assessment_session_id": "sess-2"}])
        if name == "assessment_session":
            return _Query([{"business_profile_id": "bp-2"}])
        if name == "business_profile":
            return _Query([
                {
                    "industry": "Manufacturing",
                    "target_geo": "Pune",
                    "growth_goal": "Increase qualified leads",
                }
            ])
        return _Query([])


def test_roadmap_items_follow_detected_issue_domains_only():
    items = build_roadmap_items(_Supa(), "run-2", "diag-2")

    assert items
    domains = {item["domain"] for item in items}
    assert domains.issubset({"technical", "content"})
    assert "conversion" not in domains
    assert any("Manufacturing" in (item.get("description") or "") for item in items)
