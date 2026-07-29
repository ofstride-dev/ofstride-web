"""Layer 1 — Keyword Overlap Engine."""
from __future__ import annotations
import re
from typing import Any

def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()

def _tokenize(text: str) -> list[str]:
    return [t for t in re.split(r"[^a-z0-9+#./\-]+", _normalize(text)) if len(t) > 2]

def _ngrams(tokens: list[str], n: int = 2) -> set[str]:
    return {" ".join(tokens[i:i + n]) for i in range(max(0, len(tokens) - n + 1))[:50]}

_JD_SECTION_HEADERS = [
    r"(?:required|must-have|essential|key)\s*(?:skills?|qualifications?|competencies?)",
    r"(?:preferred|nice-to-have|desired|good-to-have)\s*(?:skills?|qualifications?|competencies?)",
    r"(?:education|qualifications?|certifications?)\s*(?:required|preferred)?",
    r"(?:responsibilities|what you.ll do|role overview|about the role)",
    r"(?:requirements?|what we.re looking for)",
]

def _extract_jd_section(jd_text: str, label: str) -> str:
    text = _normalize(jd_text)
    lines = text.split("\n")
    capture: list[str] = []
    in_section = False
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if in_section:
                break
            continue
        if any(re.search(pat, stripped) for pat in _JD_SECTION_HEADERS):
            in_section = True
            continue
        if in_section:
            if re.match(r"^#{1,3}\s", stripped) or re.match(r"^[a-z\s]+:$", stripped):
                break
            capture.append(stripped)
    return "\n".join(capture)[:600]

def extract_jd_skills(jd_text: str) -> dict[str, Any]:
    required_text = _extract_jd_section(jd_text, "required")
    preferred_text = _extract_jd_section(jd_text, "preferred")
    all_tokens = _tokenize(jd_text)
    required_tokens = _tokenize(required_text)
    preferred_tokens = _tokenize(preferred_text)
    def _dedupe_ordered(items: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for item in items:
            if item not in seen:
                seen.add(item)
                out.append(item)
        return out
    return {
        "required_skills": _dedupe_ordered(required_tokens),
        "preferred_skills": _dedupe_ordered(preferred_tokens),
        "all_keywords": _dedupe_ordered(all_tokens),
        "bigrams": sorted(_ngrams(all_tokens, 2)),
        "raw_required_section": required_text,
        "raw_preferred_section": preferred_text,
    }

def _build_regex(skill: str) -> re.Pattern:
    escaped = re.escape(skill)
    return re.compile(rf"(^|[^a-z0-9]){escaped}([^a-z0-9]|$)", re.IGNORECASE)

def match_resume_against_jd(resume_text: str, jd_skills: dict[str, Any]) -> dict[str, Any]:
    normalized_resume = _normalize(resume_text)
    def _context(skill: str) -> str:
        match = _build_regex(skill).search(resume_text)
        if not match:
            return ""
        start = max(0, match.start() - 40)
        end = min(len(resume_text), match.end() + 40)
        snippet = resume_text[start:end].replace("\n", " ")
        return snippet.strip()[:120]
    matched_required: list[dict[str, str]] = []
    missing_required: list[str] = []
    matched_preferred: list[dict[str, str]] = []
    for skill in jd_skills["required_skills"]:
        if _build_regex(skill).search(normalized_resume):
            matched_required.append({"skill": skill, "context": _context(skill)})
        else:
            missing_required.append(skill)
    for skill in jd_skills["preferred_skills"]:
        if _build_regex(skill).search(normalized_resume):
            matched_preferred.append({"skill": skill, "context": _context(skill)})
    matched_bigrams: list[str] = []
    missing_bigrams: list[str] = []
    for bigram in jd_skills["bigrams"]:
        if bigram in normalized_resume:
            matched_bigrams.append(bigram)
        else:
            missing_bigrams.append(bigram)
    total_required = len(jd_skills["required_skills"])
    denominator = total_required + len(jd_skills["bigrams"])
    overlap_ratio = round((len(matched_required) + len(matched_bigrams)) / max(1, denominator), 4)
    return {
        "matched_required": matched_required,
        "matched_preferred": matched_preferred,
        "missing_required": missing_required,
        "matched_bigrams": matched_bigrams,
        "missing_bigrams": missing_bigrams,
        "overlap_ratio": overlap_ratio,
        "total_required": total_required,
        "total_preferred": len(jd_skills["preferred_skills"]),
        "matched_count_required": len(matched_required),
        "matched_count_preferred": len(matched_preferred),
    }
