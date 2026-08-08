# Business Growth ("Growth Execution Planner") — Implementation Plan

> Living reference for the phased hardening of the Business Growth audit → diagnosis → roadmap pipeline.
> Scope: **logic only** — all existing interfaces (routes, function.json, API client, UI pages) are already working and must not be changed in shape. Keep structure modular at all times.

---

## Context (why this exists)

The Growth Execution Planner is a consultant-led, lead-to-execution product:

```
intake → audit/start → audit-queue (worker) → audit/summary
   → diagnosis/generate → roadmap/generate → guidance/generate → review
```

Two confirmed defects block the product:
1. **Audit strands at `status: "queued"`** — `completed_at: null`, `page_count: 0`, `technical_score: null`. The queue worker either fails to bind in the deployed package or throws before writing a terminal status, and even on success never sets `completed_at`.
2. **Diagnosis is generic** — `diagnosis_generate`/`roadmap_generate` use hardcoded opportunities + roadmap items and **never read the captured `business_profile`** (industry, target_geo, growth_goal, current_channels, budget_band, urgency_band). The lead context is captured then discarded.

---

## Phase 1 — Make the core loop work end-to-end (unblock the product)

**Goal:** An audit run always reaches a terminal state; the diagnosis is derived from the captured lead context + real issues.

| # | Task | Files | Type |
|---|------|-------|------|
| 1.1 | Harden `audit_worker` — wrap entire body in try/except; always write a terminal `status` + `completed_at` + `error_message`; never strand at `queued`/`crawling` | `api/business_growth/audit_worker/__init__.py` | logic |
| 1.2 | Add a shared `terminal_status` helper so worker + start agree on terminal write semantics | `api/business_growth/shared/run_status.py` (new) | modular |
| 1.3 | Wire `business_profile` into diagnosis — read `assessment_session` → `business_profile`; derive blockers/opportunities from `growth_goal`+`industry`+`target_geo`+`current_channels`+`budget_band`+`urgency_band` + issues | `api/business_growth/shared/diagnosis.py` (new) | modular |
| 1.4 | Refactor `diagnosis_generate` and `roadmap_generate._compute_and_create_diagnosis` to call the shared `diagnosis.py` (kill duplication/drift) | `diagnosis_generate/__init__.py`, `roadmap_generate/__init__.py` | refactor |
| 1.5 | Add audit-completion polling on the audit page so the user sees `complete`/`failed` without manual reload | `src/pages/business-growth/audit.tsx` | logic |

**Validation (Phase 1):** ✅ PASSED
- ✅ `py_compile` clean on all 7 modified modules (run_status, diagnosis, audit_worker, diagnosis_generate, diagnosis_get, roadmap_generate, guidance_generate).
- ✅ Diagnosis logic produces profile-driven (non-generic) blockers/opportunities: sample Legal/Bengaluru/leads-goal profile → "Strengthen local SEO for Bengaluru", "Build Legal-specific content pillars", "High urgency but constrained budget limits fast execution".
- ✅ Edge cases handled (empty issues → score 100; empty profile → profile-derived blockers + fallback opportunity).
- ✅ audit.tsx polling change syntactically valid (esbuild OK).

**Gate:** All checks green → proceed to Phase 2.

---

## Phase 2 — Make the audit & roadmap real (depth + tailoring)

**Goal:** The audit measures more than the homepage; the roadmap is derived from findings + profile, not 3 static templates.

| # | Task | Files | Type |
|---|------|-------|------|
| 2.1 | Implement multi-page crawl using `max_pages`/`max_depth` from the queue message (BFS over internal links) | `audit_worker/__init__.py` + `shared/crawler.py` (new) | logic |
| 2.2 | Compute `technical_score` from actual issues (weighted penalty) instead of hardcoded 70 | `shared/crawler.py` / `shared/scoring.py` (new) | logic |
| 2.3 | Add more rule types (missing_viewport_meta, canonical_missing, broken_internal_link, image_missing_alt, thin_content) | `shared/rules.py` (new) | modular |
| 2.4 | Generate roadmap items dynamically from the issue set + profile (drop the 3 static templates) | `shared/roadmap.py` (new) → `roadmap_generate/__init__.py` | logic |
| 2.5 | Add missing intake form fields (budget_band, urgency_band, current_channels) on the frontend | `src/pages/business-growth/intake.tsx` | logic |

**Validation (Phase 2):**
- Python: import check; run a local crawl stub against a fixture HTML to confirm multiple `audit_page` rows + varied `issue_finding` rows.
- Confirm roadmap generation produces items only for detected issue domains.
- Frontend: `npm run build` succeeds.

**Gate:** All checks green → proceed to Phase 3.

---

## Phase 3 — Make it a real product (auth, persistence, tests)

**Goal:** Leads are owned/authenticated, the journey is resumable server-side, and the schema + logic are covered by tests.

| # | Task | Files | Type |
|---|------|-------|------|
| 3.1 | Check in the Supabase schema as a versioned migration (tables + `completed_at`/`error_message` columns) | `api/shared/security/business_growth_schema.sql` (new) | schema |
| 3.2 | Add pytest coverage for audit_worker, diagnosis, roadmap | `tests/test_business_growth_*.py` (new) | tests |
| 3.3 | Server-side journey resume (lookup by assessment_session across devices) | `shared/journey.py` (new) | logic |

**Validation (Phase 3):**
- `pytest tests/test_business_growth_*.py` passes.
- Migration SQL is idempotent (`IF NOT EXISTS`) and re-runnable.

**Gate:** All checks green → done.

---

## Next steps (execute now)

These are the immediate productization steps after Phase 3 so the planner can serve both website and no-website leads at scale.

### 1) Ship and verify in environment
- Apply migration: `api/shared/security/business_growth_schema.sql` to Supabase.
- Deploy updated Business Growth functions and frontend.
- Enable temporary open-mode rerun support (no auth gate) for assessment reruns:
  - if a submitted `assessment_session_id` is stale/missing, auto-bootstrap a session server-side instead of throwing HTTP 500.
- Run smoke flow in target env:
   - intake → audit start → diagnosis generate → roadmap generate → review approve
   - journey resume by `assessment_session_id`
   - verify `audit_run.completed_at` and `audit_run.error_message` on success/failure paths.
   - verify re-running an existing assessment no longer returns `Request failed (HTTP 500)`.

### 2) No-website lead operating mode
- Keep current profile-only fallback for leads with no website.
- Standardize no-website domain markers in intake (`no-website`, `n/a`, `none`) so fallback is deterministic.
- Add consultant playbook for profile-only output:
   - quick offer framing
   - one-page landing recommendation
   - channel bootstrap sequence by budget/urgency.

### 3) Integrate OfStride chat lead signals
- Persist chat-derived lead signals into `assessment_session.metadata.chat_signals`.
- Minimum signal schema per lead:
   - `pain_points: string[]`
   - `intent_stage: "cold"|"warm"|"hot"`
   - `objections: string[]`
   - `service_interest: string[]`
   - `budget_hint: string`
   - `urgency_hint: string`
- Use these signals to enrich profile-only findings and diagnosis narratives.

### 4) Add rollout safeguards
- Add one integration test for `GET /business-growth/journey?assessment_session_id=...`.
- Add dashboards/alerts:
   - % audits reaching terminal state within SLA
   - % no-website leads routed to profile-only mode
   - % sessions with chat signals present.

### 5) Commercial readiness for startup/MSME lead generation
- Define 3 packaged outputs from this pipeline:
   - audit-backed growth plan (website present)
   - profile-only launch plan (no website)
   - consultant action board (prioritized next 30/60/90 days).
- Track conversion KPIs per package:
   - lead-to-diagnosis rate
   - diagnosis-to-roadmap rate
   - roadmap-to-consultant-call rate.

**Execution order recommendation:** 1 → 3 → 2 → 4 → 5
This order ensures data capture quality first, then delivery consistency and conversion tracking.

### Mandatory owner + ETA tracker

| Workstream | Primary Owner | Supporting Owner | Target ETA |
|---|---|---|---|
| 1) Ship and verify in environment | Backend Engineer | DevOps Engineer | T+2 business days |
| 3) Integrate OfStride chat lead signals | Backend Engineer | Chat/AI Engineer | T+3 business days |
| 2) No-website lead operating mode | Growth Consultant Lead | Product Manager | T+4 business days |
| 4) Add rollout safeguards | QA Engineer | Data Analyst | T+5 business days |
| 5) Commercial readiness and KPI instrumentation | Product Manager | Growth Ops Lead | T+7 business days |

Completion criteria:
- Each owner updates status daily in standup until Done.
- Any slip beyond ETA requires a blocker note and revised date.

---

## Hard rules (do not break)

- **No interface shape changes**: keep route names, function.json bindings, request/response field names, and the `api.ts` client contract identical. Frontend pages keep their props/structure.
- **Modular structure**: new logic lives in `api/business_growth/shared/*.py`, not inlined in `__init__.py`. Each `__init__.py` stays thin (parse → call shared → respond).
- **Terminal-state guarantee**: an `audit_run` must reach `complete` or `failed` (+ `completed_at`) on every code path, including exceptions.
- **Profile-driven diagnosis**: blockers/opportunities must be functions of the captured `business_profile` + `issue_finding`, never static lists.
- **Validate after every phase** before advancing.
