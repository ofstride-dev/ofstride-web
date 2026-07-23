# OfStride Website — Product Requirements Document

> Living reference for what this product is, who it serves, and how it's built. Pairs with [CLAUDE.md](CLAUDE.md) (dev conventions) and [SKILL.md](SKILL.md) (do's/don'ts distilled from real incidents).

---

## 1. Product Summary

OfStride Services LLP's public website + careers platform. Two audiences:

1. **Marketing site** — services, industries, about, contact, book-a-call — for prospective business clients (HR/Finance/Legal/IT/Strategy consulting).
2. **Careers platform** — a lightweight ATS-style system for posting jobs, collecting applications, and a dedicated **Veteran Connect** intake flow for ex-defence-service personnel transitioning to civilian jobs.

## 2. Goals

- Let admins/employers post and manage job descriptions (JDs) without a full HR suite.
- Let jobseekers browse jobs and apply with a resume.
- Let veterans self-register profiles + resumes through a simple, low-friction, **passwordless** flow (email magic link → form → resume upload). No AI screening/analysis is required for this flow — intentionally kept simple.
- Keep infra minimal: one SPA (Azure Static Web App) + one Python Function App, backed by Supabase (Postgres + Auth) and Azure Blob Storage.

## 3. Non-Goals

- No resume parsing/AI-match scoring for Veteran Connect (explicitly descoped — "just make the flow simple").
- No custom auth system — Supabase Auth only (magic link / OTP).
- No SQLite in production for careers data (Supabase Postgres only; SQLite is a deprecated local fallback).

## 4. Users / Roles

| Role | Access | Auth |
|---|---|---|
| Admin | Full careers dashboard, JD CRUD, applicant review | Supabase JWT, role=`admin` (or `x-admin-key` dev fallback) |
| Employer | Employer portal, own company's JDs/applicants | Supabase JWT, role=`employer` |
| Jobseeker | Browse `/careers`, apply with resume | none required to browse; email captured at apply |
| Veteran | `/careers/veteran-transition` — magic link login, submit profile + resume | Supabase magic link (`signInWithOtp`), no password |

## 5. Architecture

```
Frontend (SPA)                    Backend (Python Azure Functions)
React 18 + Vite + Tailwind   -->   func-ofs-carrer-001 (dedicated Function App)
Azure Static Web App              Supabase (Postgres) — jobs, applications, veteran_profiles
(was-ofstride-002)                Azure Blob Storage — resumes, veteran-resume, careers-jd
```

- Frontend deploy: `.github/workflows/azure-static-web-apps-white-water-027449900.yml` — triggers on push to `main`, builds with `VITE_*` env vars baked in at build time.
- Backend deploy: `.github/workflows/deploy-career-apis.yml` — triggers on push to `main` when `api/careers_*`, `api/jobs`, `api/resume_upload`, `api/jd_upload`, `api/submit_profile`, `api/veteran_careers`, `api/shared`, or requirements files change. Stages a subset of function folders + `requirements-careers.txt` and deploys via `Azure/functions-action@v1`.
- Both auto-deploy on every push to `main` — there is no manual "promote to prod" step. **A `git push origin main` IS the production deployment.**

### Key Resources (production)

| Resource | Name | Notes |
|---|---|---|
| Static Web App | `was-ofstride-002` | Hostname `white-water-027449900.7.azurestaticapps.net` — this is the live production URL (no custom domain bound) |
| Function App | `func-ofs-carrer-001` | Resource group `was-ofstride-002_group`. **Flex Consumption, Python 3.12.** URL: `https://func-ofs-carrer-001-dzd4h9andncbhfha.southindia-01.azurewebsites.net/api` |
| Storage Account | `sacofsblb001` | Containers: `resumes`, `veteran-resume`, careers JD container |
| Supabase Project | `jxocmzvsspdnooganlps` | Postgres + Auth (magic link) |

## 6. Core Flows

### 6.1 Veteran Connect (`/careers/veteran-transition`, `src/pages/vat-career-form.jsx`)

1. User enters email → `supabase.auth.signInWithOtp({ emailRedirectTo })`.
2. User clicks emailed magic link → redirected back to the same page with a live Supabase session.
3. User fills profile form (rank, service branch, location, etc.) + attaches resume.
4. Frontend calls `POST {CAREER_API_BASE}/SubmitProfile` with `Authorization: Bearer <supabase access_token>` and multipart form data.
5. Backend (`api/veteran_careers/intake.py`):
   - Verifies the bearer token (`api/shared/security/admin_auth.py::require_authenticated_user`).
   - Uploads resume to Blob Storage container `VETERAN_RESUME_BLOB_CONTAINER` (default `veteran-resume`).
   - Inserts a row into Supabase `veteran_profiles`.
   - Fires a best-effort admin email notification (failure here must not fail the request).
6. No AI analysis step — by design.

### 6.2 Admin/Employer Careers (`/admin/careers` route is actually `careers/manage` — see §7)

- JD create/edit (markdown or upload), applicant review, status actions (shortlist/reject/follow-up).
- Store: `api/shared/persistence/careers_supabase_store.py` (Supabase — primary). SQLite store is legacy fallback only.

### 6.3 Jobseeker Apply (`/careers`)

- Public job listing via `/api/jobs`, apply form uploads resume to Blob Storage, application row to Supabase `applications`.

## 7. API Contract

Standard envelope (careers_manage, jobs, etc.):
```json
{ "ok": true, "data": {}, "error": null, "trace_id": "uuid" }
```
`SubmitProfile` (veteran intake) is a plain JSON response (`{"status":"success"}` / `{"error": "..."}`) — not yet migrated to the envelope; keep this in mind when adding error handling.

## 8. Auth Verification (Backend)

`api/shared/security/admin_auth.py` verifies Supabase bearer tokens using **Supabase's Auth API** (`GET {SUPABASE_URL}/auth/v1/user` with `SUPABASE_SERVICE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` as `apikey`) as the primary, authoritative path. Local HS256 decode via `SUPABASE_JWT_SECRET` is only a secondary fallback — **do not rely on it being correctly configured** (production's value is currently a placeholder, not the real legacy JWT secret).

## 9. Known Operational Risks (learned from incidents)

1. **CI Python version drift**: `deploy-career-apis.yml` must build dependencies with the *same* Python version as the target Flex Consumption runtime (currently 3.12), or compiled deps (`cryptography`/cffi via `azure-identity`/`azure-storage-blob`) fail to load at runtime with no clear local repro.
2. **Env var parity**: local (`api/local.settings.json`) and production (Function App settings) can silently diverge — verify both when debugging environment-specific failures (compare with `az functionapp config appsettings list`).
3. **Supabase redirect URLs**: magic-link `emailRedirectTo` targets must be present in Supabase Auth → URL Configuration → Redirect URLs for every environment (localhost + production).
4. **Azure Functions reserved words**: never use `admin`, `runtime`, `webhooks`, or a bare `api` prefix as a route/function name.

## 10. Environments

| Env | Frontend | Backend | Trigger |
|---|---|---|---|
| Local | `npm run dev` (localhost:5173) | `func start` in `api/` (localhost:7071) | manual |
| Production | Azure Static Web App | `func-ofs-carrer-001` | automatic on push to `main` |

## 11. Open Items / Roadmap

- Migrate `SubmitProfile` response shape to the standard API envelope.
- JD Enhancer Agent and Resume Reviewer Agent (see [CLAUDE.md](CLAUDE.md) §9) — future AI phases, not yet built; Veteran Connect intentionally excludes this for now.
- Consider fixing/rotating `SUPABASE_JWT_SECRET` in production so the local-decode fallback path is actually usable (currently dead weight).
