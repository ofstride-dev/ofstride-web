# Ofstride Agentic RAG Implementation Plan

## Objective
Build a production-ready, end-to-end Agentic RAG consulting assistant on Azure Static Web Apps + Azure Functions, with staged delivery and test gates after each stage.

## Agreed Decisions
- Chat widget will be wired into the web app with a modern Ofstride-specific consultant experience.
- Provider strategy: OpenAI/Azure OpenAI as primary, fallback providers retained.
- Add ingestion protection and abuse controls now.
- Implement in stages with validation loops before moving to next stage.

## Current Implementation Notes
- Orchestration graph is implemented in `api/shared/orchestration/graph.py` (topic guard + intake router + retrieval + answer generation + CTA closure).
- Prompting is modularized in `api/shared/prompts/consultant_agent.py`.
- Session profile memory is implemented (`name`, `email`, `phone`, `service_needed`, `area_of_interest`, `timeline`, `contact_mode`).
- Consultant fallback retrieval is implemented from local seed data via `api/shared/retrieval/local_consultant_directory.py`.
- Company support context module is implemented in `api/shared/knowledge/company_profile.py`.
- Qdrant cloud use is supported via `QDRANT_URL` and `QDRANT_API_KEY` in environment settings.

## Guiding Principles
- Production-first reliability, not demo-only behavior.
- Cost-aware defaults for small-company/free-tier constraints.
- Observable and debuggable at every stage.
- Contract-first API design to avoid frontend/backend drift.

---

## Stage 0 - Foundation and Contracts

### Tasks
- [x] Define canonical API contracts for:
  - [x] `POST /api/chat`
  - [x] `GET /api/health`
  - [x] `POST /api/ingest`
  - [x] `GET /api/consultants/search`
- [x] Consolidate shared types so frontend and backend agree on fields and error shape.
- [x] Add versioned response envelope (`ok`, `data`, `error`, `trace_id`).
- [x] Add clear error taxonomy (validation, provider, retrieval, guardrail, infra).

### Test Gate
- [ ] Contract tests pass (request/response schema).
- [x] Frontend can parse success and failure payloads deterministically.
- [x] No duplicate type definitions in frontend.

---

## Stage 1 - Backend Core (Real, not placeholder)

### Tasks
- [x] Replace placeholder modules with real implementations:
  - [x] `settings` helper with env validation and defaults.
  - [x] LLM factory with primary and fallback selection.
  - [x] Embedding factory.
  - [x] Qdrant store methods (`ensure_collection`, `add_documents`, `similarity_search`, `collection_info`).
  - [x] Parser entrypoint (`parse_file`) for PDF/CSV/XLSX/TXT/PPT where applicable.
  - [x] Session store behavior for short-lived conversational memory.
- [x] Implement real chat orchestration flow:
  - [x] topic guard -> intake-first routing -> retrieve -> answer generation -> source payload.
  - [x] query rewrite (optional).
  - [x] rerank/light filter.
  - [ ] citation formatting in final answer text.
- [x] Ensure all existing functions call only implemented methods.

### Test Gate
- [x] `health` returns ready with all checks green.
- [x] `chat` returns grounded responses with sources.
- [ ] `consultants/search` returns valid ranked results.
- [ ] `ingest` indexes documents and retrieval can find them.

---

## Stage 2 - Security and Abuse Controls (Must-have)

### Tasks
- [x] Protect ingest endpoint:
  - [x] shared secret header or token validation.
  - [x] content-type and size limits.
  - [x] file extension allowlist.
- [x] Add lightweight rate limiting strategy for public endpoints.
- [x] Add input validation and sanitization on all routes.
- [x] Add CORS policy hardening by environment.

### Test Gate
- [ ] Unauthorized ingest calls blocked.
- [ ] Oversized/invalid files rejected with clear errors.
- [ ] Burst traffic cannot exhaust free-tier unexpectedly.

---

## Stage 3 - Chat UI Integration (Modern Ofstride Experience)

### Tasks
- [x] Wire `ChatWidget` into app (dedicated route and optional floating launcher).
- [ ] Update visual design for Ofstride consultant brand:
  - [ ] trust-first header, consultant-oriented prompts, clear source/citation chips.
  - [x] loading and graceful degradation states.
  - [x] retry state.
  - [ ] mobile-first interaction polish and accessibility.
- [ ] Add explicit conversation controls:
  - [x] clear chat
  - [x] session reset
  - [x] retry last response
- [x] Ensure UI matches new API error contract.

### Test Gate
- [ ] Chat visible and usable on desktop and mobile.
- [ ] UX states covered (empty, loading, success, no-results, error).
- [ ] Accessibility baseline passes (focus order, keyboard, labels).

---

## Stage 4 - Provider Strategy and Cost Controls

### Tasks
- [x] Enforce primary provider (OpenAI/Azure OpenAI) with fallback chain.
- [x] Add timeout/circuit-breaker behavior per provider.
- [ ] Add token/cost budgeting controls:
  - [x] max context chunking
  - [x] response length caps
  - [x] configurable `k` retrieval
- [x] Log fallback reason in response metadata.
- [x] Log provider used in response metadata.

### Test Gate
- [ ] Primary path works under normal conditions.
- [ ] Fallback activates when primary fails.
- [ ] Budget controls prevent runaway usage.

---

## Stage 5 - Observability and Reliability

### Tasks
- [ ] Add structured logs with correlation IDs.
- [x] Add optional tracing (Langfuse or equivalent) with environment toggles.
- [x] Add synthetic health checks and readiness probes.
- [ ] Add quality counters (hit-rate, no-result-rate, fallback-rate).

### Test Gate
- [ ] End-to-end trace from UI request to backend response.
- [ ] Failure scenarios produce actionable diagnostics.
- [ ] SLO dashboard baseline defined.

---

## Stage 6 - Deployment and Runtime Hardening

### Tasks
- [ ] Validate Azure Static Web Apps deployment pipeline for frontend env injection.
- [ ] Ensure SWA routing fallback works on deep links.
- [ ] Verify Functions runtime settings and extension compatibility.
- [ ] Add staging smoke tests after each deploy.

### Test Gate
- [ ] Production deploy passes smoke checks (`/`, `/contact-form`, `/api/health`, `/api/chat`).
- [ ] No local-vs-prod behavior mismatch for form submission or chat endpoints.

---

## Stage 7 - RAG Quality Evaluation Loop

### Tasks
- [ ] Build a small evaluation dataset (consultant queries + expected behavior).
- [ ] Add scoring for relevance, grounding, hallucination, and actionability.
- [ ] Run periodic eval before release.
- [ ] Tune retrieval and prompts based on eval outcomes.

### Test Gate
- [ ] Minimum quality threshold met before release.
- [ ] Regression checks run on changes to prompts/retrieval.

---

## Data Needed From You
To proceed efficiently, please provide:
- [x] Initial consultant data set (CSV/JSON/resumes/profiles).
- [ ] Target metadata fields (skills, experience, location, domain, availability, rate).
- [ ] 20 to 50 real user questions you expect from clients.
- [ ] Any compliance constraints (PII rules, retention limits).
- [ ] Preferred answer style (short recommendation vs detailed consultant comparison).
- [x] At the end recommend them to setup a short call with relevant consultant-share the calling (talk to link from UI)
- [ ] You can also search around our webapp to get the resoponse 
- [x] Response should be fully structured, polite, professional, assertive and intentful

---

## Added Patterns (Implemented)
- [x] Intake-first conversational router with mandatory slot filling (`email`, `phone`) before deeper recommendations.
- [x] Progressive disclosure: asks one missing required detail at a time.
- [x] Session memory and profile persistence across turns.
- [x] Out-of-scope polite redirect instead of hard block.
- [x] End-of-response CTA options: `Send a message` or `Schedule a call`.
- [x] Local consultant directory fallback when vector retrieval has low/no coverage.

## Missed Patterns / Additional Tasks (To Implement)
- [x] Add explicit confidence threshold + fallback branch when retrieved results are weak/noisy.
- [ ] Add deterministic response templates for high-frequency intents (company intro, pricing approach, booking flow).
- [ ] Add analytics events for intake completion funnel (`email_captured`, `phone_captured`, `cta_selected`).
- [ ] Add human handoff command (for example `talk to human`) with contact escalation path.
- [ ] Add conversation test set for scripted multi-turn intake validation and regression checks.

---

## Implementation Order (Execution)
1. Stage 0
2. Stage 1
3. Stage 2
4. Stage 3
5. Stage 4
6. Stage 5
7. Stage 6
8. Stage 7

No stage proceeds until its Test Gate is green.
