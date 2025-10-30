-- =====================================================================
-- Migration 050: Import HMHI-BHN Fee Schedule Rates
-- =====================================================================
-- Purpose: Import HMHI-BHN fee schedule for 7 CPT codes
-- This fixes 2 appointments showing $4.00 instead of correct rates
-- Source: HMHI-BHN Provider Handbook 2025-2026.pdf (Adult Fee Schedule, MD/DO)
-- =====================================================================

begin;

-- Step 1: Get HMHI BHN payer_id
do $$
declare
  v_hmhi_id uuid;
begin
  -- Find HMHI BHN payer
  select id into v_hmhi_id
  from public.payers
  where name = 'HMHI BHN'
  limit 1;

  if v_hmhi_id is null then
    raise exception 'HMHI BHN payer not found in payers table';
  end if;

  raise notice '✅ Found HMHI BHN: %', v_hmhi_id;
end $$;

-- Step 2: Create temp table for HMHI-BHN rates
create temp table temp_hmhi_rates (
  cpt_code text,
  amount_dollars numeric,
  amount_cents int
);

-- Step 3: Insert HMHI-BHN rates (converted to cents)
insert into temp_hmhi_rates (cpt_code, amount_dollars, amount_cents)
values
  ('99204', 282.30, 28230),  -- Office O/P New Mod
  ('99205', 352.22, 35222),  -- Office O/P New Hi
  ('99214', 181.93, 18193),  -- Office O/P Est Mod
  ('99215', 243.43, 24343),  -- Office O/P Est Hi
  ('90833', 116.54, 11654),  -- Psytx W Pt W E/M 30 Min
  ('90836', 146.33, 14633),  -- Psytx W Pt W E/M 45 Min
  ('90838', 194.23, 19423);  -- Psytx W Pt W E/M 60 Min

-- Step 4: Verify we have exactly 7 rates
do $$
declare
  v_rate_count int;
begin
  select count(*) into v_rate_count from temp_hmhi_rates;

  if v_rate_count != 7 then
    raise exception 'Expected 7 CPT rates, found %', v_rate_count;
  end if;

  raise notice '✅ Loaded 7 HMHI-BHN rates';
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
  (select id from public.payers where name = 'HMHI BHN' limit 1) as payer_id,
  thr.cpt_code,
  thr.amount_cents,
  '2025-01-01'::date as effective_from,
  null as effective_to,
  now() as created_at,
  now() as updated_at
from temp_hmhi_rates thr
on conflict (payer_id, cpt, effective_from)
do update set
  allowed_cents = excluded.allowed_cents,
  updated_at = now();

-- Step 6: Verification
do $$
declare
  r record;
  v_total_imported int;
  v_hmhi_id uuid;
begin
  -- Get HMHI payer ID
  select id into v_hmhi_id
  from public.payers
  where name = 'HMHI BHN'
  limit 1;

  -- Count imported lines
  select count(*) into v_total_imported
  from public.fee_schedule_lines
  where payer_id = v_hmhi_id;

  raise notice '=================================================================';
  raise notice 'HMHI-BHN Fee Schedule Import Results:';
  raise notice '=================================================================';
  raise notice 'Total fee schedule lines for HMHI BHN: %', v_total_imported;
  raise notice '';
  raise notice 'Imported Rates:';
  raise notice '=================================================================';

  for r in (
    select
      cpt,
      allowed_cents,
      (allowed_cents::numeric / 100)::numeric(10,2) as amount_dollars
    from public.fee_schedule_lines
    where payer_id = v_hmhi_id
    order by cpt
  ) loop
    raise notice 'CPT % | $% (% cents)',
      rpad(r.cpt, 6),
      lpad(r.amount_dollars::text, 7),
      r.allowed_cents;
  end loop;

  raise notice '=================================================================';
  raise notice 'This should fix 2 appointments currently showing $4.00';
  raise notice 'Note: HMHI-BHN rates are significantly higher than other payers';
  raise notice '=================================================================';
end $$;

commit;

-- =====================================================================
-- Migration Complete
-- =====================================================================
-- Imported 7 CPT codes for HMHI BHN:
--   99204 → $282.30 (Intake - moderate complexity)
--   99205 → $352.22 (Intake - high complexity)
--   99214 → $181.93 (Follow-up Short)
--   99215 → $243.43 (Follow-up Extended)
--   90833 → $116.54 (Therapy add-on 30 min)
--   90836 → $146.33 (Therapy add-on 45 min)
--   90838 → $194.23 (Therapy add-on 60 min)
--
-- This fixes the 2 appointments with HMHI BHN showing $4.00
-- =====================================================================
