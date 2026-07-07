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
    get_next_state,
    STATE_OPEN,
    STATE_INTAKE_FIELDS,
    STATE_INTAKE_SUBMITTED,
    STATE_DOMAIN_SELECTED,
    STATE_CONSULTANTS_SHOWN,
    STATE_CONVERSATION,
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
        # Get session data first to check current state
        history = self.session_store.get(session_id)
        profile = self.session_store.get_profile(session_id)
        current_state = profile.get("state", STATE_OPEN)
        
        # DEBUG: Log session state
        history_len = len(history) if history else 0
        profile_keys = list(profile.keys()) if profile else []
        
        # 1. TOPIC GUARD CHECK (skip during intake to allow single-word inputs like names)
        if current_state not in [STATE_INTAKE_FIELDS, STATE_INTAKE_SUBMITTED]:
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
                    "state": STATE_OPEN,
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
        
        # 2. EXTRACT PROFILE FIELDS
        profile_updates = extract_profile_updates(query)
        profile = self.session_store.upsert_profile(session_id, profile_updates)
        
        # 3. USE STATE MACHINE TO DETERMINE NEXT STATE AND RESPONSE
        next_state, response_text, actions = get_next_state(current_state, profile, query)
        
        # Save state
        profile = self.session_store.upsert_profile(session_id, {"state": next_state})
        
        # 4. HANDLE DOMAIN-SELECTED STATE (retrieve consultants)
        if next_state == STATE_DOMAIN_SELECTED:
            domain = detect_domain_interest(query)
            if domain:
                search_query = build_domain_search_query(domain)
                docs, retrieval_warning = await self._search_consultants(search_query)
                if not docs:
                    docs, fallback_warning = await self._search_consultants(query)
                    retrieval_warning = retrieval_warning or fallback_warning
                
                missing_required = missing_required_fields(profile)
                response_text = self._normalize_response_text(
                    self._build_domain_consultant_response(domain, docs, profile, missing_required)
                )
                
                # Move to CONSULTANTS_SHOWN after retrieving
                next_state = STATE_CONSULTANTS_SHOWN
                profile = self.session_store.upsert_profile(session_id, {"state": next_state})
                
                sources = self._format_sources(docs)
                route_decision = "kb_success" if docs else "kb_no_results"
            else:
                sources = []
                route_decision = "kb_no_results"
        
        # 5. HANDLE CONVERSATION STATE (LLM-based retrieval)
        elif next_state == STATE_CONVERSATION:
            docs, retrieval_warning = await self._search_consultants(query)
            route_decision = "kb_success" if docs else "kb_no_results"
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
                response_text = self._deterministic_fallback_answer(
                    query=query,
                    profile=profile,
                    reason=fallback_reason,
                )
                response_text = self._normalize_response_text(append_cta_options(response_text))
                sources = []
                route_decision = "fallback"
                provider = None
            else:
                try:
                    response_text = await selection.client.agenerate(
                        system_prompt=system_prompt,
                        user_prompt=user_prompt,
                        temperature=self.settings.temperature,
                        max_tokens=self.settings.max_tokens,
                    )
                    self.llm_factory.mark_provider_result(provider, success=True)
                except Exception as llm_exc:
                    self.llm_factory.mark_provider_result(provider, success=False)
                    fallback_reason = fallback_reason or f"llm_generation_failed:{str(llm_exc)[:120]}"
                    response_text = self._deterministic_fallback_answer(
                        query=query,
                        profile=profile,
                        reason=fallback_reason,
                    )
                    route_decision = "fallback"

                response_text = self._normalize_response_text(append_cta_options(response_text))
                sources = self._format_sources(docs)
        
        else:
            # OPEN, INTAKE_FIELDS, INTAKE_SUBMITTED, CONSULTANTS_SHOWN: use state machine response as-is
            sources = []
            route_decision = "conversational"
            provider = None
            fallback_reason = None

        # 6. APPEND TO HISTORY
        self.session_store.append(session_id, {"role": "user", "content": query})
        self.session_store.append(session_id, {"role": "assistant", "content": response_text})

        # 7. BUILD RESPONSE
        missing_required = missing_required_fields(profile)
        confidence = 0.95 if next_state in [STATE_INTAKE_FIELDS, STATE_INTAKE_SUBMITTED] else 0.85
        
        return {
            "response": response_text,
            "session_id": session_id,
            "state": next_state,
            "route_decision": route_decision,
            "confidence": confidence,
            "sources": sources,
            "provider_used": provider.value if provider else "state_machine",
            "fallback_reason": fallback_reason,
            "session_profile": profile,
            "ui_hints": {
                "actions": actions if actions else self._build_actions(
                    [
                        "People & Workforce",
                        "Finance & Compliance",
                        "Technology & Growth",
                        "Schedule a call",
                    ]
                ),
                "next_required_field": missing_required[0] if missing_required else None,
            },
            "debug": {
                "history_length": len(history) if history else 0,
                "profile_fields": list(profile.keys()) if profile else [],
                "missing_required_fields": missing_required,
            },
        }
