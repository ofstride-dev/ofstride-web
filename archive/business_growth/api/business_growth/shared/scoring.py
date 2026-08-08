"""Scoring helpers for Business Growth audits.

Phase 2 requires technical_score to be computed from the detected issue set,
not a hardcoded constant. This module keeps that logic centralized and testable.
"""
from __future__ import annotations


_SEVERITY_PENALTY = {
    "critical": 20,
    "high": 12,
    "medium": 7,
    "low": 3,
}


def _penalty_for_issue(issue: dict) -> int:
    severity = str(issue.get("severity") or "").lower()
    return _SEVERITY_PENALTY.get(severity, 5)


def compute_technical_score(issues: list[dict]) -> int:
    """Return a 0-100 technical score from issue severities.

    Starts at 100 and subtracts weighted penalties for each finding.
    """
    total_penalty = sum(_penalty_for_issue(issue) for issue in issues)
    return max(0, 100 - total_penalty)
