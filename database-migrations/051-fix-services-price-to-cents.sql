-- =====================================================================
-- Migration 051: Fix Services Price Storage (Dollars → Cents)
-- =====================================================================
-- Purpose: Convert services.price from dollars to cents
-- This fixes the fallback calculation in v_appointments_grid view
-- Current: services.price stores 400.00 (dollars) → view treats as 400 cents = $4.00
-- Fixed: services.price stores 40000 (cents) → view treats as 40000 cents = $400.00
-- =====================================================================

begin;

-- Step 1: Show current services and prices
do $$
declare
  r record;
begin
  raise notice '=================================================================';
  raise notice 'BEFORE: Current Services (stored in dollars, displayed as cents)';
  raise notice '=================================================================';

  for r in (
    select
      id,
      name,
      price as price_dollars,
      (price::numeric)::int as interpreted_as_cents,
      ((price::numeric)::int / 100.0)::numeric(10,2) as displayed_as
    from public.services
    order by name
  ) loop
    raise notice '% | Price: $% → Displayed as: $%',
      rpad(r.name, 40),
      lpad(r.price_dollars::text, 7),
      lpad(r.displayed_as::text, 7);
  end loop;

  raise notice '=================================================================';
end $$;

-- Step 2: Convert prices from dollars to cents
-- Multiply existing dollar values by 100 to get cents
update public.services
set price = (price * 100)::int
where price is not null;

-- Step 3: Verify conversion
do $$
declare
  r record;
  v_total_services int;
  v_updated_services int;
begin
  select count(*) into v_total_services from public.services;
  select count(*) into v_updated_services from public.services where price is not null;

  raise notice '=================================================================';
  raise notice 'AFTER: Services Converted to Cents';
  raise notice '=================================================================';
  raise notice 'Total services: %', v_total_services;
  raise notice 'Services with prices: %', v_updated_services;
  raise notice '';
  raise notice 'Updated Prices:';
  raise notice '=================================================================';

  for r in (
    select
      id,
      name,
      price as price_cents,
      (price::numeric / 100)::numeric(10,2) as display_dollars
    from public.services
    where price is not null
    order by name
  ) loop
    raise notice '% | % cents → $%',
      rpad(r.name, 40),
      lpad(r.price_cents::text, 6),
      lpad(r.display_dollars::text, 7);
  end loop;

  raise notice '=================================================================';
  raise notice '✅ All services.price values now stored in cents';
  raise notice '✅ View will correctly display these as dollars';
  raise notice '=================================================================';
end $$;

commit;

-- =====================================================================
-- Migration Complete
-- =====================================================================
-- Expected conversions:
--   Intake (New Patient Visit): $400.00 → 40000 cents
--   Follow-up Short: $133.00 → 13300 cents
--   Follow-up Extended: $266.00 → 26600 cents
--
-- This fixes the fallback calculation for appointments without fee schedules
-- Now: coalesce(fs.allowed_cents, s.price) will correctly use cents
-- =====================================================================
