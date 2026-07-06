from __future__ import annotations

from core.llm_factory import get_llm_factory
from core.settings import get_settings
from guardrails.topic_guard import TopicGuard
from knowledge.company_profile import get_company_profile_context
from memory.session_store import get_session_store
from orchestration.intake_flow import (
    append_cta_options,
    build_exit_message,
    build_intro_prompt,
    build_intake_completed_message,
    build_next_required_prompt,
    build_interest_prompt,
    build_services_catalog_response,
    has_direct_consulting_intent,
    is_affirmative_interest,
    is_exit_intent,
    missing_required_fields,
)
from orchestration.session_profile import (
    build_profile_summary,
    extract_profile_updates,
)
from prompts.consultant_agent import build_system_prompt, build_user_prompt
from retrieval.local_consultant_directory import get_local_consultant_directory
from retrieval.qdrant_store import QdrantStore


class RAGGraph:
    def __init__(self):
        self.settings = get_settings()
        self.topic_guard = TopicGuard()
        self.session_store = get_session_store()
        self.store = QdrantStore()
        self.local_directory = get_local_consultant_directory()
        self.llm_factory = get_llm_factory()

    @staticmethod
    def _format_sources(docs: list) -> list[dict]:
        sources: list[dict] = []
        for doc in docs:
            content = (doc.page_content or "").strip()
            snippet = content[:420]
            if len(content) > 420:
                snippet += "..."
            sources.append(
                {
                    "content": snippet,
                    "metadata": doc.metadata or {},
                }
            )
        return sources

    @staticmethod
    def _build_context(docs: list) -> str:
        if not docs:
            return ""

        chunks: list[str] = []
        for idx, doc in enumerate(docs, start=1):
            source_name = doc.metadata.get("source") or doc.metadata.get("consultant_name") or "unknown"
            chunks.append(f"Source {idx} ({source_name}):\n{doc.page_content}")
        return "\n\n".join(chunks)

    @staticmethod
    def _cap_text(text: str, max_chars: int) -> str:
        if max_chars <= 0 or len(text) <= max_chars:
            return text
        return text[:max_chars].rstrip() + "\n\n[context truncated]"

    async def run(self, *, query: str, session_id: str) -> dict:
        allowed, reason = self.topic_guard.check(query)
        if not allowed:
            polite_redirect = (
                "Thank you for your question. I am best at helping with Ofstride services, "
                "consultant recommendations, and engagement support. "
                "If you share your requirement, I can guide you step-by-step."
            )
            response_text = append_cta_options(polite_redirect)
            return {
                "response": response_text,
                "session_id": session_id,
                "route_decision": "blocked",
                "confidence": 0.0,
                "sources": [],
                "provider_used": "none",
                "fallback_reason": reason or "out_of_scope",
            }

        history = self.session_store.get(session_id)
        previous_profile = self.session_store.get_profile(session_id)
        profile_updates = extract_profile_updates(query)
        profile = self.session_store.upsert_profile(session_id, profile_updates)

        lowered_query = query.lower().strip()
        first_turn = len(history) == 0

        if is_exit_intent(query):
            answer = build_exit_message()
            self.session_store.append(session_id, {"role": "user", "content": query})
            self.session_store.append(session_id, {"role": "assistant", "content": answer})
            return {
                "response": answer,
                "session_id": session_id,
                "route_decision": "conversational",
                "confidence": 0.95,
                "sources": [],
                "provider_used": "intake_router",
                "fallback_reason": None,
                "session_profile": profile,
            }

        missing_required = missing_required_fields(profile)
        missing_required_before = missing_required_fields(previous_profile)

        if missing_required:
            if first_turn and not profile.get("intro_shown") and missing_required[0] == "name":
                intake_prompt = build_intro_prompt()
                profile = self.session_store.upsert_profile(session_id, {"intro_shown": "yes"})
            else:
                intake_prompt = build_next_required_prompt(missing_required)

            if (len(missing_required_before) > len(missing_required)) and not first_turn:
                intake_prompt = (
                    "Thanks, that helps. "
                    f"{intake_prompt}"
                )

            self.session_store.append(
                session_id,
                {"role": "user", "content": query},
            )
            self.session_store.append(
                session_id,
                {"role": "assistant", "content": intake_prompt},
            )

            return {
                "response": intake_prompt,
                "session_id": session_id,
                "route_decision": "conversational",
                "confidence": 0.9,
                "sources": [],
                "provider_used": "intake_router",
                "fallback_reason": None,
                "session_profile": profile,
            }

        if profile.get("interest_prompted") != "yes":
            # If the user already asked a specific consultant/service question,
            # continue directly to retrieval instead of forcing a generic interest prompt.
            if not has_direct_consulting_intent(query):
                base = build_interest_prompt(profile.get("name"))
                if len(missing_required_before) > 0:
                    base = f"{build_intake_completed_message()}\n\n{base}"
                answer = append_cta_options(base)
                profile = self.session_store.upsert_profile(session_id, {"interest_prompted": "yes"})

                self.session_store.append(session_id, {"role": "user", "content": query})
                self.session_store.append(session_id, {"role": "assistant", "content": answer})

                return {
                    "response": answer,
                    "session_id": session_id,
                    "route_decision": "conversational",
                    "confidence": 0.95,
                    "sources": [],
                    "provider_used": "intake_router",
                    "fallback_reason": None,
                    "session_profile": profile,
                }
            profile = self.session_store.upsert_profile(session_id, {"interest_prompted": "yes"})

        if is_affirmative_interest(query):
            services_message, services_sources = build_services_catalog_response()
            answer = append_cta_options(services_message)
            self.session_store.append(session_id, {"role": "user", "content": query})
            self.session_store.append(session_id, {"role": "assistant", "content": answer})
            return {
                "response": answer,
                "session_id": session_id,
                "route_decision": "conversational",
                "confidence": 0.95,
                "sources": services_sources,
                "provider_used": "intake_router",
                "fallback_reason": None,
                "session_profile": profile,
            }

        # If user does not want service catalog but asks a specific consultant/service question,
        # continue to retrieval branch below.
        if ("service" in lowered_query or "consultant" in lowered_query) and (
            "not interested" in lowered_query
        ):
            answer = build_exit_message()
            self.session_store.append(session_id, {"role": "user", "content": query})
            self.session_store.append(session_id, {"role": "assistant", "content": answer})
            return {
                "response": answer,
                "session_id": session_id,
                "route_decision": "conversational",
                "confidence": 0.95,
                "sources": [],
                "provider_used": "intake_router",
                "fallback_reason": None,
                "session_profile": profile,
            }

        await self.store.ensure_collection()
        docs = await self.store.similarity_search(
            query=query,
            k=self.settings.retrieval_k,
            filters={
                "source_type": {
                    "$in": ["consultant_profile", "consultant_cv", "consultant_data"]
                }
            },
        )

        if not docs:
            docs = self.local_directory.search(query=query, k=min(5, self.settings.retrieval_k))

        route = "kb_success" if docs else "kb_no_results"
        context = self._build_context(docs)
        context = self._cap_text(context, self.settings.retrieval_max_context_chars)
        company_context = get_company_profile_context()
        short_history = history[-6:]
        history_block = "\n".join(
            [f"{msg.get('role', 'user')}: {msg.get('content', '')}" for msg in short_history]
        )
        profile_summary = build_profile_summary(profile)

        system_prompt = build_system_prompt()
        user_prompt = build_user_prompt(
            history_block=history_block,
            profile_summary=profile_summary,
            company_context=company_context,
            context=context,
            query=query,
        )

        selection = await self.llm_factory.get_healthy_llm_with_metadata()
        provider = selection.provider
        fallback_reason = selection.fallback_reason
        try:
            answer = await selection.client.agenerate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=self.settings.temperature,
                max_tokens=self.settings.max_tokens,
            )
            self.llm_factory.mark_provider_result(provider, success=True)
        except Exception:
            self.llm_factory.mark_provider_result(provider, success=False)
            raise

        answer = append_cta_options(answer)

        self.session_store.append(
            session_id,
            {"role": "user", "content": query},
        )
        self.session_store.append(
            session_id,
            {"role": "assistant", "content": answer},
        )

        confidence = min(0.95, 0.35 + (0.1 * len(docs))) if docs else 0.25

        return {
            "response": answer,
            "session_id": session_id,
            "route_decision": route,
            "confidence": round(confidence, 2),
            "sources": self._format_sources(docs),
            "provider_used": provider.value,
            "fallback_reason": fallback_reason,
            "session_profile": profile,
        }
