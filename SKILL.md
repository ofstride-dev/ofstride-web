---
name: ofstride-web
description: 'Use when working on the OfStride Services LLP website/careers monorepo (React+Vite SPA on Azure Static Web Apps + Python Azure Functions on func-ofs-carrer-001 + Supabase + Azure Blob Storage). USE FOR: careers platform, Veteran Connect intake, admin/employer careers dashboard, job applications, Supabase auth debugging, deploying frontend or career APIs, diagnosing 401/500 errors on production Azure Functions. Captures verified do'"'"'s and don'"'"'ts from real incidents on this codebase.'
---

# OfStride Web — Project Skill

Full architecture and conventions live in [CLAUDE.md](CLAUDE.md) and [PRD.md](PRD.md). Read both before non-trivial changes. This file is the condensed, incident-tested checklist.

## Do

- **Treat `git push origin main` as a production deploy.** Both `.github/workflows/azure-static-web-apps-white-water-027449900.yml` (frontend) and `.github/workflows/deploy-career-apis.yml` (career Function App, path-filtered) trigger automatically. There is no separate promote step — verify locally first.
- **Verify production Function App env vars with `az functionapp config appsettings list --name func-ofs-carrer-001 --resource-group was-ofstride-002_group`** whenever behavior differs between local and prod. `api/local.settings.json` and Azure settings can silently diverge.
- **Match the CI build Python version to the Function App's actual runtime.** `func-ofs-carrer-001` is Flex Consumption on **Python 3.12**. If `deploy-career-apis.yml`'s `actions/setup-python` version doesn't match, compiled deps (`cryptography`/cffi pulled in by `azure-identity`, `azure-storage-blob`) install fine in CI but fail to *load* at runtime with an unhelpful error — this caused a real prod-only 500 after auth was already fixed.
- **Verify Supabase bearer tokens via the Auth API** (`GET {SUPABASE_URL}/auth/v1/user` with the service key as `apikey` header) as the primary path in `api/shared/security/admin_auth.py`. This is authoritative and doesn't depend on a correctly-configured legacy `SUPABASE_JWT_SECRET` (production's current value is a placeholder, not real — don't trust it).
- **Check Supabase Auth → Redirect URLs allow-list** whenever debugging magic-link login issues in a new environment. Must include the exact origin + path used in `emailRedirectTo`.
- **Use `az` CLI directly** to inspect/fix Azure resources (appsettings, CORS, static web app hostnames, storage containers) — it's already authenticated for this subscription. `gh` CLI is NOT installed.
- Keep the Veteran Connect flow simple: email magic link → form → resume → Blob Storage + Supabase row. No AI analysis step by design.
- Use `careers/manage` (not `careers/admin`) and similar patterns — Azure Functions reserves `admin`, `runtime`, `webhooks`, and bare `api` as route/function name prefixes.
- Always store careers data in Supabase Postgres, never SQLite (SQLite store is a deprecated fallback only).

## Don't

- Don't assume "the code is fixed" means "it's deployed correctly" — CI can succeed while the runtime still fails due to interpreter/dependency mismatches. Confirm with a real end-to-end test (or live log tail) after every deploy of auth/runtime-sensitive code.
- Don't add resume-analysis/AI scoring to Veteran Connect unless explicitly asked — it was deliberately descoped.
- Don't rely on `SUPABASE_JWT_SECRET` being correct in any environment without checking it first (`az functionapp config appsettings list ... --query "[?name=='SUPABASE_JWT_SECRET']"`).
- Don't use `az functionapp log tail` — it doesn't exist. Function Apps are `Microsoft.Web/sites`; log streaming works differently (poll endpoints, or use the Azure Portal Log Stream / Application Insights).
- Don't expose `SUPABASE_SERVICE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` to the frontend — server-side only. Frontend only ever gets `VITE_SUPABASE_ANON_KEY`.
- Don't create nested/unnecessary folders in `api/` — one function per top-level folder (`function.py` + `function.json`), shared code in `api/shared/`.

## Debugging Playbook (401/500 on career APIs in production)

1. Reproduce locally first (`func start` in `api/`) with `api/local.settings.json` — if it works locally but not in prod, it's an env/deploy issue, not a logic bug.
2. Diff env vars: `az functionapp config appsettings list --name func-ofs-carrer-001 --resource-group was-ofstride-002_group` vs `api/local.settings.json`.
3. Check CORS: `az functionapp cors show --name func-ofs-carrer-001 --resource-group was-ofstride-002_group` includes the calling frontend origin.
4. Check the CI workflow's Python version against the Function App's actual runtime (Flex Consumption runtime is not visible via `az functionapp config show` — check via the Azure Portal or `az resource show` on the site with `--api-version 2023-12-01 --query "properties.functionAppConfig.runtime"`).
5. If it's an auth 401 specifically, confirm which verification path failed by adding/checking logs in `admin_auth.py` (`_verify_via_supabase_auth_api` logs HTTP status/exceptions on failure).
6. Re-test end-to-end on the live production URL (`https://white-water-027449900.7.azurestaticapps.net`) after each fix — don't declare victory on a green GitHub Actions run alone.
