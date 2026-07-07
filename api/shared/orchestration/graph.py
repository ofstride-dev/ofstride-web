from __future__ import annotations

from core.llm_factory import get_llm_factory
from core.settings import get_settings
from guardrails.topic_guard import TopicGuard
from knowledge.company_profile import get_company_profile_context
from memory.session_store import get_session_store
from orchestration.intake_flow import (
    append_cta_options,
    build_domain_search_query,
    build_exit_message,
    build_intro_prompt,
    build_intake_completed_message,
    build_next_required_prompt,
    build_interest_prompt,
    build_services_catalog_response,
    detect_domain_interest,
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

    @staticmethod
    def _normalize_response_text(text: str) -> str:
        if not text:
            return text

        banned_prefixes = (
            "conversation history:",
            "known session profile:",
            "company support context:",
            "retrieved context:",
            "user question:",
            "request summary:",
            "assistant:",
            "user:",
        )
        normalized_lines: list[str] = []
        seen_content: set[str] = set()
        previous_blank = False

        for raw_line in text.replace("\r\n", "\n").split("\n"):
            line = raw_line.rstrip()
            key = line.strip().lower()

            if not key:
                if not previous_blank and normalized_lines:
                    normalized_lines.append("")
                previous_blank = True
                continue

            if any(key.startswith(prefix) for prefix in banned_prefixes):
                continue

            if key in seen_content:
                continue

            normalized_lines.append(line)
            seen_content.add(key)
            previous_blank = False

        return "\n".join(normalized_lines).strip()

    @staticmethod
    def _deterministic_fallback_answer(query: str, profile: dict[str, str], reason: str) -> str:
        name = (profile.get("name") or "there").strip() or "there"
        service_hint = profile.get("service_needed") or profile.get("area_of_interest") or "your requirement"
        return (
            f"Thanks, {name}. I can still help map {service_hint} to the right Ofstride consultants. "
            "I am currently using a resilient fallback path while some backend dependencies recover.\n\n"
            "Based on our service lines, we can proceed with one of these domains:\n"
            "1) People & Workforce\n"
            "2) Finance & Compliance\n"
            "3) Technology & Growth\n\n"
            f"Technical note: {reason}."
        )

    @staticmethod
    def _build_actions(values: list[str]) -> list[dict]:
        return [
            {
                "id": f"act_{idx + 1}",
                "label": value,
                "value": value,
                "kind": "quick_reply",
            }
            for idx, value in enumerate(values)
        ]

    async def _search_consultants(self, query: str) -> tuple[list, str | None]:
        docs = []
        retrieval_warning = None
        try:
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
        except Exception as retrieval_exc:
            retrieval_warning = f"retrieval_unavailable:{str(retrieval_exc)[:120]}"

        if not docs:
            try:
                docs = self.local_directory.search(query=query, k=min(5, self.settings.retrieval_k))
            except Exception as local_exc:
                if retrieval_warning is None:
                    retrieval_warning = f"local_directory_unavailable:{str(local_exc)[:120]}"

        return docs, retrieval_warning

    @staticmethod
    def _build_domain_consultant_response(
        domain: str,
        docs: list,
        profile: dict[str, str],
        missing_required: list[str],
    ) -> str:
        name = (profile.get("name") or "").strip()
        greeting = f"Certainly, {name}." if name else "Certainly."

        # Use specific service type if captured in profile, otherwise use domain
        service_type = profile.get("service_needed") or domain

        if not docs:
            return (
                f"{greeting} Based on your interest in {service_type}, I can help shortlist the right Ofstride consultant.\n\n"
                "Summary:\n"
                f"- Focus area: {service_type}\n"
                "- Consultant options: I am preparing the best-fit shortlist.\n"
                "- Next step: share your exact scope or timeline and I will refine the recommendation politely and precisely."
            )

        lines = [
            f"{greeting} Based on your interest in {service_type}, here is a concise consultant shortlist.",
            "",
            "Recommended consultants:",
        ]

        for index, doc in enumerate(docs[:3], start=1):
            metadata = doc.metadata or {}
            consultant_name = metadata.get("consultant_name") or metadata.get("source") or "Ofstride Consultant"
            role = metadata.get("role") or domain
            location = metadata.get("location") or "India"
            brief_summary = metadata.get("brief_summary") or (doc.page_content or "Profile summary available on request.")
            lines.extend(
                [
                    f"{index}. {consultant_name}",
                    f"   Role: {role}",
                    f"   Location: {location}",
                    f"   Brief profile: {brief_summary}",
                ]
            )

        lines.extend(
            [
                "",
                "Recommended next step:",
                "- Share your exact requirement, timeline, or preferred mode of discussion and I will narrow this to the best fit.",
            ]
        )

        if missing_required:
            lines.append(f"- If convenient, please also share your {missing_required[0]} so I can keep the recommendation aligned for follow-up.")

        return "\n".join(lines)

    async def run(self, *, query: str, session_id: str) -> dict:
        allowed, reason = self.topic_guard.check(query)
        if not allowed:
            polite_redirect = (
                "I am focused on Ofstride services, consultant recommendations, and engagement planning. "
                "If you share your business requirement, preferred domain, or need for a call, I can help concisely."
            )
            response_text = self._normalize_response_text(polite_redirect)
            return {
                "response": response_text,
                "session_id": session_id,
                "route_decision": "blocked",
                "confidence": 0.0,
                "sources": [],
                "provider_used": "none",
                "fallback_reason": reason or "out_of_scope",
                "ui_hints": {
                    "actions": self._build_actions(
                        [
                            "People & Workforce services",
                            "Finance & Compliance services",
                            "Technology & Growth services",
                            "Schedule a call",
                        ]
                    ),
                    "next_required_field": None,
                },
            }

        history = self.session_store.get(session_id)
        previous_profile = self.session_store.get_profile(session_id)
        profile_updates = extract_profile_updates(query)
        profile = self.session_store.upsert_profile(session_id, profile_updates)

        lowered_query = query.lower().strip()
        first_turn = len(history) == 0
        domain_interest = detect_domain_interest(query)
        direct_lookup = has_direct_consulting_intent(query) and (
            "consultant" in lowered_query
            or "who is" in lowered_query
            or "tell me about" in lowered_query
            or "profile" in lowered_query
        )
        bypass_intake = direct_lookup or domain_interest is not None

        if is_exit_intent(query):
            answer = self._normalize_response_text(build_exit_message())
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
                "ui_hints": {
                    "actions": self._build_actions(["Send a message", "Schedule a call"]),
                    "next_required_field": None,
                },
            }

        missing_required = missing_required_fields(profile)
        missing_required_before = missing_required_fields(previous_profile)

        if missing_required and not bypass_intake:
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

            intake_prompt = self._normalize_response_text(intake_prompt)

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
                "ui_hints": {
                    "actions": self._build_actions(
                        [
                            "People & Workforce",
                            "Finance & Compliance",
                            "Technology & Growth",
                            "Schedule a call",
                        ]
                    ),
                    "next_required_field": missing_required[0],
                },
            }

        if domain_interest:
            search_query = build_domain_search_query(domain_interest)
            docs, retrieval_warning = await self._search_consultants(search_query)
            if not docs:
                docs, fallback_warning = await self._search_consultants(query)
                retrieval_warning = retrieval_warning or fallback_warning

            answer = self._normalize_response_text(
                self._build_domain_consultant_response(domain_interest, docs, profile, missing_required)
            )
            self.session_store.append(session_id, {"role": "user", "content": query})
            self.session_store.append(session_id, {"role": "assistant", "content": answer})

            return {
                "response": answer,
                "session_id": session_id,
                "route_decision": "kb_success" if docs else "kb_no_results",
                "confidence": 0.92 if docs else 0.55,
                "sources": self._format_sources(docs),
                "provider_used": "domain_router",
                "fallback_reason": retrieval_warning,
                "session_profile": profile,
                "ui_hints": {
                    "actions": self._build_actions(
                        [
                            "People & Workforce",
                            "Finance & Compliance",
                            "Technology & Growth",
                            "Schedule a call",
                        ]
                    ),
                    "highlight_consultants": bool(docs),
                    "next_required_field": missing_required[0] if missing_required else None,
                },
            }

        if profile.get("interest_prompted") != "yes":
            # If the user already asked a specific consultant/service question,
            # continue directly to retrieval instead of forcing a generic interest prompt.
            if not has_direct_consulting_intent(query):
                base = build_interest_prompt(profile.get("name"))
                if len(missing_required_before) > 0:
                    base = f"{build_intake_completed_message()}\n\n{base}"
                answer = self._normalize_response_text(append_cta_options(base))
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
                    "ui_hints": {
                        "actions": self._build_actions(["Yes, show services", "Schedule a call"]),
                        "next_required_field": None,
                    },
                }
            profile = self.session_store.upsert_profile(session_id, {"interest_prompted": "yes"})

        if is_affirmative_interest(query):
            services_message, services_sources = build_services_catalog_response()
            answer = self._normalize_response_text(append_cta_options(services_message))
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
                "ui_hints": {
                    "actions": self._build_actions(
                        [
                            "People & Workforce",
                            "Finance & Compliance",
                            "Technology & Growth",
                        ]
                    ),
                    "highlight_consultants": True,
                    "next_required_field": None,
                },
            }

        # If user does not want service catalog but asks a specific consultant/service question,
        # continue to retrieval branch below.
        if ("service" in lowered_query or "consultant" in lowered_query) and (
            "not interested" in lowered_query
        ):
            answer = self._normalize_response_text(build_exit_message())
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
                "ui_hints": {
                    "actions": self._build_actions(["Send a message", "Schedule a call"]),
                    "next_required_field": None,
                },
            }

        docs, retrieval_warning = await self._search_consultants(query)

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

        try:
            selection = await self.llm_factory.get_healthy_llm_with_metadata()
            provider = selection.provider
            fallback_reason = selection.fallback_reason or retrieval_warning
        except Exception as provider_exc:
            fallback_reason = retrieval_warning or f"provider_selection_failed:{str(provider_exc)[:120]}"
            answer = self._deterministic_fallback_answer(
                query=query,
                profile=profile,
                reason=fallback_reason,
            )
            answer = self._normalize_response_text(append_cta_options(answer))

            self.session_store.append(
                session_id,
                {"role": "user", "content": query},
            )
            self.session_store.append(
                session_id,
                {"role": "assistant", "content": answer},
            )

            return {
                "response": answer,
                "session_id": session_id,
                "route_decision": route,
                "confidence": 0.3,
                "sources": self._format_sources(docs),
                "provider_used": "deterministic_fallback",
                "fallback_reason": fallback_reason,
                "session_profile": profile,
                "ui_hints": {
                    "actions": self._build_actions(
                        [
                            "People & Workforce",
                            "Finance & Compliance",
                            "Technology & Growth",
                            "Schedule a call",
                        ]
                    ),
                    "highlight_consultants": bool(docs),
                    "next_required_field": None,
                },
            }
        try:
            answer = await selection.client.agenerate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=self.settings.temperature,
                max_tokens=self.settings.max_tokens,
            )
            self.llm_factory.mark_provider_result(provider, success=True)
        except Exception as llm_exc:
            self.llm_factory.mark_provider_result(provider, success=False)
            provider = provider
            fallback_reason = fallback_reason or f"llm_generation_failed:{str(llm_exc)[:120]}"
            answer = self._deterministic_fallback_answer(
                query=query,
                profile=profile,
                reason=fallback_reason,
            )

        answer = self._normalize_response_text(append_cta_options(answer))

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
            "ui_hints": {
                "actions": self._build_actions(
                    [
                            "People & Workforce",
                            "Finance & Compliance",
                            "Technology & Growth",
                        "Schedule a call",
                    ]
                ),
                "highlight_consultants": bool(docs),
                "next_required_field": None,
            },
        }
