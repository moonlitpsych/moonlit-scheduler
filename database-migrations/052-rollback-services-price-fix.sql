-- =====================================================================
-- Migration 052: ROLLBACK Migration 051 - Services Price Was Already Correct
-- =====================================================================
-- Purpose: Undo the multiplication by 100 from migration 051
-- The services.price was already stored correctly, not in dollars
-- Migration 051 incorrectly multiplied by 100, causing $400 → $40,000
-- This rollback divides by 100 to restore original values
-- =====================================================================

begin;

-- Step 1: Show current incorrect values
do $$
declare
  r record;
begin
  raise notice '=================================================================';
  raise notice 'BEFORE ROLLBACK: Incorrect Values (multiplied by 100 in error)';
  raise notice '=================================================================';

  for r in (
    select
      id,
      name,
      price as price_current,
      (price::numeric / 100)::numeric(10,2) as will_become
    from public.services
    where price is not null
    order by name
  ) loop
    raise notice '% | Current: % → Will restore to: %',
      rpad(r.name, 40),
      lpad(r.price_current::text, 8),
      lpad(r.will_become::text, 7);
  end loop;

  raise notice '=================================================================';
end $$;

-- Step 2: Rollback - divide prices by 100 to restore originals
update public.services
set price = (price / 100)::int
where price is not null;

-- Step 3: Verify rollback
do $$
declare
  r record;
begin
  raise notice '=================================================================';
  raise notice 'AFTER ROLLBACK: Restored Original Values';
  raise notice '=================================================================';

  for r in (
    select
      id,
      name,
      price as price_restored
    from public.services
    where price is not null
    order by name
  ) loop
    raise notice '% | Restored price: %',
      rpad(r.name, 40),
      lpad(r.price_restored::text, 6);
  end loop;

  raise notice '=================================================================';
  raise notice '✅ Rollback complete - services.price restored to original values';
  raise notice '⚠️  Migration 051 should NOT be used - prices were already correct';
  raise notice '=================================================================';
end $$;

commit;

-- =====================================================================
-- Rollback Complete
-- =====================================================================
-- Original values restored:
--   Intake: 400 (was incorrectly changed to 40000)
--   Follow-up Short: 133 (was incorrectly changed to 13300)
--   Follow-up Extended: 266 (was incorrectly changed to 26600)
--
-- Root cause: Migration 051 assumed prices were in dollars, but they
-- were already in the correct format for the view calculation.
-- =====================================================================
