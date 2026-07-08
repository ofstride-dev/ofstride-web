from __future__ import annotations

import logging
import os
from typing import Any

_logger = logging.getLogger("ofstride.langfuse")


class LangfuseTracer:
    def __init__(self) -> None:
        self.enabled = False
        self._client: Any = None
        self._initialized = False

    def _ensure_init(self) -> None:
        if self._initialized:
            return
        self._initialized = True
        # Trigger .env loading via settings before reading env vars
        try:
            from core.settings import get_settings  # noqa: F401
            get_settings()
        except Exception:
            pass

        pk = os.getenv("LANGFUSE_PUBLIC_KEY", "").strip()
        sk = os.getenv("LANGFUSE_SECRET_KEY", "").strip()
        host = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com").strip()

        if pk and sk and not pk.startswith("pk-lf-your") and not sk.startswith("sk-lf-your"):
            try:
                from langfuse import Langfuse  # type: ignore[import]
                self._client = Langfuse(public_key=pk, secret_key=sk, host=host)
                self.enabled = True
                _logger.info("Langfuse tracing enabled host=%s", host)
            except ImportError:
                _logger.warning("langfuse package not installed; tracing disabled")
            except Exception as exc:
                _logger.warning("Langfuse init failed: %s", exc)

    def trace_turn(
        self,
        *,
        conversation_id: str,
        trace_id: str,
        user_message: str,
        rewritten_query: str | None,
        retrieved_chunks: list[dict],
        model_used: str,
        fallback_triggered: bool,
        system_prompt: str,
        user_prompt: str,
        response: str,
        latency_ms: float,
        input_tokens: int | None,
        output_tokens: int | None,
        route_decision: str,
    ) -> None:
        self._ensure_init()
        if not self.enabled or self._client is None:
            return
        try:
            trace = self._client.trace(
                id=trace_id,
                name="chat_turn",
                session_id=conversation_id,
                metadata={
                    "route_decision": route_decision,
                    "fallback_triggered": fallback_triggered,
                    "chunk_count": len(retrieved_chunks),
                    "rewritten_query": rewritten_query,
                    "model_used": model_used,
                },
                input={"user_message": user_message},
                output={"response": response},
            )
            trace.span(
                name="retrieval",
                input={"query": rewritten_query or user_message},
                output={
                    "chunks": [
                        {"score": c.get("score"), "metadata": c.get("metadata", {})}
                        for c in retrieved_chunks
                    ]
                },
                metadata={"chunk_count": len(retrieved_chunks)},
            )
            trace.generation(
                name="llm_generation",
                model=model_used,
                prompt=[
                    {"role": "system", "content": system_prompt[:500]},
                    {"role": "user", "content": user_prompt[:500]},
                ],
                completion=response,
                usage={"input": input_tokens, "output": output_tokens},
                latency=latency_ms / 1000,
            )
            self._client.flush()
        except Exception as exc:
            _logger.debug("Langfuse trace_turn failed: %s", exc)


_tracer = LangfuseTracer()


def get_tracer() -> LangfuseTracer:
    return _tracer
