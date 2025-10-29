-- Migration 041: Create Finance/Appointments Management Tables
-- Purpose: Add tables for finance workflows, provider pay, and appointment tracking
-- Date: 2025-10-29

-- ============================================================
-- SECTION 1: Foundation Tables (patients, claims, remittances)
-- ============================================================

-- Create patients table to normalize patient data
-- Note: Existing appointments use patient_info JSON; this allows gradual normalization
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  email text,
  phone text,
  external_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(email, date_of_birth), -- prevent duplicate patients
  unique(external_id)
);

comment on table public.patients is 'Normalized patient records; appointments currently use patient_info JSON';

-- Add patient_id to appointments (nullable for backward compatibility)
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'appointments'
    and column_name = 'patient_id'
  ) then
    alter table public.appointments add column patient_id uuid references public.patients(id);
    comment on column public.appointments.patient_id is 'Links to normalized patients table; nullable for backward compat with patient_info JSON';
  end if;
end $$;

-- Create finance_claims table for claims management
create table if not exists public.finance_claims (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete cascade,
  claim_control_number text,
  member_id text,
  dos date,
  provider_npi text,
  billed_amount_cents int,
  status text check (status in ('submitted','accepted','denied','pending','paid','partial')),
  denial_reason text,
  submitted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(claim_control_number)
);

comment on table public.finance_claims is 'Claims extracted from 837 files or manually entered';
create index on public.finance_claims (appointment_id);
create index on public.finance_claims (member_id, dos);

-- Create finance_remittances table for ERA/payment tracking
create table if not exists public.finance_remittances (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references public.finance_claims(id) on delete cascade,
  payment_cents int not null,
  adjustment_cents int default 0,
  remark_codes text[],
  check_number text,
  payment_date date,
  payer_id uuid references public.payers(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.finance_remittances is 'Payment records from ERA (835) files';
create index on public.finance_remittances (claim_id);
create index on public.finance_remittances (payment_date);

-- ============================================================
-- SECTION 2: Core Finance Tables
-- ============================================================

-- Add default_cpt to services if missing
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'services'
    and column_name = 'default_cpt'
  ) then
    alter table public.services add column default_cpt text;
    comment on column public.services.default_cpt is 'Default CPT code for this service (for fee schedule lookups)';

    -- Backfill from service_cpt_codes join to cpt_codes
    update public.services s
    set default_cpt = (
      select c.code
      from public.service_cpt_codes scc
      join public.cpt_codes c on c.id = scc.cpt_code_id
      where scc.service_id = s.id
      limit 1
    )
    where s.default_cpt is null;
  end if;
end $$;

-- Create appointment_ingests table for CSV upload tracking
create table if not exists public.appointment_ingests (
  id uuid primary key default gen_random_uuid(),
  source_filename text not null,
  source_hash text not null, -- SHA256 of file content for deduplication
  row_index int not null,
  raw jsonb not null, -- Original CSV row as JSON
  external_appt_id text,
  appt_date date,
  service_name text,
  practitioner_name text,
  patient_last_name text,
  payer_name text,
  revenue_type text, -- Cash / Medicaid / Commercial
  price_cents int,
  imported_at timestamptz not null default now(),
  created_at timestamptz default now(),
  unique(source_hash, row_index)
);

comment on table public.appointment_ingests is 'Raw appointment CSV import tracking with idempotency';
create index on public.appointment_ingests (source_hash);
create index on public.appointment_ingests (external_appt_id);
create index on public.appointment_ingests (imported_at);

-- Create fee_schedule_lines for detailed payer rates
create table if not exists public.fee_schedule_lines (
  id uuid primary key default gen_random_uuid(),
  payer_id uuid not null references public.payers(id) on delete cascade,
  plan_code text, -- Optional plan-specific rates
  cpt text not null,
  modifiers text[] default '{}',
  pos text, -- Place of service code
  units int not null default 1,
  allowed_cents int not null,
  effective_from date not null,
  effective_to date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.fee_schedule_lines is 'CPT-level fee schedules with effective dating';
create index on public.fee_schedule_lines (payer_id, cpt, effective_from);
create index on public.fee_schedule_lines (effective_from, effective_to);

-- Create provider_pay_basis enum
do $$ begin
  create type provider_pay_basis as enum ('EXPECTED','ACTUAL');
exception when duplicate_object then null;
end $$;

-- Create provider_pay_rules for compensation calculations
create table if not exists public.provider_pay_rules (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  basis provider_pay_basis not null default 'ACTUAL',
  percent numeric(6,3), -- e.g., 0.330 for 33%
  flat_cents int, -- Optional flat amount per encounter
  applies_service_id uuid references public.services(id),
  applies_payer_id uuid references public.payers(id),
  priority int not null default 100, -- Lower priority = higher precedence
  effective_from date not null,
  effective_to date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.provider_pay_rules is 'Versioned provider compensation rules with specificity matching';
create index on public.provider_pay_rules (provider_id, effective_from, priority);
create index on public.provider_pay_rules (effective_from, effective_to);

-- Create provider_earnings snapshot table
create table if not exists public.provider_earnings (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete restrict,
  basis provider_pay_basis not null,
  amount_cents int not null,
  calc_version int not null default 1,
  calc_source jsonb not null, -- Audit trail: inputs used (allowed, paid, rules matched)
  locked boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(appointment_id, provider_id, basis)
);

comment on table public.provider_earnings is 'Calculated provider earnings with full provenance';
create index on public.provider_earnings (appointment_id);
create index on public.provider_earnings (provider_id, locked);

-- ============================================================
-- SECTION 3: Pay Period and Run Tables
-- ============================================================

-- Create pay period status enum
do $$ begin
  create type pay_period_status as enum ('OPEN','LOCKED');
exception when duplicate_object then null;
end $$;

-- Create pay run status enum
do $$ begin
  create type pay_run_status as enum ('DRAFT','POSTED','VOID');
exception when duplicate_object then null;
end $$;

-- Create provider_pay_periods table
create table if not exists public.provider_pay_periods (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  status pay_period_status not null default 'OPEN',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(period_start, period_end)
);

comment on table public.provider_pay_periods is 'Payroll periods for provider compensation';
create index on public.provider_pay_periods (period_start, period_end);
create index on public.provider_pay_periods (status);

-- Create provider_pay_runs table
create table if not exists public.provider_pay_runs (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.provider_pay_periods(id) on delete restrict,
  status pay_run_status not null default 'DRAFT',
  posted_by uuid, -- references auth.users but kept as uuid for flexibility
  posted_at timestamptz,
  total_cents int not null default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.provider_pay_runs is 'Provider payroll run batches';
create index on public.provider_pay_runs (period_id);
create index on public.provider_pay_runs (status);
create index on public.provider_pay_runs (posted_at);

-- Create provider_pay_run_lines table
create table if not exists public.provider_pay_run_lines (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.provider_pay_runs(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  provider_id uuid not null references public.providers(id) on delete restrict,
  amount_cents int not null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(run_id, appointment_id, provider_id)
);

comment on table public.provider_pay_run_lines is 'Individual line items in a pay run';
create index on public.provider_pay_run_lines (run_id);
create index on public.provider_pay_run_lines (provider_id);
create index on public.provider_pay_run_lines (appointment_id);

-- ============================================================
-- SECTION 4: Manual Overrides Table
-- ============================================================

-- Create manual_overrides for inline-editable fields
create table if not exists public.manual_overrides (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('appointment','claim','payment')),
  record_id uuid not null,
  column_name text not null,
  value jsonb not null, -- Stored as {v: actual_value} for consistency
  reason text,
  changed_by uuid, -- auth user id
  changed_at timestamptz not null default now(),
  created_at timestamptz default now(),
  unique(scope, record_id, column_name)
);

comment on table public.manual_overrides is 'Manual field overrides with audit trail (replaces spreadsheet blue cells)';
create index on public.manual_overrides (scope, record_id);
create index on public.manual_overrides (changed_by);
create index on public.manual_overrides (changed_at);

-- ============================================================
-- SECTION 5: Triggers and Functions
-- ============================================================

-- Create or replace the updated_at trigger function
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

comment on function public.set_updated_at is 'Automatically updates updated_at timestamp on row modification';

-- Attach updated_at triggers to all new tables
do $$
declare
  t text;
begin
  for t in
    select table_name
    from (values
      ('patients'),
      ('finance_claims'),
      ('finance_remittances'),
      ('fee_schedule_lines'),
      ('provider_pay_rules'),
      ('provider_earnings'),
      ('provider_pay_periods'),
      ('provider_pay_runs'),
      ('provider_pay_run_lines')
    ) as tables(table_name)
  loop
    execute format('
      drop trigger if exists set_updated_at on public.%I;
      create trigger set_updated_at
      before update on public.%I
      for each row execute function public.set_updated_at();
    ', t, t);
  end loop;
end $$;

-- ============================================================
-- SECTION 6: RLS Policies
-- ============================================================

-- Enable RLS on all new tables
alter table public.patients enable row level security;
alter table public.finance_claims enable row level security;
alter table public.finance_remittances enable row level security;
alter table public.appointment_ingests enable row level security;
alter table public.fee_schedule_lines enable row level security;
alter table public.provider_pay_rules enable row level security;
alter table public.provider_earnings enable row level security;
alter table public.provider_pay_periods enable row level security;
alter table public.provider_pay_runs enable row level security;
alter table public.provider_pay_run_lines enable row level security;
alter table public.manual_overrides enable row level security;

-- Helper function to check if user is admin/finance
create or replace function public.is_admin_or_finance()
returns boolean language sql security definer as $$
  select coalesce(
    auth.jwt() ->> 'role' in ('admin', 'finance'),
    false
  );
$$;

-- Apply RLS policies to all tables
do $$
declare
  t text;
begin
  for t in
    select table_name
    from (values
      ('patients'),
      ('finance_claims'),
      ('finance_remittances'),
      ('appointment_ingests'),
      ('fee_schedule_lines'),
      ('provider_pay_rules'),
      ('provider_earnings'),
      ('provider_pay_periods'),
      ('provider_pay_runs'),
      ('provider_pay_run_lines'),
      ('manual_overrides')
    ) as tables(table_name)
  loop
    -- Read policy: admin and finance roles can read
    execute format('
      drop policy if exists finance_read_%s on public.%I;
      create policy finance_read_%s on public.%I
      for select using (public.is_admin_or_finance());
    ', t, t, t, t);

    -- Write policy: only admin role can write
    execute format('
      drop policy if exists finance_write_%s on public.%I;
      create policy finance_write_%s on public.%I
      for all using (auth.jwt() ->> ''role'' = ''admin'')
      with check (auth.jwt() ->> ''role'' = ''admin'');
    ', t, t, t, t);
  end loop;
end $$;

-- Grant usage to authenticated users
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;

-- ============================================================
-- SECTION 7: Verification
-- ============================================================

-- Verify all tables were created
do $$
declare
  missing_tables text[];
begin
  select array_agg(table_name)
  into missing_tables
  from (values
    ('patients'),
    ('finance_claims'),
    ('finance_remittances'),
    ('appointment_ingests'),
    ('fee_schedule_lines'),
    ('provider_pay_rules'),
    ('provider_earnings'),
    ('provider_pay_periods'),
    ('provider_pay_runs'),
    ('provider_pay_run_lines'),
    ('manual_overrides')
  ) as expected(table_name)
  where not exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
    and table_name = expected.table_name
  );

  if missing_tables is not null then
    raise exception 'Migration 041 failed: Missing tables: %', missing_tables;
  end if;

  raise notice 'Migration 041 completed successfully: All finance tables created';
end $$;
