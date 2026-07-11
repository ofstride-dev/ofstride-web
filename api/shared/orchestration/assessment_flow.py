from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from core.settings import DATA_ROOT
from orchestration.intake_flow import STATE_INTAKE_FIELDS, STATE_OPEN, build_next_required_prompt, missing_required_fields


@dataclass
class AssessmentTurnResult:
    handled: bool
    next_state: str | None = None
    response_text: str = ""
    actions: list[dict[str, str]] | None = None
    profile_updates: dict[str, str] | None = None


_Q_FILE = DATA_ROOT / "assessment_questionnaire.json"
_CACHED: dict[str, Any] | None = None


def _load_config() -> dict[str, Any]:
    global _CACHED
    if _CACHED is not None:
        return _CACHED

    raw = _Q_FILE.read_text(encoding="utf-8")
    _CACHED = json.loads(raw)
    return _CACHED


def _normalize(text: str) -> str:
    return " ".join((text or "").strip().lower().split())


def _contains_any(text: str, tokens: set[str]) -> bool:
    normalized = _normalize(text)
    return any(token in normalized for token in tokens)


def _actions(options: list[str]) -> list[dict[str, str]]:
    return [
        {
            "id": f"assessment_{idx + 1}",
            "label": option,
            "value": option,
            "kind": "quick_reply",
        }
        for idx, option in enumerate(options)
    ]


def _resolve_option(user_text: str, options: list[str]) -> str | None:
    normalized = _normalize(user_text)
    if not normalized:
        return None

    exact_map = {_normalize(opt): opt for opt in options}
    if normalized in exact_map:
        return exact_map[normalized]

    for opt in options:
        if normalized in _normalize(opt) or _normalize(opt) in normalized:
            return opt

    return None


def _service_mapping(challenge: str) -> dict[str, str]:
    mapping = {
        "Growing the business": {
            "service_type": "Technology & Growth",
            "service_needed": "Business Strategy",
        },
        "Reducing costs": {
            "service_type": "Finance & Compliance",
            "service_needed": "Virtual CFO",
        },
        "People & HR challenges": {
            "service_type": "People & Workforce",
            "service_needed": "HR Consulting",
        },
        "Compliance & Legal": {
            "service_type": "Finance & Compliance",
            "service_needed": "Legal & Regulatory",
        },
        "AI & Automation": {
            "service_type": "Technology & Growth",
            "service_needed": "AI & Data Science",
        },
        "Operational inefficiencies": {
            "service_type": "Technology & Growth",
            "service_needed": "Business Strategy",
        },
        "Decision making & reporting": {
            "service_type": "Technology & Growth",
            "service_needed": "AI & Data Science",
        },
        "Not sure": {
            "service_type": "Technology & Growth",
            "service_needed": "Business Strategy",
        },
    }
    return mapping.get(challenge, {})


def _build_final_response(profile: dict[str, str], challenge: str, branch_response: str, priority: str) -> tuple[str, str, dict[str, str]]:
    config = _load_config()
    final_cfg = config.get("final_diagnosis", {})

    focus_areas = final_cfg.get("focus_areas", [])
    outcomes = final_cfg.get("typical_outcomes", [])

    lines = [
        branch_response,
        "",
        "Final Diagnosis",
        f"Your likely priority: {priority}",
        "",
        final_cfg.get("headline", "Based on your responses:"),
        final_cfg.get("label", "Operational Excellence + AI Enablement"),
        "",
        "Suggested Focus Areas:",
    ]

    for area in focus_areas:
        lines.append(f"- {area}")

    lines.append("")
    lines.append("Typical Outcomes:")
    for outcome in outcomes:
        lines.append(f"- {outcome}")

    lines.append("")
    lines.append(final_cfg.get("cta", "Would you like to book a strategy discussion?"))

    updates = {
        "assessment_status": "completed",
        "assessment_challenge": challenge,
        "assessment_priority": priority,
    }
    updates.update(_service_mapping(challenge))

    missing = missing_required_fields(profile)
    next_field = missing[0] if missing else None
    next_prompt = build_next_required_prompt([next_field]) if next_field else ""

    if next_prompt:
        lines.append("")
        lines.append("To arrange your complimentary 20-minute strategy discussion:")
        lines.append(next_prompt)

    return "\n".join(lines).strip(), (STATE_INTAKE_FIELDS if next_prompt else STATE_OPEN), updates


def handle_assessment_turn(current_state: str, profile: dict[str, str], query: str) -> AssessmentTurnResult:
    config = _load_config()
    q1 = config.get("question_1", {})
    q1_options = q1.get("options", [])
    branches = config.get("branches", {})

    phase = profile.get("assessment_phase", "inactive")
    start_tokens = {
        "start assessment",
        "start",
        "begin assessment",
        "assessment",
        "start the assessment",
    }

    if phase == "inactive":
        if current_state != STATE_OPEN:
            return AssessmentTurnResult(handled=False)

        chosen_q1 = _resolve_option(query, q1_options)
        should_start = chosen_q1 is not None or _contains_any(query, start_tokens)
        if not should_start:
            return AssessmentTurnResult(handled=False)

        if chosen_q1 is None:
            return AssessmentTurnResult(
                handled=True,
                next_state=STATE_OPEN,
                response_text=(
                    f"{config.get('welcome_message', '')}\n\n"
                    f"{q1.get('question', 'Which business challenge is biggest right now?')}"
                ),
                actions=_actions(q1_options),
                profile_updates={
                    "assessment_phase": "q1",
                    "assessment_status": "active",
                },
            )

        profile = dict(profile)
        profile["assessment_phase"] = "q1"
        query = chosen_q1

    if profile.get("assessment_phase") == "q1":
        selected = _resolve_option(query, q1_options)
        if selected is None:
            return AssessmentTurnResult(
                handled=True,
                next_state=STATE_OPEN,
                response_text=(
                    f"Please choose one of the assessment options.\n\n"
                    f"{q1.get('question', 'Which business challenge is biggest right now?')}"
                ),
                actions=_actions(q1_options),
            )

        branch = branches.get(selected, {})
        branch_question = str(branch.get("question", "")).strip()
        branch_options = branch.get("options", [])

        if branch_question and branch_options:
            return AssessmentTurnResult(
                handled=True,
                next_state=STATE_OPEN,
                response_text=branch_question,
                actions=_actions(branch_options),
                profile_updates={
                    "assessment_phase": "q2",
                    "assessment_status": "active",
                    "assessment_challenge": selected,
                },
            )

        response_text, next_state, updates = _build_final_response(
            profile=profile,
            challenge=selected,
            branch_response=str(branch.get("response", "Thank you for sharing.")),
            priority=str(branch.get("priority", "Operational Transformation")),
        )
        return AssessmentTurnResult(
            handled=True,
            next_state=next_state,
            response_text=response_text,
            actions=None,
            profile_updates=updates,
        )

    if profile.get("assessment_phase") == "q2":
        selected_challenge = profile.get("assessment_challenge", "")
        branch = branches.get(selected_challenge, {})
        branch_options = branch.get("options", [])
        selected_followup = _resolve_option(query, branch_options)

        if selected_followup is None:
            return AssessmentTurnResult(
                handled=True,
                next_state=STATE_OPEN,
                response_text=f"Please choose one option so I can continue the assessment.",
                actions=_actions(branch_options),
            )

        response_text, next_state, updates = _build_final_response(
            profile=profile,
            challenge=selected_challenge,
            branch_response=str(branch.get("response", "Thank you for sharing.")),
            priority=str(branch.get("priority", "Operational Transformation")),
        )
        updates["assessment_focus"] = selected_followup

        return AssessmentTurnResult(
            handled=True,
            next_state=next_state,
            response_text=response_text,
            actions=None,
            profile_updates=updates,
        )

    return AssessmentTurnResult(handled=False)


def get_active_assessment_prompt(profile: dict[str, str]) -> tuple[str, list[dict[str, str]]] | None:
    """Return the current configured assessment prompt and options, when assessment is active."""
    config = _load_config()
    phase = profile.get("assessment_phase", "inactive")

    q1 = config.get("question_1", {})
    q1_question = str(q1.get("question", "")).strip()
    q1_options = q1.get("options", [])
    branches = config.get("branches", {})

    if phase == "q1" and q1_question and q1_options:
        return q1_question, _actions(q1_options)

    if phase == "q2":
        selected_challenge = profile.get("assessment_challenge", "")
        branch = branches.get(selected_challenge, {})
        branch_question = str(branch.get("question", "")).strip()
        branch_options = branch.get("options", [])
        if branch_question and branch_options:
            return branch_question, _actions(branch_options)

    return None
