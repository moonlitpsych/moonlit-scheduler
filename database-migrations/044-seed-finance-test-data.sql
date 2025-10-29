-- Migration 044: Seed Finance Test Data
-- Purpose: Create sample data for testing finance workflows
-- Date: 2025-10-29

-- IMPORTANT: This is test data only. Do NOT run in production without review.

-- ============================================================
-- SECTION 1: Fee Schedule Lines
-- ============================================================

-- Insert sample fee schedules (use existing payer IDs)
do $$
declare
  v_payer_id uuid;
begin
  -- Get first payer for testing
  select id into v_payer_id from public.payers limit 1;

  if v_payer_id is not null then
    -- Common CPT codes with sample rates
    insert into public.fee_schedule_lines (payer_id, cpt, allowed_cents, effective_from, notes) values
      (v_payer_id, '99213', 9500, '2025-01-01', 'Office visit, established patient'),
      (v_payer_id, '99214', 13500, '2025-01-01', 'Office visit, established patient, complex'),
      (v_payer_id, '99203', 11000, '2025-01-01', 'New patient visit'),
      (v_payer_id, '99204', 16500, '2025-01-01', 'New patient visit, complex'),
      (v_payer_id, '90834', 12000, '2025-01-01', 'Psychotherapy, 45 minutes'),
      (v_payer_id, '90837', 15000, '2025-01-01', 'Psychotherapy, 60 minutes')
    on conflict do nothing;

    raise notice 'Created fee schedule lines for payer %', v_payer_id;
  end if;
end $$;

-- ============================================================
-- SECTION 2: Provider Pay Rules
-- ============================================================

-- Create pay rules for existing providers (33% of actual collections)
insert into public.provider_pay_rules (provider_id, basis, percent, priority, effective_from, notes)
select
  p.id,
  'ACTUAL'::provider_pay_basis,
  0.330, -- 33%
  100,
  '2025-01-01'::date,
  'Standard provider compensation: 33% of collections'
from public.providers p
where p.is_active = true
on conflict do nothing;

-- Higher rate for new patient visits (40%)
insert into public.provider_pay_rules (
  provider_id,
  basis,
  percent,
  applies_service_id,
  priority,
  effective_from,
  notes
)
select
  p.id,
  'ACTUAL'::provider_pay_basis,
  0.400, -- 40%
  s.id,
  50, -- Higher priority (lower number)
  '2025-01-01'::date,
  'New patient visits: 40% of collections'
from public.providers p
cross join public.services s
where p.is_active = true
  and s.name ilike '%new patient%'
  and not exists (
    select 1 from public.provider_pay_rules ppr
    where ppr.provider_id = p.id
      and ppr.applies_service_id = s.id
  )
on conflict do nothing;

raise notice 'Created provider pay rules for % providers', (select count(*) from public.providers where is_active = true);

-- ============================================================
-- SECTION 3: Sample Test Appointments (Optional)
-- ============================================================

-- Only create if explicitly requested (commented out by default)
/*
do $$
declare
  v_provider_id uuid;
  v_service_id uuid;
  v_service_instance_id uuid;
  v_payer_id uuid;
  v_date date;
  i int;
begin
  -- Get sample IDs
  select id into v_provider_id from public.providers where is_active = true limit 1;
  select id into v_service_id from public.services limit 1;
  select id into v_service_instance_id from public.service_instances where service_id = v_service_id limit 1;
  select id into v_payer_id from public.payers limit 1;

  if v_provider_id is null or v_service_instance_id is null then
    raise notice 'Skipping test appointments: missing provider or service';
    return;
  end if;

  -- Create 10 test appointments over past 30 days
  for i in 1..10 loop
    v_date := current_date - (i * 3)::int;

    insert into public.appointments (
      provider_id,
      service_instance_id,
      payer_id,
      start_time,
      end_time,
      status,
      appointment_type,
      booking_source,
      patient_info,
      insurance_info,
      notes
    ) values (
      v_provider_id,
      v_service_instance_id,
      v_payer_id,
      v_date + interval '9 hours',
      v_date + interval '10 hours',
      'completed',
      'new_patient',
      'test_seed',
      jsonb_build_object(
        'firstName', 'Test',
        'lastName', 'Patient' || i,
        'phone', '555-0100',
        'email', 'test' || i || '@example.com',
        'dateOfBirth', '1990-01-01'
      ),
      jsonb_build_object(
        'memberId', 'TEST' || i,
        'groupNumber', 'GROUP1'
      ),
      'Test appointment created by seed script'
    );
  end loop;

  raise notice 'Created 10 test appointments';
end $$;
*/

-- ============================================================
-- SECTION 4: Backfill default_cpt for existing services
-- ============================================================

-- Map common service names to CPT codes
update public.services
set default_cpt = case
  when name ilike '%new patient%' then '99203'
  when name ilike '%follow%up%' or name ilike '%established%' then '99213'
  when name ilike '%therapy%45%' or name ilike '%psychotherapy%45%' then '90834'
  when name ilike '%therapy%60%' or name ilike '%psychotherapy%60%' then '90837'
  else null
end
where default_cpt is null;

raise notice 'Backfilled default_cpt for services';

-- ============================================================
-- SECTION 5: Verification
-- ============================================================

do $$
declare
  v_fee_count int;
  v_rule_count int;
  v_appt_count int;
begin
  select count(*) into v_fee_count from public.fee_schedule_lines;
  select count(*) into v_rule_count from public.provider_pay_rules;
  select count(*) into v_appt_count from public.appointments where booking_source = 'test_seed';

  raise notice '=== Seed Data Summary ===';
  raise notice 'Fee schedule lines: %', v_fee_count;
  raise notice 'Provider pay rules: %', v_rule_count;
  raise notice 'Test appointments: % (commented out by default)', v_appt_count;
  raise notice '========================';

  if v_fee_count = 0 then
    raise warning 'No fee schedule lines created. Check that payers exist in database.';
  end if;

  if v_rule_count = 0 then
    raise warning 'No provider pay rules created. Check that providers exist in database.';
  end if;
end $$;
