-- Business Growth schema (idempotent)
-- Phase 3 migration baseline for Growth Execution Planner.

create extension if not exists pgcrypto;

create table if not exists business_profile (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    domain text,
    industry text,
    target_geo text,
    growth_goal text,
    current_channels jsonb not null default '[]'::jsonb,
    budget_band text,
    urgency_band text,
    contact_name text not null,
    contact_email text not null,
    contact_phone text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists assessment_session (
    id uuid primary key default gen_random_uuid(),
    business_profile_id uuid not null references business_profile(id) on delete cascade,
    status text not null default 'new',
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists audit_run (
    id uuid primary key default gen_random_uuid(),
    assessment_session_id uuid not null references assessment_session(id) on delete cascade,
    status text not null default 'queued',
    root_url text,
    page_count integer not null default 0,
    technical_score integer,
    completed_at timestamptz,
    error_message text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table audit_run add column if not exists completed_at timestamptz;
alter table audit_run add column if not exists error_message text;

create table if not exists audit_page (
    id uuid primary key default gen_random_uuid(),
    audit_run_id uuid not null references audit_run(id) on delete cascade,
    url text not null,
    status_code integer,
    title text,
    meta_description text,
    h1 text,
    canonical text,
    has_viewport_meta boolean,
    link_count integer,
    image_count integer,
    is_indexable boolean,
    created_at timestamptz not null default now()
);

create table if not exists issue_finding (
    id uuid primary key default gen_random_uuid(),
    audit_run_id uuid not null references audit_run(id) on delete cascade,
    audit_page_id uuid references audit_page(id) on delete set null,
    category text,
    rule_id text,
    severity text,
    description text,
    evidence jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists growth_diagnosis (
    id uuid primary key default gen_random_uuid(),
    audit_run_id uuid not null references audit_run(id) on delete cascade,
    maturity_stage text not null,
    blockers jsonb not null default '[]'::jsonb,
    opportunities jsonb not null default '[]'::jsonb,
    overall_score integer,
    created_at timestamptz not null default now()
);

create table if not exists roadmap_item (
    id uuid primary key default gen_random_uuid(),
    growth_diagnosis_id uuid not null references growth_diagnosis(id) on delete cascade,
    phase text not null,
    title text not null,
    description text,
    domain text,
    impact numeric,
    confidence numeric,
    effort numeric,
    strategic_weight numeric,
    priority_score numeric,
    status text not null default 'draft',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists consultant_review (
    id uuid primary key default gen_random_uuid(),
    growth_diagnosis_id uuid not null references growth_diagnosis(id) on delete cascade,
    reviewer_id text,
    approved boolean not null default false,
    changes_made jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_assessment_session_business_profile_id
    on assessment_session (business_profile_id);

create index if not exists idx_audit_run_assessment_session_id
    on audit_run (assessment_session_id);

create index if not exists idx_audit_page_audit_run_id
    on audit_page (audit_run_id);

create index if not exists idx_issue_finding_audit_run_id
    on issue_finding (audit_run_id);

create index if not exists idx_growth_diagnosis_audit_run_id
    on growth_diagnosis (audit_run_id);

create index if not exists idx_roadmap_item_growth_diagnosis_id
    on roadmap_item (growth_diagnosis_id);

create index if not exists idx_consultant_review_growth_diagnosis_id
    on consultant_review (growth_diagnosis_id);
