"""Layer 2 — Semantic Embedding & Cosine Similarity."""
from __future__ import annotations
import math
import re
from typing import Any
from shared.core.embedding_factory import get_embedding_factory

def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return round(dot / (norm_a * norm_b), 4)

_RESUME_SECTIONS = {
    "summary": r"(?:professional\s+)?summary|profile|about\s+me|objective",
    "experience": r"(?:work|professional|employment)\s*(?:experience|history)|experience",
    "education": r"education|academic|qualifications?|degrees?",
    "skills": r"(?:technical\s+)?skills?|core\s+competencies|expertise",
    "certifications": r"(?:professional\s+)?certifications?|licenses?|credentials",
}

_JD_SECTIONS = {
    "role_summary": r"(?:role|job|position)\s*(?:summary|overview|description)|about\s+the\s+role",
    "required_skills": r"(?:required|must-have|essential|key)\s*(?:skills?|qualifications?)",
    "preferred_skills": r"(?:preferred|nice-to-have|desired)\s*(?:skills?|qualifications?)",
    "qualifications": r"(?:education|qualifications?|experience)\s*(?:required|preferred)?",
    "responsibilities": r"(?:responsibilities|duties|what\s+you['']ll\s+do)",
}

def _extract_sections(text: str, section_map: dict[str, str]) -> dict[str, str]:
    lines = (text or "").split("\n")
    sections: dict[str, str] = {}
    current_label: str | None = None
    current_lines: list[str] = []
    def _flush() -> None:
        if current_label:
            content = "\n".join(current_lines).strip()
            if content and len(content) > 10:
                sections[current_label] = content
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        matched = False
        for label, pattern in section_map.items():
            if re.search(pattern, stripped, re.IGNORECASE):
                _flush()
                current_label = label
                current_lines = []
                matched = True
                break
        if not matched and current_label:
            current_lines.append(stripped)
    _flush()
    if not sections:
        sections["summary"] = (text or "").strip()[:2000]
    return sections

def _chunk_text(text: str, max_chars: int = 300) -> list[str]:
    if not text:
        return []
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        if len(current) + len(sentence) < max_chars:
            current = f"{current} {sentence}".strip()
        else:
            if current:
                chunks.append(current)
            current = sentence
    if current:
        chunks.append(current)
    return chunks

async def compute_similarity_scores(jd_text: str, resume_text: str) -> dict[str, Any]:
    """Layer 2: embed JD and resume sections, compute cosine similarity."""
    jd_sections = _extract_sections(jd_text, _JD_SECTIONS)
    resume_sections = _extract_sections(resume_text, _RESUME_SECTIONS)
    factory = get_embedding_factory()
    embedder = factory.get_instance()
    section_scores: dict[str, dict[str, float]] = {}
    for jd_label, jd_content in jd_sections.items():
        jd_embedding = await embedder.aembed_query(jd_content[:2000])
        row: dict[str, float] = {}
        for res_label, res_content in resume_sections.items():
            res_embedding = await embedder.aembed_query(res_content[:2000])
            row[res_label] = cosine_similarity(jd_embedding, res_embedding)
        section_scores[jd_label] = row
    jd_chunks = _chunk_text(jd_text)
    resume_chunks = _chunk_text(resume_text)
    all_jd_vectors = await embedder.aembed_documents(jd_chunks)
    all_resume_vectors = await embedder.aembed_documents(resume_chunks)
    best_matches: list[dict[str, Any]] = []
    for i, jd_chunk in enumerate(jd_chunks):
        best_score = 0.0
        best_resume = ""
        for j, res_chunk in enumerate(resume_chunks):
            if i < len(all_jd_vectors) and j < len(all_resume_vectors):
                score = cosine_similarity(all_jd_vectors[i], all_resume_vectors[j])
                if score > best_score:
                    best_score = score
                    best_resume = res_chunk
        if best_score > 0.0:
            best_matches.append({"jd_chunk": jd_chunk[:120], "resume_chunk": best_resume[:120], "score": best_score})
    section_avg = 0.0
    count = 0
    for _label, row in section_scores.items():
        if row:
            section_avg += max(row.values())
            count += 1
    section_avg = section_avg / max(1, count)
    chunk_avg = sum(m["score"] for m in best_matches) / max(1, len(best_matches)) if best_matches else 0.0
    overall_score = round(0.6 * chunk_avg + 0.4 * section_avg, 4)
    return {
        "section_scores": section_scores,
        "overall_score": overall_score,
        "best_match_per_jd_requirement": best_matches[:20],
    }
