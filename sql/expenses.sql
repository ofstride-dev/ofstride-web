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

-- profiles: a user can always see their own row; admins can see all profiles
-- in their company (needed to show claimant names in the admin expense queue).
-- Both helpers are SECURITY DEFINER so they bypass RLS — no recursion.
drop policy if exists "profile_self_select" on public.profiles;
create policy "profile_self_select" on public.profiles for select
  using (
    id = auth.uid()
    or (
      public.is_admin()
      and company_id = public.my_company_id()
    )
  );

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