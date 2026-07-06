from __future__ import annotations

import csv
from pathlib import Path

from core.settings import PROJECT_ROOT
from retrieval.qdrant_store import RetrievedDocument


class LocalConsultantDirectory:
    def __init__(self):
        self._rows: list[dict[str, str]] = []
        self._loaded = False

    def _load_if_needed(self) -> None:
        if self._loaded:
            return

        seed_path = Path(PROJECT_ROOT) / "data" / "consultants_seed.csv"
        self._loaded = True
        if not seed_path.exists():
            return

        with seed_path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            self._rows = [
                {k: str(v or "").strip() for k, v in row.items()}
                for row in reader
            ]

    @staticmethod
    def _score_row(query: str, row: dict[str, str]) -> float:
        lowered_query = query.lower()
        tokens = [token for token in lowered_query.replace(",", " ").split() if token]
        haystack = " ".join(
            [
                row.get("name", ""),
                row.get("location", ""),
                row.get("role", ""),
                row.get("email", ""),
            ]
        ).lower()

        score = 0.0
        for token in tokens:
            if token in haystack:
                score += 1.0

        if row.get("role") and row.get("role", "").lower() in lowered_query:
            score += 1.5
        if row.get("location") and row.get("location", "").lower() in lowered_query:
            score += 1.0
        return score

    def search(self, *, query: str, k: int = 5) -> list[RetrievedDocument]:
        self._load_if_needed()
        if not self._rows:
            return []

        scored: list[tuple[float, dict[str, str]]] = []
        for row in self._rows:
            score = self._score_row(query, row)
            if score > 0:
                scored.append((score, row))

        if not scored:
            scored = [(0.1, row) for row in self._rows[: max(1, min(k, 3))]]

        scored.sort(key=lambda item: item[0], reverse=True)
        top = scored[: max(1, k)]

        results: list[RetrievedDocument] = []
        for score, row in top:
            summary = (
                f"Consultant: {row.get('name', 'Unknown')}\n"
                f"Role: {row.get('role') or 'Not specified'}\n"
                f"Location: {row.get('location') or 'Not specified'}\n"
                f"Email: {row.get('email') or 'Not specified'}\n"
                f"Phone: {row.get('mobile') or 'Not specified'}"
            )
            metadata = {
                "source": "consultants_seed.csv",
                "source_type": "consultant_data",
                "consultant_name": row.get("name", "Unknown"),
                "location": row.get("location", ""),
                "role": row.get("role", ""),
                "email": row.get("email", ""),
                "mobile": row.get("mobile", ""),
            }
            results.append(RetrievedDocument(page_content=summary, metadata=metadata, score=score))

        return results


_local_directory = LocalConsultantDirectory()


def get_local_consultant_directory() -> LocalConsultantDirectory:
    return _local_directory
