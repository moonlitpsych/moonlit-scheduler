-- =====================================================================
-- Migration 048: Import SelectHealth Fee Schedule Rates
-- =====================================================================
-- Purpose: Import SelectHealth fee schedule for 7 CPT codes
-- This fixes 45 appointments showing $4.00 instead of correct rates
-- Source: SelectHealth Fee Schedule.pdf (2025 Commercial Fees, Non-Facility)
-- =====================================================================

begin;

-- Step 1: Get SelectHealth Integrated payer_id
do $$
declare
  v_selecthealth_id uuid;
begin
  -- Find SelectHealth Integrated payer
  select id into v_selecthealth_id
  from public.payers
  where name = 'SelectHealth Integrated'
  limit 1;

  if v_selecthealth_id is null then
    raise exception 'SelectHealth Integrated payer not found in payers table';
  end if;

  raise notice '✅ Found SelectHealth Integrated: %', v_selecthealth_id;
end $$;

-- Step 2: Create temp table for SelectHealth rates
create temp table temp_selecthealth_rates (
  cpt_code text,
  amount_dollars numeric,
  amount_cents int
);

-- Step 3: Insert SelectHealth rates (converted to cents)
insert into temp_selecthealth_rates (cpt_code, amount_dollars, amount_cents)
values
  ('99204', 188.76, 18876),  -- Office O/P New Mod
  ('99205', 249.11, 24911),  -- Office O/P New Hi
  ('99214', 144.58, 14458),  -- Office O/P Est Mod
  ('99215', 203.79, 20379),  -- Office O/P Est Hi
  ('90833', 82.40, 8240),    -- Psytx W Pt W E/M 30 Min
  ('90836', 104.16, 10416),  -- Psytx W Pt W E/M 45 Min
  ('90838', 138.07, 13807);  -- Psytx W Pt W E/M 60 Min

-- Step 4: Verify we have exactly 7 rates
do $$
declare
  v_rate_count int;
begin
  select count(*) into v_rate_count from temp_selecthealth_rates;

  if v_rate_count != 7 then
    raise exception 'Expected 7 CPT rates, found %', v_rate_count;
  end if;

  raise notice '✅ Loaded 7 SelectHealth rates';
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
  (select id from public.payers where name = 'SelectHealth Integrated' limit 1) as payer_id,
  tsr.cpt_code,
  tsr.amount_cents,
  '2025-01-01'::date as effective_from,
  null as effective_to,
  now() as created_at,
  now() as updated_at
from temp_selecthealth_rates tsr
on conflict (payer_id, cpt, effective_from)
do update set
  allowed_cents = excluded.allowed_cents,
  updated_at = now();

-- Step 6: Verification
do $$
declare
  r record;
  v_total_imported int;
  v_selecthealth_id uuid;
begin
  -- Get SelectHealth payer ID
  select id into v_selecthealth_id
  from public.payers
  where name = 'SelectHealth Integrated'
  limit 1;

  -- Count imported lines
  select count(*) into v_total_imported
  from public.fee_schedule_lines
  where payer_id = v_selecthealth_id;

  raise notice '=================================================================';
  raise notice 'SelectHealth Fee Schedule Import Results:';
  raise notice '=================================================================';
  raise notice 'Total fee schedule lines for SelectHealth: %', v_total_imported;
  raise notice '';
  raise notice 'Imported Rates:';
  raise notice '=================================================================';

  for r in (
    select
      cpt,
      allowed_cents,
      (allowed_cents::numeric / 100)::numeric(10,2) as amount_dollars
    from public.fee_schedule_lines
    where payer_id = v_selecthealth_id
    order by cpt
  ) loop
    raise notice 'CPT % | $% (% cents)',
      rpad(r.cpt, 6),
      lpad(r.amount_dollars::text, 7),
      r.allowed_cents;
  end loop;

  raise notice '=================================================================';
  raise notice 'This should fix 45 appointments currently showing $4.00';
  raise notice '=================================================================';
end $$;

commit;

-- =====================================================================
-- Migration Complete
-- =====================================================================
-- Imported 7 CPT codes for SelectHealth Integrated:
--   99204 → $188.76 (Intake - moderate complexity)
--   99205 → $249.11 (Intake - high complexity)
--   99214 → $144.58 (Follow-up Short)
--   99215 → $203.79 (Follow-up Extended)
--   90833 → $82.40  (Therapy add-on 30 min)
--   90836 → $104.16 (Therapy add-on 45 min)
--   90838 → $138.07 (Therapy add-on 60 min)
--
-- This fixes the 45 appointments with SelectHealth showing $4.00
-- =====================================================================
