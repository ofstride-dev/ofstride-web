# Archived: Business Growth Module

This folder contains the **Business Growth ("Growth Execution Planner")** module, which has been
removed from the active project because it is not fully ready for production.

## Why it was archived

The module was still in active development and not ready to ship. Per the team's decision it was
removed from the live application (both the Azure Functions backend and the frontend) and preserved
here so the work is not lost and can be resumed later.

## What was moved here

The original source tree is preserved under this folder, mirroring the repo layout:

```
archive/business_growth/
├── BUSINESS_GROWTH_IMPLEMENTATION_PLAN.md   # Original implementation plan/notes
├── api/
│   ├── business_growth/                     # Azure Functions backend module
│   ├── business_growth_audit_worker/        # Separate audit worker function
│   └── shared/security/business_growth_schema.sql
├── src/
│   ├── components/business_growth/          # Frontend components
│   ├── pages/business-growth/               # Frontend route pages
│   ├── services/businessGrowthApi.ts        # API client
│   └── types/businessGrowth.ts              # TypeScript types
└── tests/                                   # Backend unit tests
```

## What was removed from the active project

- `api/business_growth/**` and `api/business_growth_audit_worker/**` (Azure Functions backend).
- `api/shared/security/business_growth_schema.sql`.
- `src/pages/business-growth/**`, `src/components/business_growth/**`,
  `src/services/businessGrowthApi.ts`, and `src/types/businessGrowth.ts` (frontend).
- `tests/test_business_growth_*.py`.
- The `# Business Growth` routes/titles/nav links in `src/App.jsx` and `src/components/Layout.jsx`.
- The `api/business_growth/**` trigger/copy steps in
  `.github/workflows/deploy-career-apis.yml`.

## How to restore later

When the module is ready to be brought back:

1. Copy the folders back to their original locations (see `What was moved here`).
2. Re-add the route imports, route-title entries, and `<Route path="business-growth" ...>` block in
   `src/App.jsx`.
3. Re-add the "Growth Execution Planner" desktop + mobile nav links in `src/components/Layout.jsx`.
4. Re-add the `api/business_growth/**` path trigger and `cp -r api/business_growth` step in
   `.github/workflows/deploy-career-apis.yml`.
5. Recreate the `business_growth_*` tables from `api/shared/security/business_growth_schema.sql`.
