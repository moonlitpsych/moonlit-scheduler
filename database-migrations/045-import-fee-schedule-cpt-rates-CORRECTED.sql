-- =====================================================================
-- Migration 045: Import Fee Schedule CPT Rates (CORRECTED)
-- =====================================================================
-- Purpose: Import direct CPT code reimbursement rates from 5 payer CSVs
-- Schema: fee_schedule_lines (payer_id, cpt TEXT, allowed_cents, effective_from)
-- All amounts converted to cents (dollars × 100)
-- =====================================================================

begin;

-- =====================================================================
-- Step 1: Create temporary payer mapping table
-- =====================================================================
create temp table temp_payer_mapping (
  csv_name text,
  db_payer_name text,
  payer_id uuid
);

-- Map CSV payer names to database payer IDs
insert into temp_payer_mapping (csv_name, db_payer_name, payer_id)
select
  'Optum' as csv_name,
  'Optum Commercial Behavioral Health' as db_payer_name,
  id as payer_id
from payers where name = 'Optum Commercial Behavioral Health'
union all
select
  'DMBA',
  'DMBA',
  id
from payers where name = 'DMBA'
union all
select
  'Health Choice Utah',
  'Health Choice Utah',
  id
from payers where name = 'Health Choice Utah'
union all
select
  'Aetna',
  'Aetna',
  id
from payers where name = 'Aetna'
union all
select
  'Utah Medicaid FFS',
  'Utah Medicaid Fee-for-Service',
  id
from payers where name = 'Utah Medicaid Fee-for-Service';

-- Verify all payers mapped successfully
do $$
declare
  v_mapped_count int;
begin
  select count(*) into v_mapped_count from temp_payer_mapping;
  if v_mapped_count != 5 then
    raise exception 'Expected 5 payer mappings, found %', v_mapped_count;
  end if;
  raise notice '✓ Successfully mapped % payers', v_mapped_count;
end $$;

-- =====================================================================
-- Step 2: Create temporary fee schedule data table
-- =====================================================================
create temp table temp_fee_schedule_data (
  payer_csv_name text,
  cpt_code text,
  amount_dollars numeric,
  amount_cents int
);

-- Insert Optum rates (from "Master Physician Fee Schedule - Optum (United BH) (1).csv")
insert into temp_fee_schedule_data (payer_csv_name, cpt_code, amount_dollars, amount_cents) values
  ('Optum', '99205', 220.94, 22094),
  ('Optum', '99204', 167.40, 16740),
  ('Optum', '90838', 116.57, 11657),
  ('Optum', '99214', 128.43, 12843),
  ('Optum', '99215', 179.94, 17994),
  ('Optum', '90836', 88.11, 8811),
  ('Optum', '90833', 76.03, 7603);

-- Insert DMBA rates (from "Master Physician Fee Schedule - DMBA (1).csv")
insert into temp_fee_schedule_data (payer_csv_name, cpt_code, amount_dollars, amount_cents) values
  ('DMBA', '99205', 283.79, 28379),
  ('DMBA', '99204', 224.93, 22493),
  ('DMBA', '90838', 154.90, 15490),
  ('DMBA', '99214', 146.33, 14633),
  ('DMBA', '99215', 197.56, 19756),
  ('DMBA', '90836', 117.40, 11740),
  ('DMBA', '90833', 92.99, 9299);

-- Insert Health Choice Utah rates (from "Master Physician Fee Schedule - Health Choice Utah (1).csv")
insert into temp_fee_schedule_data (payer_csv_name, cpt_code, amount_dollars, amount_cents) values
  ('Health Choice Utah', '99205', 167.27, 16727),
  ('Health Choice Utah', '99204', 126.56, 12656),
  ('Health Choice Utah', '90838', 140.80, 14080),
  ('Health Choice Utah', '99214', 95.44, 9544),
  ('Health Choice Utah', '99215', 134.10, 13410),
  ('Health Choice Utah', '90836', 105.61, 10561),
  ('Health Choice Utah', '90833', 70.41, 7041);

-- Insert Aetna rates (from "Master Physician Fee Schedule - Aetna (1).csv")
insert into temp_fee_schedule_data (payer_csv_name, cpt_code, amount_dollars, amount_cents) values
  ('Aetna', '99205', 203.53, 20353),
  ('Aetna', '99204', 163.38, 16338),
  ('Aetna', '90838', 129.11, 12911),
  ('Aetna', '99214', 105.23, 10523),
  ('Aetna', '99215', 126.46, 12646),
  ('Aetna', '90836', 112.27, 11227),
  ('Aetna', '90833', 69.01, 6901);

-- Insert Utah Medicaid FFS rates (from "Master Physician Fee Schedule - FFS Medicai (1).csv")
insert into temp_fee_schedule_data (payer_csv_name, cpt_code, amount_dollars, amount_cents) values
  ('Utah Medicaid FFS', '99205', 167.27, 16727),
  ('Utah Medicaid FFS', '99204', 126.56, 12656),
  ('Utah Medicaid FFS', '90838', 140.80, 14080),
  ('Utah Medicaid FFS', '99214', 95.44, 9544),
  ('Utah Medicaid FFS', '99215', 134.10, 13410),
  ('Utah Medicaid FFS', '90836', 105.61, 10561),
  ('Utah Medicaid FFS', '90833', 70.41, 7041);

do $$
begin
  raise notice '✓ Inserted 35 fee schedule records (5 payers × 7 CPT codes)';
end $$;

-- =====================================================================
-- Step 3: Add unique constraint (if not exists) for ON CONFLICT
-- =====================================================================
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fee_schedule_lines_payer_cpt_date_key'
  ) then
    alter table public.fee_schedule_lines
    add constraint fee_schedule_lines_payer_cpt_date_key
    unique (payer_id, cpt, effective_from);
    raise notice '✓ Added unique constraint on (payer_id, cpt, effective_from)';
  else
    raise notice '✓ Unique constraint already exists';
  end if;
end $$;

-- =====================================================================
-- Step 4: Insert into fee_schedule_lines table
-- =====================================================================
insert into public.fee_schedule_lines (
  payer_id,
  cpt,
  allowed_cents,
  effective_from,
  effective_to,
  created_at,
  updated_at
)
select
  pm.payer_id,
  fs.cpt_code,
  fs.amount_cents,
  '2024-01-01'::date as effective_from,
  null as effective_to,
  now() as created_at,
  now() as updated_at
from temp_fee_schedule_data fs
inner join temp_payer_mapping pm on pm.csv_name = fs.payer_csv_name
on conflict (payer_id, cpt, effective_from)
do update set
  allowed_cents = excluded.allowed_cents,
  updated_at = now();

-- =====================================================================
-- Step 5: Verification queries
-- =====================================================================

-- Verify total records inserted/updated
do $$
declare
  v_total_lines int;
begin
  select count(*) into v_total_lines from public.fee_schedule_lines;
  raise notice '✓ Total fee_schedule_lines records: %', v_total_lines;
end $$;

-- Display sample of inserted data
do $$
begin
  raise notice '=================================================================';
  raise notice 'Sample Fee Schedule Lines (showing first 10):';
  raise notice '=================================================================';
end $$;

do $$
declare
  r record;
begin
  for r in (
    select
      p.name as payer_name,
      fsl.cpt as cpt_code,
      fsl.allowed_cents,
      (fsl.allowed_cents::numeric / 100)::numeric(10,2) as allowed_dollars,
      fsl.effective_from
    from public.fee_schedule_lines fsl
    inner join public.payers p on p.id = fsl.payer_id
    where fsl.cpt in ('99205', '99204', '90838', '99214', '99215', '90836', '90833')
    order by p.name, fsl.cpt
    limit 10
  ) loop
    raise notice '% | CPT % | $% ($% cents) | Effective: %',
      rpad(r.payer_name, 35),
      r.cpt_code,
      lpad(r.allowed_dollars::text, 7),
      lpad(r.allowed_cents::text, 6),
      r.effective_from;
  end loop;
end $$;

-- Display payer summary
do $$
begin
  raise notice '=================================================================';
  raise notice 'Fee Schedule Summary by Payer:';
  raise notice '=================================================================';
end $$;

do $$
declare
  r record;
begin
  for r in (
    select
      p.name as payer_name,
      count(*) as cpt_count,
      min(fsl.allowed_cents::numeric / 100) as min_rate,
      max(fsl.allowed_cents::numeric / 100) as max_rate,
      avg(fsl.allowed_cents::numeric / 100)::numeric(10,2) as avg_rate
    from public.fee_schedule_lines fsl
    inner join public.payers p on p.id = fsl.payer_id
    where fsl.cpt in ('99205', '99204', '90838', '99214', '99215', '90836', '90833')
    group by p.name
    order by p.name
  ) loop
    raise notice '% | % CPT codes | Min: $% | Max: $% | Avg: $%',
      rpad(r.payer_name, 35),
      r.cpt_count,
      lpad(r.min_rate::text, 7),
      lpad(r.max_rate::text, 7),
      lpad(r.avg_rate::text, 7);
  end loop;
end $$;

commit;

-- =====================================================================
-- Migration Complete
-- =====================================================================
-- Summary: Imported 35 fee schedule lines (5 payers × 7 CPT codes)
-- All amounts stored in cents to avoid floating-point errors
-- Effective from: 2024-01-01 (can be updated as needed)
-- =====================================================================
