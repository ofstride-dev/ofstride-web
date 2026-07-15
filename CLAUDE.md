# OfStride Website — Codebase Instructions & Conventions

> **Purpose:** This file serves as the persistent memory for AI assistants (Cline, Claude, etc.) working on this codebase. Read this before making any changes.

---

## 1. Architecture Overview

This is a **monorepo** with two deployable components:

| Component | Tech | Deploy Target |
|-----------|------|---------------|
| Frontend (SPA) | React + Vite + TailwindCSS | Azure Static Web Apps |
| Backend APIs | Python Azure Functions | Dedicated Function App (`func-ofs-carrer-001`) |

### Frontend (`src/`)
- React 18 + Vite + TailwindCSS
- Pages in `src/pages/`, services in `src/services/`, types in `src/types/`
- API client: `src/services/api.ts` — all backend calls go through here
- Auth client: `src/services/supabase.ts` — Supabase Auth for admin/employer/jobseeker

### Backend (`api/`)
- Python Azure Functions (v2 programming model)
- Each function has its own folder: `api/<function_name>/function.py` + `function.json`
- Shared code in `api/shared/` — added to `sys.path` at runtime
- **Database:** Supabase (PostgreSQL) for careers data — NOT SQLite
- **Blob Storage:** Azure Blob Storage for JD files and resume uploads

---

## 2. Critical Rules — Azure Functions Reserved Keywords

**NEVER** use these words in Azure Functions route names, function names, or folder names:
- `admin` — reserved by Azure Functions runtime
- `runtime` — reserved by Azure Functions runtime
- `webhooks` — reserved by Azure Functions runtime
- `api` — reserved prefix

**Current safe pattern:** Use `careers/manage` as the route (not `careers/admin`), and pass sub-paths via `_path` query parameter.

---

## 3. Database: Supabase (PostgreSQL)

### Careers Data Store
- **All careers data MUST use Supabase PostgreSQL**, not SQLite
- Schema lives in `api/shared/security/supabase_schema.sql`
- Store implementation: `api/shared/persistence/careers_supabase_store.py`
- The old SQLite store (`careers_store.py`) is deprecated and kept only as fallback

### Required Environment Variables (Backend)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key  # server-side only, never exposed to frontend
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_AUTH_AUDIENCE=authenticated
```

### Required Environment Variables (Frontend)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 4. API Contract

All API responses follow this envelope:
```json
{
  "ok": true,
  "data": { ... },
  "error": null,
  "trace_id": "uuid"
}
```

Error responses:
```json
{
  "ok": false,
  "data": null,
  "error": {
    "type": "validation|provider|retrieval|guardrail|infra",
    "message": "Human-readable message",
    "details": {}
  },
  "trace_id": "uuid"
}
```

### Naming Conventions
- Function folders: `snake_case` (e.g., `careers_manage`, `careers_init_upload`)
- Routes: `kebab-case` (e.g., `careers/manage`, `careers/init-upload`)
- Python files: `function.py` inside each function folder
- API client functions in `api.ts`: `camelCase` (e.g., `adminSaveJob`, `adminListJobs`)

---

## 5. Authentication Flow

1. User signs in via Supabase Auth (email/password or Azure AD)
2. Frontend gets JWT access token from Supabase session
3. Frontend sends `Authorization: Bearer <jwt>` header to Azure Functions
4. Backend verifies JWT via `api/shared/security/admin_auth.py`
5. Roles: `admin`, `employer`, `jobseeker`
6. Dev fallback: `x-admin-key` header (only when `ENV=dev` or `ADMIN_DEV_AUTH_FALLBACK=true`)

---

## 6. Careers Workflow

### Admin/Employer Workflow
1. Admin/employer signs in → sees Admin Careers Dashboard
2. Creates JD (Job Description) — **critical fields only**: title, department, location, employment_type, status, jd_markdown
3. JD can be written directly or uploaded as `.md`/`.txt` file
4. JD saved to Supabase `jobs` table
5. Applicants submit resumes against active JDs
6. Admin runs analysis → gets match score, recommendation
7. Admin takes action: shortlist, reject, send follow-up email

### Jobseeker Workflow
1. Browse active jobs at `/careers`
2. Select a job → upload resume + fill application form
3. Application saved to Supabase `applications` table
4. Resume stored in Azure Blob Storage

---

## 7. Development Workflow

### Before Making Changes
1. Read this file
2. Explore the relevant files using `read_file` or `search_files`
3. Understand the full context before editing

### After Making Changes
1. Validate changes in context of the whole codebase
2. Run `npm run build` to check frontend
3. Commit with descriptive message
4. Push to `origin` (branch: `main`)

### Commit Message Format
```
feat(careers): <description>
fix(careers): <description>
refactor(careers): <description>
docs: <description>
```

---

## 8. File Structure (Key Files)

```
api/
├── careers_manage/         # Admin careers API (jobs CRUD, applications, analysis) — NOT named \"admin_careers\" because \"admin\" is reserved by Azure Functions runtime
│   ├── function.py
│   └── function.json
├── careers_init_upload/    # Jobseeker resume upload init (SAS token)
├── careers_complete/       # Jobseeker application finalize
├── jobs/                   # Public job listing API
├── shared/
│   ├── core/
│   │   ├── api_contract.py # Response envelope helpers
│   │   └── settings.py     # Environment/settings loader
│   ├── persistence/
│   │   ├── careers_supabase_store.py  # Supabase store (PRIMARY)
│   │   └── careers_store.py           # SQLite store (DEPRECATED fallback)
│   └── security/
│       ├── admin_auth.py   # JWT verification + role check
│       └── supabase_schema.sql  # Database schema

src/
├── pages/
│   ├── AdminCareers.jsx    # Admin dashboard (JD management, applications)
│   ├── EmployerCareers.jsx # Employer portal entry
│   └── Careers.jsx         # Public job listings + application form
├── services/
│   ├── api.ts              # API client (all backend calls)
│   └── supabase.ts         # Supabase Auth client
└── types/
    └── chat.ts             # TypeScript types
```

---

## 9. Future Roadmap (AI Agents)

### JD Enhancer Agent (Phase e)
- When admin writes/uploads JD → AI agent reviews it
- Validates against JD writing best practices
- Restructures JD with suggestions
- Stores enhanced version in `ai_assisted_version` column

### Resume Reviewer Agent (Phase f)
- When resume uploaded for a specific JD → AI agent reviews it
- Validates skills match, experience relevance
- Generates scoring with breakdown
- Graphical representation on Admin Dashboard
- Admin can trigger: "Send selection email" or "Send rejection email"
- Emails are polite, assertive, and professional

---

## 10. Required Environment Variables

### For the Function App (set in Azure Portal > Configuration):
```
# Supabase (required for persistent data — without this, data falls back to SQLite and is LOST on restart)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Azure Blob Storage (required for JD and resume file uploads)
CAREERS_BLOB_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net
CAREERS_JD_BLOB_CONTAINER=careers-jd
CAREERS_BLOB_CONTAINER=resumes
```

### For the Frontend (set in SWA Environment Variables):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_CAREER_API_URL=https://func-ofs-carrer-001.azurewebsites.net/api
```

---

## 11. Data Architecture

### Job Descriptions (JDs)
1. **Admin saves JD** via "Save Job" button → JD markdown stored in **both** Supabase (`careers_jobs.jd_markdown`) and Azure Blob (`careers-jd/jd/{job_id}.md`)
2. **Admin uploads JD file** → File stored in Azure Blob → reference stored in Supabase
3. **Jobseeker sees jobs** → Fetched from `/api/jobs` endpoint → reads from Supabase

### Resumes
1. **Jobseeker uploads resume** → SAS URL generated → file uploaded directly to Azure Blob (`resumes/`) → reference stored in Supabase

---

## 10. Common Pitfalls to Avoid

1. **Never use `admin` as a standalone route** — Azure Functions reserves it
2. **Never use SQLite for careers data** — always use Supabase
3. **Never expose `SUPABASE_SERVICE_KEY` to frontend** — only `VITE_SUPABASE_ANON_KEY`
4. **Always wrap store calls in try/except** — return structured error responses
5. **Always check `store.is_available`** before calling store methods
6. **Always log admin actions** via `store.log_admin_action()`
7. **Keep file structure simple** — don't create unnecessary nested folders
8. **Naming should indicate what the API does** — for easy troubleshooting