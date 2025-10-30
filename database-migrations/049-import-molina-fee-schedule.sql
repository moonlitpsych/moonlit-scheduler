-- =====================================================================
-- Migration 049: Import Molina Utah Fee Schedule Rates
-- =====================================================================
-- Purpose: Import Molina Utah fee schedule for 7 CPT codes
-- This fixes 1 appointment showing $4.00 instead of correct rate
-- Source: Molina_Fee_Schedule_Utah Q3 2025.xlsx (Non-Facility Fees)
-- =====================================================================

begin;

-- Step 1: Get Molina Utah payer_id
do $$
declare
  v_molina_id uuid;
begin
  -- Find Molina Utah payer
  select id into v_molina_id
  from public.payers
  where name = 'Molina Utah'
  limit 1;

  if v_molina_id is null then
    raise exception 'Molina Utah payer not found in payers table';
  end if;

  raise notice '✅ Found Molina Utah: %', v_molina_id;
end $$;

-- Step 2: Create temp table for Molina rates
create temp table temp_molina_rates (
  cpt_code text,
  amount_dollars numeric,
  amount_cents int
);

-- Step 3: Insert Molina rates (converted to cents)
insert into temp_molina_rates (cpt_code, amount_dollars, amount_cents)
values
  ('99204', 140.11, 14011),  -- Office O/P New Mod
  ('99205', 177.24, 17724),  -- Office O/P New Hi
  ('99214', 105.52, 10552),  -- Office O/P Est Mod
  ('99215', 141.95, 14195),  -- Office O/P Est Hi
  ('90833', 67.38, 6738),    -- Psytx W Pt W E/M 30 Min
  ('90836', 84.83, 8483),    -- Psytx W Pt W E/M 45 Min
  ('90838', 111.65, 11165);  -- Psytx W Pt W E/M 60 Min

-- Step 4: Verify we have exactly 7 rates
do $$
declare
  v_rate_count int;
begin
  select count(*) into v_rate_count from temp_molina_rates;

  if v_rate_count != 7 then
    raise exception 'Expected 7 CPT rates, found %', v_rate_count;
  end if;

  raise notice '✅ Loaded 7 Molina rates';
end $$;

-- Step 5: Insert into fee_schedule_lines
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
  (select id from public.payers where name = 'Molina Utah' limit 1) as payer_id,
  tmr.cpt_code,
  tmr.amount_cents,
  '2025-07-01'::date as effective_from,  -- Q3 2025
  null as effective_to,
  now() as created_at,
  now() as updated_at
from temp_molina_rates tmr
on conflict (payer_id, cpt, effective_from)
do update set
  allowed_cents = excluded.allowed_cents,
  updated_at = now();

-- Step 6: Verification
do $$
declare
  r record;
  v_total_imported int;
  v_molina_id uuid;
begin
  -- Get Molina payer ID
  select id into v_molina_id
  from public.payers
  where name = 'Molina Utah'
  limit 1;

  -- Count imported lines
  select count(*) into v_total_imported
  from public.fee_schedule_lines
  where payer_id = v_molina_id;

  raise notice '=================================================================';
  raise notice 'Molina Utah Fee Schedule Import Results:';
  raise notice '=================================================================';
  raise notice 'Total fee schedule lines for Molina Utah: %', v_total_imported;
  raise notice '';
  raise notice 'Imported Rates:';
  raise notice '=================================================================';

  for r in (
    select
      cpt,
      allowed_cents,
      (allowed_cents::numeric / 100)::numeric(10,2) as amount_dollars
    from public.fee_schedule_lines
    where payer_id = v_molina_id
    order by cpt
  ) loop
    raise notice 'CPT % | $% (% cents)',
      rpad(r.cpt, 6),
      lpad(r.amount_dollars::text, 7),
      r.allowed_cents;
  end loop;

  raise notice '=================================================================';
  raise notice 'This should fix 1 appointment currently showing $4.00';
  raise notice '=================================================================';
end $$;

commit;

-- =====================================================================
-- Migration Complete
-- =====================================================================
-- Imported 7 CPT codes for Molina Utah:
--   99204 → $140.11 (Intake - moderate complexity)
--   99205 → $177.24 (Intake - high complexity)
--   99214 → $105.52 (Follow-up Short)
--   99215 → $141.95 (Follow-up Extended)
--   90833 → $67.38  (Therapy add-on 30 min)
--   90836 → $84.83  (Therapy add-on 45 min)
--   90838 → $111.65 (Therapy add-on 60 min)
--
-- This fixes the 1 appointment with Molina Utah showing $4.00
-- =====================================================================
