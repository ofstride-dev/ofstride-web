-- ============================================================
-- Ofstride Expense Reimbursement — schema (idempotent)
-- Run this in Supabase Dashboard → SQL Editor → New query
-- Safe to re-run: uses IF NOT EXISTS / DROP ... IF EXISTS
-- ============================================================

-- 1. Profiles (role + company scoping, future-proofed for multi-tenant)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'employee' check (role in ('employee','admin')),
  company_id uuid not null default '00000000-0000-0000-0000-000000000001',
  created_at timestamptz not null default now()
);

-- 2. Expense claims
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default '00000000-0000-0000-0000-000000000001',
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'INR',
  spend_date date not null,
  category text not null check (category in ('Travel','Client Meals/Entertainment','Equipment/Hardware','Software/Subscriptions','Office/Misc')),
  description text not null default '',
  client_project text,
  has_invoice boolean not null default false,
  supplier_gstin text,
  taxable_value numeric(12,2),
  cgst numeric(12,2),
  sgst numeric(12,2),
  igst numeric(12,2),
  invoice_number text,
  status text not null default 'submitted' check (status in ('submitted','approved','rejected','ready_for_payment','paid')),
  payment_method text,
  payment_reference text,
  admin_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Status history (audit trail)
create table if not exists public.expense_status_history (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  from_status text,
  to_status text not null,
  comment text,
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now()
);

-- 4. Attachments (receipt files, stored in Supabase Storage)
create table if not exists public.expense_attachments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  uploaded_at timestamptz not null default now()
);

-- Helpful indexes for the common query paths
create index if not exists expenses_user_id_idx on public.expenses(user_id);
create index if not exists expenses_status_idx on public.expenses(status);
create index if not exists expenses_company_id_idx on public.expenses(company_id);
create index if not exists expense_status_history_expense_id_idx on public.expense_status_history(expense_id);
create index if not exists expense_attachments_expense_id_idx on public.expense_attachments(expense_id);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_status_history enable row level security;
alter table public.expense_attachments enable row level security;

-- helper: is current user an admin.
-- SECURITY DEFINER so it bypasses RLS entirely — this prevents infinite
-- recursion when called from within a profiles RLS policy.
create or replace function public.is_admin() returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable set search_path to 'public';

-- helper: get current user's company_id.
-- SECURITY DEFINER so it bypasses RLS — prevents infinite recursion that would
-- occur if a profiles RLS policy subqueried profiles directly.
create or replace function public.my_company_id() returns uuid as $$
  select company_id from public.profiles where id = auth.uid();
$$ language sql security definer stable set search_path to 'public';

-- profiles: a user can always see their own row ONLY.
-- We intentionally do NOT add an admin branch here — any subquery or helper
-- call on profiles from within a profiles policy risks recursion on some
-- Supabase versions. Instead, admin access to other profiles is handled via
-- the get_claimant_profiles() RPC below (SECURITY DEFINER, bypasses RLS).
drop policy if exists "profile_self_select" on public.profiles;
create policy "profile_self_select" on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profile_self_update" on public.profiles;
create policy "profile_self_update" on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- expenses: employees see/insert their own; admins see/update all in their company
drop policy if exists "expense_select_own_or_admin" on public.expenses;
create policy "expense_select_own_or_admin" on public.expenses for select
  using (
    user_id = auth.uid()
    or (
      public.is_admin()
      and company_id = public.my_company_id()
    )
  );

drop policy if exists "expense_insert_own" on public.expenses;
create policy "expense_insert_own" on public.expenses for insert
  with check (
    user_id = auth.uid()
    and company_id = public.my_company_id()
  );

-- employees may update their own *submitted* claims, but may NOT change status
-- (status transitions are admin-only and enforced server-side via RPC).
drop policy if exists "expense_update_own_pending" on public.expenses;
create policy "expense_update_own_pending" on public.expenses for update
  using (user_id = auth.uid() and status = 'submitted')
  with check (user_id = auth.uid() and status = 'submitted');

drop policy if exists "expense_update_admin" on public.expenses;
create policy "expense_update_admin" on public.expenses for update
  using (
    public.is_admin()
    and company_id = public.my_company_id()
  )
  with check (
    public.is_admin()
    and company_id = public.my_company_id()
  );

-- status history: same visibility as parent expense
drop policy if exists "history_select" on public.expense_status_history;
create policy "history_select" on public.expense_status_history for select
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id
      and (
        e.user_id = auth.uid()
        or (
          public.is_admin()
          and e.company_id = public.my_company_id()
        )
      )
    )
  );

drop policy if exists "history_insert" on public.expense_status_history;
create policy "history_insert" on public.expense_status_history for insert
  with check (changed_by = auth.uid());

-- attachments: same visibility as parent expense
drop policy if exists "attachment_select" on public.expense_attachments;
create policy "attachment_select" on public.expense_attachments for select
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id
      and (
        e.user_id = auth.uid()
        or (
          public.is_admin()
          and e.company_id = public.my_company_id()
        )
      )
    )
  );

drop policy if exists "attachment_insert" on public.expense_attachments;
create policy "attachment_insert" on public.expense_attachments for insert
  with check (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and e.user_id = auth.uid()
    )
  );

-- ============================================================
-- Storage bucket for receipts (run separately if bucket UI is easier)
-- ============================================================
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false)
  on conflict (id) do nothing;

drop policy if exists "receipt_upload_own_folder" on storage.objects;
create policy "receipt_upload_own_folder" on storage.objects for insert
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "receipt_read_own_or_admin" on storage.objects;
create policy "receipt_read_own_or_admin" on storage.objects for select
  using (
    bucket_id = 'receipts'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- allow deletion of a receipt by its owner or an admin (cleanup on expense delete)
drop policy if exists "receipt_delete_own_or_admin" on storage.objects;
create policy "receipt_delete_own_or_admin" on storage.objects for delete
  using (
    bucket_id = 'receipts'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- ============================================================
-- Admin: get claimant profiles for expense queue (bypasses RLS)
-- SECURITY DEFINER so admins can read other users' names without needing
-- a profiles RLS policy that would risk recursion.
-- ============================================================
create or replace function public.get_claimant_profiles(p_user_ids uuid[])
returns table (id uuid, full_name text) as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can call this function';
  end if;
  return query
    select p.id, p.full_name
    from public.profiles p
    where p.id = any(p_user_ids);
end;
$$ language plpgsql security definer set search_path to 'public';

-- ============================================================
-- Auto-maintain updated_at on expenses
-- ============================================================
create or replace function public.set_expense_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql security invoker;

drop trigger if exists trg_expenses_updated_at on public.expenses;
create trigger trg_expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_expense_updated_at();

-- ============================================================
-- Atomic, server-validated status transition (RPC)
-- Replaces the two-step update+history insert done previously in the client,
-- and enforces the legal state machine + optimistic concurrency in one tx.
-- ============================================================
create or replace function public.transition_expense_status(
  p_expense_id uuid,
  p_from_status text,
  p_to_status text,
  p_comment text
) returns public.expenses as $$
declare
  v_row public.expenses;
  v_is_admin boolean;
begin
  -- Lock the row so concurrent transitions serialize.
  select * into v_row from public.expenses where id = p_expense_id for update;

  if not found then
    raise exception 'Expense not found';
  end if;

  -- Optimistic concurrency: caller's view of the current status must match.
  if v_row.status <> p_from_status then
    raise exception 'Status changed by another user. Please refresh and try again.';
  end if;

  -- Enforce the legal state machine.
  if not (
    (p_from_status = 'submitted' and p_to_status in ('approved','rejected'))
    or (p_from_status = 'approved' and p_to_status in ('ready_for_payment','rejected'))
    or (p_from_status = 'ready_for_payment' and p_to_status = 'paid')
  ) then
    raise exception 'Invalid status transition: % -> %', p_from_status, p_to_status;
  end if;

  -- Authorization: only admins may transition.
  select public.is_admin() into v_is_admin;
  if not v_is_admin then
    raise exception 'Only admins can change expense status';
  end if;

  update public.expenses
    set status = p_to_status,
        admin_comment = coalesce(p_comment, admin_comment)
    where id = p_expense_id
    returning * into v_row;

  insert into public.expense_status_history
    (expense_id, from_status, to_status, comment, changed_by)
  values
    (p_expense_id, p_from_status, p_to_status, p_comment, auth.uid());

  return v_row;
end;
$$ language plpgsql security invoker;

-- ============================================================
-- Trigger: new auth user -> auto profile row
-- (named uniquely to avoid colliding with existing handle_new_user() used by
--  another module). Uses on conflict so re-running is safe.
-- ============================================================
create or replace function public.handle_new_expense_profile() returns trigger as $$
declare
  v_role text;
begin
  -- Read the requested role from user metadata; default to 'employee'.
  -- Only 'employee' and 'admin' are valid (enforced by the check constraint).
  v_role := coalesce(new.raw_user_meta_data->>'role', 'employee');
  if v_role not in ('employee','admin') then
    v_role := 'employee';
  end if;

  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', v_role)
  on conflict (id) do update
    set full_name = excluded.full_name,
        role = excluded.role
    where public.profiles.role = 'employee';
  return new;
end;
$$ language plpgsql security definer set search_path to 'public';

drop trigger if exists on_auth_user_created_expense_profile on auth.users;
create trigger on_auth_user_created_expense_profile
  after insert on auth.users
  for each row execute function public.handle_new_expense_profile();

-- ============================================================
-- Multi-tenant company + owner/admin invite flow
-- Additive extension for the cashflow and expense portal.
-- ============================================================

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  slug text not null unique,
  owner_user_id uuid references auth.users(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companies
  add column if not exists email text,
  add column if not exists slug text,
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists is_demo boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.companies
set slug = trim(both '-' from lower(regexp_replace(name, '[^a-z0-9]+', '-', 'g')))
where slug is null or btrim(slug) = '';

update public.companies
set slug = substr(replace(id::text, '-', ''), 1, 12)
where coalesce(slug, '') = '';

with ranked_companies as (
  select
    id,
    slug,
    row_number() over (partition by slug order by created_at, id) as rn
  from public.companies
), deduped_companies as (
  select
    id,
    slug || '-' || substr(replace(id::text, '-', ''), 1, 6) as next_slug
  from ranked_companies
  where rn > 1
)
update public.companies c
set slug = d.next_slug
from deduped_companies d
where c.id = d.id;

alter table public.companies
  alter column slug set not null,
  alter column is_demo set default false,
  alter column created_at set default now(),
  alter column updated_at set default now();

create unique index if not exists companies_slug_key on public.companies(slug);

alter table public.companies enable row level security;

alter table public.profiles
  add column if not exists email text,
  add column if not exists updated_at timestamptz not null default now();

update public.profiles
set company_id = null
where company_id = '00000000-0000-0000-0000-000000000001';

alter table public.profiles
  alter column company_id drop not null,
  alter column company_id drop default;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_company_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_company_id_fkey
      foreign key (company_id) references public.companies(id) on delete set null;
  end if;
end $$;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('owner','admin','finance','employee'));

create table if not exists public.company_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','employee')),
  invite_token text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.company_invites
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists email text,
  add column if not exists role text,
  add column if not exists invite_token text,
  add column if not exists status text,
  add column if not exists invited_by uuid references auth.users(id) on delete set null,
  add column if not exists accepted_by uuid references auth.users(id) on delete set null,
  add column if not exists expires_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists created_at timestamptz;

update public.company_invites
set status = 'pending'
where status is null;

update public.company_invites
set expires_at = now() + interval '7 days'
where expires_at is null;

update public.company_invites
set created_at = now()
where created_at is null;

alter table public.company_invites
  alter column company_id set not null,
  alter column email set not null,
  alter column role set not null,
  alter column invite_token set not null,
  alter column status set not null,
  alter column expires_at set not null,
  alter column created_at set not null,
  alter column status set default 'pending',
  alter column expires_at set default (now() + interval '7 days'),
  alter column created_at set default now();

create unique index if not exists company_invites_invite_token_key on public.company_invites(invite_token);

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'company_invites'
      and constraint_name = 'company_invites_status_check'
  ) then
    alter table public.company_invites drop constraint company_invites_status_check;
  end if;

  alter table public.company_invites
    add constraint company_invites_status_check
    check (status in ('pending','accepted','revoked','expired'));
exception
  when duplicate_object then
    null;
end $$;

alter table public.company_invites enable row level security;

drop policy if exists companies_select_same_company on public.companies;
create policy companies_select_same_company on public.companies for select
  using (id = public.my_company_id());

drop policy if exists companies_manage_same_company on public.companies;
create policy companies_manage_same_company on public.companies for update
  using (public.is_admin() and id = public.my_company_id())
  with check (public.is_admin() and id = public.my_company_id());

drop policy if exists company_invites_none on public.company_invites;
create policy company_invites_none on public.company_invites for select
  using (false);

create or replace function public.is_admin() returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and lower((role)::text) in ('owner','admin','finance')
  );
$$ language sql security definer stable set search_path to 'public';

create or replace function public.my_role() returns text as $$
  select (role)::text from public.profiles where id = auth.uid();
$$ language sql security definer stable set search_path to 'public';

create or replace function public.my_company_id() returns uuid as $$
  select company_id from public.profiles where id = auth.uid();
$$ language sql security definer stable set search_path to 'public';

create or replace function public.set_profile_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql security invoker;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_profile_updated_at();

create or replace function public.set_company_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql security invoker;

drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at
  before update on public.companies
  for each row execute function public.set_company_updated_at();

create or replace function public.get_my_profile()
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  company_id uuid,
  company_name text,
  company_slug text,
  is_demo boolean,
  created_at timestamptz,
  updated_at timestamptz
) as $$
begin
  return query
    select
      p.id,
      p.full_name,
      coalesce(p.email, auth.jwt()->>'email') as email,
      (p.role)::text,
      p.company_id,
      c.name,
      c.slug,
      coalesce(c.is_demo, false),
      p.created_at,
      p.updated_at
    from public.profiles p
    left join public.companies c on c.id = p.company_id
    where p.id = auth.uid();
end;
$$ language plpgsql security definer stable set search_path to 'public';

create or replace function public.bootstrap_company_owner(
  p_company_name text,
  p_full_name text default null,
  p_is_demo boolean default false,
  p_company_email text default null
) returns jsonb as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_existing_company uuid;
  v_name text := nullif(trim(p_company_name), '');
  v_email text := lower(coalesce(
    nullif(trim(p_company_email), ''),
    auth.jwt()->>'email',
    ''
  ));
  v_slug text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select company_id into v_existing_company
  from public.profiles
  where id = v_user_id;

  if v_existing_company is not null then
    return jsonb_build_object('company_id', v_existing_company, 'already_initialized', true);
  end if;

  if v_name is null then
    raise exception 'Company name is required';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Company email is required';
  end if;

  v_slug := lower(regexp_replace(v_name, '[^a-z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    v_slug := substr(replace(v_user_id::text, '-', ''), 1, 12);
  end if;
  if exists (select 1 from public.companies where slug = v_slug) then
    v_slug := v_slug || '-' || substr(replace(v_user_id::text, '-', ''), 1, 6);
  end if;

  insert into public.companies (name, email, slug, owner_user_id, is_demo)
  values (v_name, v_email, v_slug, v_user_id, coalesce(p_is_demo, false))
  returning id into v_company_id;

  insert into public.profiles (id, full_name, email, role, company_id)
  values (
    v_user_id,
    coalesce(nullif(trim(p_full_name), ''), 'Workspace Owner'),
    v_email,
    'owner',
    v_company_id
  )
  on conflict (id) do update
    set full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
        email = coalesce(nullif(excluded.email, ''), public.profiles.email),
        role = 'owner',
        company_id = v_company_id;

  return jsonb_build_object('company_id', v_company_id, 'company_name', v_name, 'company_slug', v_slug, 'role', 'owner');
end;
$$ language plpgsql security definer set search_path to 'public';

create or replace function public.create_company_invite(
  p_email text,
  p_role text default 'admin'
) returns jsonb as $$
declare
  v_company_id uuid := public.my_company_id();
  v_role text := lower(coalesce(public.my_role(), ''));
  v_email text := lower(nullif(trim(p_email), ''));
  v_invite_role text := lower(coalesce(nullif(trim(p_role), ''), 'employee'));
  v_token text := md5(random()::text || clock_timestamp()::text || coalesce(auth.uid()::text, ''))
    || md5(random()::text || coalesce(v_email, '') || coalesce(v_invite_role, ''));
  v_company_name text;
  v_role_data_type text;
  v_role_udt text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if v_company_id is null then
    raise exception 'Complete owner onboarding before inviting admins';
  end if;

  if v_role not in ('owner','admin','finance') then
    raise exception 'Only company admins can send invites';
  end if;

  if v_email is null then
    raise exception 'A valid email is required';
  end if;

  if v_invite_role not in ('admin','employee') then
    raise exception 'Only admin or employee invites are supported';
  end if;

  update public.company_invites
  set status = 'revoked'
  where company_id = v_company_id
    and lower(email) = v_email
    and lower((role)::text) = v_invite_role
    and status = 'pending';

  select c.data_type,
         case when c.data_type = 'USER-DEFINED' then format('%I.%I', c.udt_schema, c.udt_name) else null end
    into v_role_data_type, v_role_udt
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'company_invites'
    and c.column_name = 'role';

  if v_role_data_type = 'USER-DEFINED' and v_role_udt is not null then
    execute format(
      'insert into public.company_invites (company_id, email, role, invite_token, invited_by) values ($1, $2, $3::%s, $4, $5)',
      v_role_udt
    ) using v_company_id, v_email, v_invite_role, v_token, auth.uid();
  else
    insert into public.company_invites (company_id, email, role, invite_token, invited_by)
    values (v_company_id, v_email, v_invite_role, v_token, auth.uid());
  end if;

  select name into v_company_name from public.companies where id = v_company_id;

  return jsonb_build_object(
    'email', v_email,
    'role', v_invite_role,
    'invite_token', v_token,
    'company_id', v_company_id,
    'company_name', v_company_name
  );
end;
$$ language plpgsql security definer set search_path to 'public';

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'company_invites'
      and constraint_type = 'CHECK'
      and constraint_name = 'company_invites_role_check'
  ) then
    alter table public.company_invites drop constraint company_invites_role_check;
  end if;

  alter table public.company_invites
    add constraint company_invites_role_check
    check (role in ('admin','employee'));
exception
  when duplicate_object then
    null;
end $$;

create or replace function public.list_company_invites()
returns table (
  id uuid,
  email text,
  role text,
  status text,
  invite_token text,
  expires_at timestamptz,
  created_at timestamptz
) as $$
begin
  if lower(coalesce(public.my_role(), '')) not in ('owner','admin','finance') then
    raise exception 'Only company admins can view invites';
  end if;

  return query
    select ci.id, ci.email, ci.role, ci.status, ci.invite_token, ci.expires_at, ci.created_at
    from public.company_invites ci
    where ci.company_id = public.my_company_id()
    order by ci.created_at desc;
end;
$$ language plpgsql security definer stable set search_path to 'public';

create or replace function public.accept_company_invite(
  p_invite_token text,
  p_full_name text default null
) returns jsonb as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  v_invite public.company_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_invite
  from public.company_invites
  where invite_token = trim(coalesce(p_invite_token, ''))
  limit 1;

  if not found then
    raise exception 'Invite not found';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'Invite is no longer active';
  end if;

  if v_invite.expires_at < now() then
    update public.company_invites set status = 'expired' where id = v_invite.id;
    raise exception 'Invite has expired';
  end if;

  if lower(v_invite.email) <> v_email then
    raise exception 'Invite email does not match the signed-in account';
  end if;

  insert into public.profiles (id, full_name, email, role, company_id)
  values (
    v_user_id,
    coalesce(nullif(trim(p_full_name), ''), 'Team Member'),
    v_email,
    v_invite.role,
    v_invite.company_id
  )
  on conflict (id) do update
    set full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
        email = excluded.email,
        role = v_invite.role,
        company_id = v_invite.company_id;

  update public.company_invites
  set status = 'accepted',
      accepted_at = now(),
      accepted_by = v_user_id
  where id = v_invite.id;

  return jsonb_build_object('company_id', v_invite.company_id, 'role', v_invite.role, 'accepted', true);
end;
$$ language plpgsql security definer set search_path to 'public';

create or replace function public.handle_new_expense_profile() returns trigger as $$
declare
  v_role text;
  v_email text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'employee');
  if v_role not in ('owner','admin','finance','employee') then
    v_role := 'employee';
  end if;
  v_email := lower(coalesce(new.email, new.raw_user_meta_data->>'email', ''));

  insert into public.profiles (id, full_name, email, role)
  values (new.id, new.raw_user_meta_data->>'full_name', v_email, v_role)
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name),
        email = coalesce(nullif(excluded.email, ''), public.profiles.email);
  return new;
end;
$$ language plpgsql security definer set search_path to 'public';