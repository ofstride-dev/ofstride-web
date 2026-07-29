# Resume Builder — Feasibility & Compatibility Critique

> **Source project:** [srbhr/Resume-Matcher](https://github.com/srbhr/Resume-Matcher) (v1.2 "Nightvision", Apache-2.0)
> **Target:** New "Resume Builder" section under `/admin/careers` alongside existing "Resume Review" and "JD Studio"
> **Date:** 2026-07-29

---

## 1. Executive Summary

The Resume-Matcher project is a **mature, well-architected open-source resume tailoring tool** with 27k+ GitHub stars. It provides exactly the feature set we need: upload a master resume, paste a JD, get an AI-tailored resume with ATS scoring, keyword highlighting, cover letter generation, and PDF export.

**However, it cannot be dropped in as-is.** The project is a standalone FastAPI + Next.js monolith with TinyDB file storage and LiteLLM for multi-provider LLM access. Our codebase is an Azure Static Web App with Azure Functions (Python) backend, Supabase PostgreSQL, Azure Blob Storage, and a Vite/React 18 frontend. The architectural mismatch is significant but **not insurmountable** — the core logic (resume schema, parsing, ATS scoring, tailoring prompts) is highly portable and can be adapted to leverage our existing shared services.

**Recommendation: Selective port, not fork.** Extract the domain logic (schemas, parser, ATS scorer, resume wizard, improver/refiner prompts) and re-platform them onto our existing `api/shared/` infrastructure. Build a new React section in `AdminCareers.jsx` that reuses our existing API client patterns, auth, and blob storage.

---

## 2. Deep Review of Resume-Matcher

### 2.1 Architecture Overview

| Layer | Resume-Matcher | OfStride (existing) |
|-------|---------------|-------------------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4 | Vite, React 18, JavaScript (JSX), Tailwind CSS 3 |
| **Backend** | FastAPI, Python 3.13+, LiteLLM | Azure Functions (Python), OpenAI SDK direct |
| **Database** | TinyDB (JSON file) / SQLite (migrated) | Supabase PostgreSQL (PostgREST) + SQLite fallback |
| **File Storage** | Local filesystem (`backend/data/`) | Azure Blob Storage |
| **LLM Access** | LiteLLM (multi-provider abstraction) | `core/llm_factory.py` (OpenAI / Azure OpenAI / Gemini / Mock) |
| **Embeddings** | Not used (keyword + LLM only) | `core/embedding_factory.py` (Azure OpenAI embeddings) |
| **PDF Export** | Headless Chromium via Playwright | Not yet implemented |
| **Auth** | None (local single-user app) | Supabase Auth + Azure AD + admin role gate |

### 2.2 Key Modules & Their Portability

| Module | File(s) | LOC | Portability | Notes |
|--------|---------|-----|-------------|-------|
| **Resume Schema** | `schemas/models.py` | 927 | ✅ High | Pydantic models for `ResumeData`, `PersonalInfo`, `Experience`, `Education`, `Project`, `AdditionalInfo`, `SectionMeta`, `CustomSection`. Clean, well-validated, no external deps beyond Pydantic. **Directly portable.** |
| **Resume Parser** | `services/parser.py` | 176 | ⚠️ Medium | Uses `markitdown` for PDF/DOCX→Markdown, then LLM for structured extraction. We already have `PyMuPDF` + `docx2txt` in `vat_resume_analyzer.py`. Need to adapt to our `llm_factory` instead of LiteLLM. |
| **ATS Scorer** | `services/ats.py` | 217 | ✅ High | Pure Python, no LLM calls. Computes keyword match, skills coverage, section completeness with weighted scoring. **Directly portable** and complements our existing `resume_analyzer.py`. |
| **Resume Wizard** | `services/resume_wizard.py` | 447 | ⚠️ Medium | Conversational AI wizard that builds a resume through Q&A. Uses LLM to parse free-text answers into structured `ResumeData`. Depends on `app.llm.complete_json` and `app.prompts` — need to adapt to our `llm_factory`. |
| **Improver/Refiner** | `services/improver.py` (55k chars), `services/refiner.py` (24k chars) | ~2500 | ⚠️ Medium | The core tailoring engine: takes master resume + JD, produces diff-based improvements with multi-pass refinement. Heavy LLM usage with structured JSON output. The prompt engineering is the real value here. |
| **Cover Letter** | `services/cover_letter.py` | ~5k chars | ✅ High | Simple LLM-based cover letter generation from resume + JD. Easy to port. |
| **Interview Prep** | `services/interview_prep.py` | ~4k chars | ✅ High | Generates interview questions from tailored resume + JD. Easy to port. |
| **PDF Generator** | `app/pdf.py` | ~11k chars | ❌ Low | Uses Playwright/headless Chromium. Not available in Azure Functions consumption plan. Need alternative (e.g., client-side `react-pdf` or server-side `weasyprint`/`reportlab`). |
| **Database** | `app/database.py` | 30k chars | ❌ Skip | TinyDB/SQLite data layer. We'll use Supabase instead. |
| **LLM Abstraction** | `app/llm.py` | 50k chars | ❌ Skip | LiteLLM-based. We already have `core/llm_factory.py`. |
| **Config** | `app/config.py`, `config_cache.py` | ~14k chars | ❌ Skip | We have `core/settings.py`. |
| **Prompts** | `app/prompts/` (enrichment, refinement, resume_wizard, templates) | ~40k chars | ✅ High | The prompt templates are the IP. Can be extracted as string constants and used with our `llm_factory`. |

### 2.3 Data Model (ResumeData Schema)

The `ResumeData` schema from Resume-Matcher is excellent and should be adopted as our canonical resume structure:

```python
class ResumeData:
    personalInfo: PersonalInfo      # name, title, email, phone, location, website, linkedin, github
    summary: str                     # professional summary
    workExperience: list[Experience] # title, company, location, years, description[], descriptionStyles[]
    education: list[Education]       # institution, degree, years, description
    personalProjects: list[Project]  # name, role, years, github, website, description[]
    additional: AdditionalInfo       # technicalSkills[], languages[], certificationsTraining[], awards[]
    sectionMeta: list[SectionMeta]   # dynamic section ordering & visibility
    customSections: dict[str, CustomSection]  # user-defined sections
```

This schema is:
- **Frontend-compatible**: Designed to match React component props (the original project uses it directly in TypeScript)
- **Extensible**: Supports custom sections, drag-and-drop reordering, show/hide toggles
- **Well-validated**: Pydantic field validators coerce messy LLM output into clean data
- **ATS-friendly**: Maps cleanly to the ATS scoring logic (summary, experience, education, skills)

### 2.4 ATS Scoring Algorithm

The ATS scorer is a clean, deterministic (no LLM) module:

```
overall_score = keyword_match * 0.55 + skills_coverage * 0.25 + section_completeness * 0.20
```

- **keyword_match**: Whole-word regex matching of JD keywords in resume text
- **skills_coverage**: Overlap between JD required/preferred skills and resume's `technicalSkills` list
- **section_completeness**: Presence of summary, experience, education, skills sections

This complements our existing `resume_analyzer.py` which uses a simpler skill lexicon + LLM revalidation. The ATS scorer can run **before** LLM analysis as a fast pre-filter, and **after** tailoring to measure improvement.

### 2.5 Resume Tailoring Pipeline

The improver/refiner flow is the most complex and valuable part:

1. **Extract JD keywords** (required_skills, preferred_skills) from job description
2. **Generate diff-based changes** — LLM produces a list of `ResumeChange` objects (replace/append/reorder/add_skill) with path-based targeting (e.g., `workExperience[0].description[1]`)
3. **Apply changes** to the master resume with verification (check `original` matches current content)
4. **Multi-pass refinement** — iteratively inject missing keywords, remove AI-sounding phrases, fix alignment violations
5. **Compute ATS score** on the refined resume
6. **Generate cover letter** and **interview prep** from the tailored resume + JD

The diff-based approach is superior to "regenerate the whole resume" because:
- It preserves user content that's already good
- Changes are auditable and reversible
- It prevents hallucination of fake experience
- The `original` field provides a verification gate

---

## 3. Compatibility Analysis

### 3.1 What We Can Leverage from Existing Code

| Existing Service | Resume Builder Use Case |
|-----------------|------------------------|
| `core/llm_factory.py` | Replace LiteLLM — already supports Azure OpenAI (managed identity), OpenAI, Gemini, Mock with circuit breaker |
| `core/embedding_factory.py` | Optional: semantic similarity for JD↔resume section matching (Layer 2 from `resume-analyzer.md`) |
| `core/api_contract.py` | Envelope responses (`ok_response`, `error_response`) — same pattern as `careers_manage` |
| `core/blob_rest.py` | Upload generated resume PDFs/JSON to blob storage |
| `persistence/careers_supabase_store.py` | Store resume drafts, tailored versions, analysis results in Supabase |
| `persistence/blob_storage.py` | Upload master resume files (PDF/DOCX) |
| `security/admin_auth.py` | `require_role(["admin", "employer"])` — same auth gate as careers_manage |
| `careers_agentic/jd_enhancer.py` | JD keyword extraction can be shared; template matching pattern reusable |
| `careers_agentic/resume_analyzer.py` | Existing skill extraction + LLM revalidation; ATS scorer enhances this |
| `vat_resume_analyzer.py` | PDF/DOCX text extraction (`PyMuPDF` + `docx2txt`) — reuse for master resume parsing |
| `src/services/api.ts` | API client pattern with `authHeaders()`, `parseEnvelope()` — add new endpoints |
| `src/services/supabase.ts` | Auth state management — already integrated in AdminCareers |
| `src/pages/AdminCareers.jsx` | Tab-based workspace pattern — add "Resume Builder" as third tab |

### 3.2 What We Need to Build New

| Component | Description |
|-----------|-------------|
| **`api/shared/careers_agentic/resume_builder.py`** | Core resume builder service: parse master resume, tailor to JD, generate cover letter, interview prep |
| **`api/shared/careers_agentic/ats_scorer.py`** | ATS scoring module (ported from `services/ats.py`) |
| **`api/shared/careers_agentic/resume_schema.py`** | Pydantic models for `ResumeData` and related types (ported from `schemas/models.py`) |
| **`api/shared/prompts/resume_builder_prompts.py`** | Prompt templates for parsing, tailoring, refinement, cover letter, interview prep |
| **Supabase table: `careers_resume_drafts`** | Store master resumes and tailored versions |
| **Supabase table: `careers_resume_versions`** | Version history for each tailored resume |
| **`api/careers_manage/function.py`** | New route handlers: `resume-builder/*` paths |
| **`src/components/ResumeBuilder.jsx`** | Main Resume Builder UI component |
| **`src/components/ResumePreview.jsx`** | Live resume preview with section editing |
| **`src/components/AtsScoreCard.jsx`** | ATS score visualization with sub-scores |
| **`src/services/api.ts`** | New API client functions for resume builder endpoints |

### 3.3 Key Incompatibilities & Mitigations

| Incompatibility | Impact | Mitigation |
|----------------|--------|------------|
| **Next.js 16 / React 19 vs Vite / React 18** | Frontend components can't be directly copied | Reimplement UI in our JSX/Tailwind stack. The data model is the same, so logic ports. |
| **LiteLLM vs `llm_factory.py`** | All LLM calls use different interfaces | Map `complete_json()` → `llm_factory.get_healthy_llm_with_metadata()` + `agenerate_json()`. Our factory already supports JSON mode. |
| **TinyDB vs Supabase** | Data persistence layer completely different | Create new Supabase tables. The `ResumeData` schema maps well to JSONB columns. |
| **Playwright PDF vs Azure Functions** | Headless Chromium not available in consumption plan | Use client-side PDF generation (`react-pdf` / `@react-pdf/renderer`) or server-side `weasyprint`. Phase 2 concern. |
| **`markitdown` dependency** | Not in our `requirements.txt` | We already have `PyMuPDF` + `docx2txt` for PDF/DOCX extraction. Use those instead. |
| **No auth in Resume-Matcher** | Single-user local app | Wrap all endpoints with `require_role(["admin", "employer"])` — same as `careers_manage`. |
| **Python 3.13 vs our Python 3.11** | Some syntax (e.g., generic syntax `list[T]`) may not work | Use `typing.List[T]` or `from __future__ import annotations` (already our pattern). |
| **`uv` package manager** | Resume-Matcher uses `uv`, we use `pip` | Add new deps to `api/requirements.txt` if needed. Minimal — we mostly reuse existing deps. |

---

## 4. Critique-Based Recommendations

### 4.1 What's Excellent in Resume-Matcher (Adopt)

1. **Diff-based tailoring** — The `ResumeChange` model with path-based targeting and `original` verification is the gold standard for AI-assisted resume editing. It prevents hallucination and gives users auditability. **Adopt this pattern.**

2. **Multi-pass refinement** — Iteratively injecting keywords, removing AI phrases, and fixing alignment is more reliable than single-shot generation. **Adopt this pipeline.**

3. **ATS sub-score breakdown** — Showing keyword_match, skills_coverage, and section_completeness separately is more actionable than a single score. **Adopt this scoring model** alongside our existing match_score.

4. **Section metadata system** — `SectionMeta` with `isVisible`, `order`, `sectionType` enables drag-and-drop reordering and custom sections. **Adopt this schema.**

5. **Resume Wizard** — Conversational Q&A to build a resume from scratch is valuable for candidates who don't have a polished resume. **Port this as a Phase 2 feature.**

6. **Description styles** — `descriptionStyles: ["bullet", "plain"]` per row allows mixed formatting. **Adopt this.**

### 4.2 What Needs Improvement (Adapt)

1. **No vector/semantic matching** — Resume-Matcher uses only keyword matching. Our `resume-analyzer.md` spec calls for a 3-layer approach (keyword + semantic + LLM). **Integrate our `embedding_factory.py` for Layer 2 semantic similarity.**

2. **No PII redaction** — Resume-Matcher doesn't redact PII before LLM processing. Our `resume-analyzer.md` spec requires this for GDPR compliance. **Add PII redaction in pre-processing.**

3. **No async processing** — Resume-Matcher is synchronous. Tailoring can take 10-30+ seconds. **Implement async with status polling** (same pattern as our `analyze-resume` batch endpoint).

4. **No JD embedding caching** — Resume-Matcher re-extracts JD keywords every time. **Cache JD embeddings in Supabase** (as recommended in `resume-analyzer.md`).

5. **Single-user, no collaboration** — Resume-Matcher has no concept of multiple users or shared resumes. **Add `created_by` and `organization_id` to all resume records.**

6. **No override/feedback loop** — Our existing AdminCareers has an override mechanism for AI recommendations. **Extend this to resume builder** — let admins reject/accept individual diff changes.

### 4.3 What to Skip


