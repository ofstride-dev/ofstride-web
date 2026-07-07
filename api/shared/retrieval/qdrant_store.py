from __future__ import annotations

import math
import uuid
from dataclasses import dataclass
from typing import Any

from qdrant_client import AsyncQdrantClient
from qdrant_client.http.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchAny,
    PointStruct,
    VectorParams,
)

from core.embedding_factory import get_embedding_factory
from core.settings import get_settings


@dataclass
class RetrievedDocument:
    page_content: str
    metadata: dict[str, Any]
    score: float | None = None


class QdrantStore:
    def __init__(self):
        self._settings = get_settings()
        self._embedding = get_embedding_factory().get_instance()
        self._memory_docs: list[dict[str, Any]] = []

        self._use_memory = (
            self._settings.use_inmemory_vector_store or not self._settings.qdrant_url
        )
        self.client = None

        if not self._use_memory:
            self.client = AsyncQdrantClient(
                url=self._settings.qdrant_url,
                api_key=self._settings.qdrant_api_key,
                timeout=20,
            )

    @staticmethod
    def _extract_doc(document: Any) -> tuple[str, dict[str, Any]]:
        if hasattr(document, "page_content"):
            content = str(getattr(document, "page_content", ""))
            metadata = dict(getattr(document, "metadata", {}) or {})
            return content, metadata

        if hasattr(document, "content"):
            content = str(getattr(document, "content", ""))
            metadata = dict(getattr(document, "metadata", {}) or {})
            return content, metadata

        if isinstance(document, dict):
            content = str(document.get("page_content", document.get("content", "")))
            metadata = dict(document.get("metadata", {}) or {})
            return content, metadata

        raise ValueError("Unsupported document object passed to store")

    async def ensure_collection(self) -> None:
        if self._use_memory:
            return

        assert self.client is not None
        exists = await self.client.collection_exists(self._settings.qdrant_collection)
        if exists:
            return

        await self.client.create_collection(
            collection_name=self._settings.qdrant_collection,
            vectors_config=VectorParams(
                size=self._settings.embedding_dimension,
                distance=Distance.COSINE,
            ),
        )

    async def add_documents(self, documents: list[Any]) -> int:
        if not documents:
            return 0

        normalized = [self._extract_doc(doc) for doc in documents]
        texts = [content for content, _ in normalized]
        embeddings = await self._embedding.aembed_documents(texts)

        if self._use_memory:
            for (content, metadata), vector in zip(normalized, embeddings):
                self._memory_docs.append(
                    {
                        "id": str(uuid.uuid4()),
                        "vector": vector,
                        "content": content,
                        "metadata": metadata,
                    }
                )
            return len(normalized)

        assert self.client is not None
        points = []
        for (content, metadata), vector in zip(normalized, embeddings):
            points.append(
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload={"page_content": content, "metadata": metadata},
                )
            )

        await self.client.upsert(
            collection_name=self._settings.qdrant_collection,
            points=points,
            wait=True,
        )
        return len(points)

    @staticmethod
    def _cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
        dot = sum(a * b for a, b in zip(vec_a, vec_b))
        norm_a = math.sqrt(sum(a * a for a in vec_a))
        norm_b = math.sqrt(sum(b * b for b in vec_b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    @staticmethod
    def _passes_filters(metadata: dict[str, Any], filters: dict[str, Any] | None) -> bool:
        if not filters:
            return True

        source_type_filter = filters.get("source_type") if isinstance(filters, dict) else None
        if isinstance(source_type_filter, dict) and "$in" in source_type_filter:
            allowed = source_type_filter["$in"]
            return metadata.get("source_type") in allowed

        return True

    async def similarity_search(
        self,
        *,
        query: str,
        k: int = 5,
        filters: dict[str, Any] | None = None,
    ) -> list[RetrievedDocument]:
        if not query.strip():
            return []

        query_embedding = await self._embedding.aembed_query(query)

        if self._use_memory:
            scored: list[tuple[float, dict[str, Any]]] = []
            for item in self._memory_docs:
                if not self._passes_filters(item.get("metadata", {}), filters):
                    continue
                score = self._cosine_similarity(query_embedding, item["vector"])
                scored.append((score, item))

            scored.sort(key=lambda x: x[0], reverse=True)
            top = scored[: max(1, k)]
            return [
                RetrievedDocument(
                    page_content=item["content"],
                    metadata=item["metadata"],
                    score=score,
                )
                for score, item in top
            ]

        assert self.client is not None

        qdrant_filter = None
        source_type_filter = filters.get("source_type") if isinstance(filters, dict) else None
        if isinstance(source_type_filter, dict) and "$in" in source_type_filter:
            qdrant_filter = Filter(
                must=[
                    FieldCondition(
                        key="metadata.source_type",
                        match=MatchAny(any=source_type_filter["$in"]),
                    )
                ]
            )

        hits = await self.client.search(
            collection_name=self._settings.qdrant_collection,
            query_vector=query_embedding,
            query_filter=qdrant_filter,
            limit=max(1, k),
            with_payload=True,
        )

        results: list[RetrievedDocument] = []
        for hit in hits:
            payload = hit.payload or {}
            results.append(
                RetrievedDocument(
                    page_content=str(payload.get("page_content", "")),
                    metadata=dict(payload.get("metadata", {}) or {}),
                    score=float(hit.score) if hit.score is not None else None,
                )
            )
        return results

    async def collection_info(self) -> dict[str, Any]:
        if self._use_memory:
            return {
                "backend": "memory",
                "collection": self._settings.qdrant_collection,
                "count": len(self._memory_docs),
            }

        assert self.client is not None
        info = await self.client.get_collection(self._settings.qdrant_collection)
        points_count = getattr(info, "points_count", None)
        return {
            "backend": "qdrant",
            "collection": self._settings.qdrant_collection,
            "count": points_count,
        }
