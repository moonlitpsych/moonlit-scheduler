-- Migration 042: Provider Earnings Calculation Engine
-- Purpose: Deterministic calculation of provider compensation
-- Date: 2025-10-29

-- ============================================================
-- SECTION 1: Fee Schedule Lookup Function
-- ============================================================

create or replace function public.fn_get_allowed_amount(
  p_payer_id uuid,
  p_cpt text,
  p_dos date,
  p_pos text default null,
  p_plan_code text default null
) returns int language plpgsql stable as $$
declare
  v_allowed int;
begin
  -- Find most specific fee schedule line
  -- Priority: plan + pos > plan > pos > general
  select fsl.allowed_cents into v_allowed
  from public.fee_schedule_lines fsl
  where fsl.payer_id = p_payer_id
    and fsl.cpt = p_cpt
    and p_dos >= fsl.effective_from
    and (fsl.effective_to is null or p_dos <= fsl.effective_to)
    and (p_plan_code is null or fsl.plan_code is null or fsl.plan_code = p_plan_code)
    and (p_pos is null or fsl.pos is null or fsl.pos = p_pos)
  order by
    case when fsl.plan_code is not null and fsl.pos is not null then 1
         when fsl.plan_code is not null then 2
         when fsl.pos is not null then 3
         else 4 end,
    fsl.effective_from desc
  limit 1;

  return v_allowed;
end; $$;

comment on function public.fn_get_allowed_amount is 'Lookup allowed amount from fee schedule with specificity matching';

-- ============================================================
-- SECTION 2: Provider Pay Rule Matching Function
-- ============================================================

create or replace function public.fn_get_provider_pay_rule(
  p_provider_id uuid,
  p_service_id uuid,
  p_payer_id uuid,
  p_dos date
) returns table(
  rule_id uuid,
  percent numeric,
  flat_cents int,
  basis provider_pay_basis
) language plpgsql stable as $$
begin
  -- Find most specific rule by priority (lower = higher precedence)
  return query
  select
    r.id,
    r.percent,
    r.flat_cents,
    r.basis
  from public.provider_pay_rules r
  where r.provider_id = p_provider_id
    and (r.applies_service_id is null or r.applies_service_id = p_service_id)
    and (r.applies_payer_id is null or r.applies_payer_id = p_payer_id)
    and p_dos >= r.effective_from
    and (r.effective_to is null or p_dos <= r.effective_to)
  order by
    -- Specificity: service+payer > service > payer > general
    case
      when r.applies_service_id is not null and r.applies_payer_id is not null then 1
      when r.applies_service_id is not null then 2
      when r.applies_payer_id is not null then 3
      else 4
    end,
    r.priority asc,
    r.effective_from desc
  limit 1;
end; $$;

comment on function public.fn_get_provider_pay_rule is 'Find most specific provider pay rule with priority matching';

-- ============================================================
-- SECTION 3: Main Calculation Procedure
-- ============================================================

create or replace function public.sp_recompute_provider_earnings(p_appointment_id uuid)
returns void language plpgsql as $$
declare
  v_appt record;
  v_allowed int;
  v_paid int;
  v_rule record;
  v_expected int;
  v_actual int;
  v_calc_source jsonb;
begin
  -- Fetch appointment with related data
  select
    a.id,
    a.provider_id,
    a.payer_id,
    a.service_instance_id,
    a.start_time::date as dos,
    si.service_id,
    s.default_cpt,
    s.price as service_price_cents,
    si.pos_code
  into v_appt
  from public.appointments a
  join public.service_instances si on si.id = a.service_instance_id
  join public.services s on s.id = si.service_id
  where a.id = p_appointment_id;

  if not found then
    raise exception 'Appointment not found: %', p_appointment_id;
  end if;

  -- Skip if no default CPT
  if v_appt.default_cpt is null then
    raise notice 'Skipping appointment %: no default CPT for service', p_appointment_id;
    return;
  end if;

  -- 1. Lookup allowed amount from fee schedule
  v_allowed := public.fn_get_allowed_amount(
    v_appt.payer_id,
    v_appt.default_cpt,
    v_appt.dos,
    v_appt.pos_code
  );

  -- Fallback to service price if no fee schedule entry
  if v_allowed is null then
    v_allowed := coalesce(v_appt.service_price_cents, 0);
  end if;

  -- 2. Lookup paid amount from remittances
  select coalesce(sum(r.payment_cents), 0) into v_paid
  from public.finance_claims ec
  left join public.finance_remittances r on r.claim_id = ec.id
  where ec.appointment_id = v_appt.id;

  -- 3. Find applicable pay rule
  select * into v_rule
  from public.fn_get_provider_pay_rule(
    v_appt.provider_id,
    v_appt.service_id,
    v_appt.payer_id,
    v_appt.dos
  );

  -- If no rule found, default to 0% (no provider pay)
  if not found then
    v_expected := 0;
    v_actual := 0;
    v_calc_source := jsonb_build_object(
      'allowed_cents', v_allowed,
      'paid_cents', v_paid,
      'rule_id', null,
      'rule_found', false,
      'error', 'No provider pay rule found'
    );
  else
    -- Calculate EXPECTED (based on allowed amount)
    v_expected := coalesce((v_rule.percent * v_allowed)::int, 0) + coalesce(v_rule.flat_cents, 0);

    -- Calculate ACTUAL (based on paid amount)
    v_actual := coalesce((v_rule.percent * v_paid)::int, 0) + coalesce(v_rule.flat_cents, 0);

    -- Build audit trail
    v_calc_source := jsonb_build_object(
      'allowed_cents', v_allowed,
      'paid_cents', v_paid,
      'rule_id', v_rule.rule_id,
      'rule_percent', v_rule.percent,
      'rule_flat_cents', v_rule.flat_cents,
      'rule_basis', v_rule.basis,
      'calculated_at', now()
    );
  end if;

  -- 4. Upsert EXPECTED earnings
  insert into public.provider_earnings (
    appointment_id,
    provider_id,
    basis,
    amount_cents,
    calc_version,
    calc_source,
    locked
  ) values (
    v_appt.id,
    v_appt.provider_id,
    'EXPECTED',
    v_expected,
    1,
    v_calc_source,
    false
  )
  on conflict (appointment_id, provider_id, basis) do update
  set
    amount_cents = excluded.amount_cents,
    calc_source = excluded.calc_source,
    updated_at = now()
  where public.provider_earnings.locked = false; -- Don't update if locked

  -- 5. Upsert ACTUAL earnings
  insert into public.provider_earnings (
    appointment_id,
    provider_id,
    basis,
    amount_cents,
    calc_version,
    calc_source,
    locked
  ) values (
    v_appt.id,
    v_appt.provider_id,
    'ACTUAL',
    v_actual,
    1,
    v_calc_source,
    false
  )
  on conflict (appointment_id, provider_id, basis) do update
  set
    amount_cents = excluded.amount_cents,
    calc_source = excluded.calc_source,
    updated_at = now()
  where public.provider_earnings.locked = false;

  raise notice 'Computed earnings for appointment %: expected=$% actual=$%',
    p_appointment_id,
    (v_expected::numeric / 100),
    (v_actual::numeric / 100);

exception when others then
  raise warning 'Failed to compute earnings for appointment %: %', p_appointment_id, sqlerrm;
end; $$;

comment on function public.sp_recompute_provider_earnings is 'Deterministic provider earnings calculation with full audit trail';

-- ============================================================
-- SECTION 4: Batch Calculation Functions
-- ============================================================

-- Recompute by date range
create or replace function public.sp_recompute_provider_earnings_range(
  p_from date,
  p_to date
) returns table(
  processed int,
  succeeded int,
  failed int
) language plpgsql as $$
declare
  v_appointment_id uuid;
  v_processed int := 0;
  v_succeeded int := 0;
  v_failed int := 0;
begin
  for v_appointment_id in
    select a.id
    from public.appointments a
    where a.start_time::date between p_from and p_to
    order by a.start_time
  loop
    begin
      perform public.sp_recompute_provider_earnings(v_appointment_id);
      v_processed := v_processed + 1;
      v_succeeded := v_succeeded + 1;
    exception when others then
      v_processed := v_processed + 1;
      v_failed := v_failed + 1;
      raise warning 'Failed to process appointment %: %', v_appointment_id, sqlerrm;
    end;
  end loop;

  return query select v_processed, v_succeeded, v_failed;
end; $$;

comment on function public.sp_recompute_provider_earnings_range is 'Batch recompute provider earnings for date range';

-- Recompute for specific provider
create or replace function public.sp_recompute_provider_earnings_for_provider(
  p_provider_id uuid,
  p_from date,
  p_to date
) returns table(
  processed int,
  succeeded int,
  failed int
) language plpgsql as $$
declare
  v_appointment_id uuid;
  v_processed int := 0;
  v_succeeded int := 0;
  v_failed int := 0;
begin
  for v_appointment_id in
    select a.id
    from public.appointments a
    where a.provider_id = p_provider_id
      and a.start_time::date between p_from and p_to
    order by a.start_time
  loop
    begin
      perform public.sp_recompute_provider_earnings(v_appointment_id);
      v_processed := v_processed + 1;
      v_succeeded := v_succeeded + 1;
    exception when others then
      v_processed := v_processed + 1;
      v_failed := v_failed + 1;
    end;
  end loop;

  return query select v_processed, v_succeeded, v_failed;
end; $$;

comment on function public.sp_recompute_provider_earnings_for_provider is 'Batch recompute earnings for specific provider';

-- ============================================================
-- SECTION 5: Grant Permissions
-- ============================================================

grant execute on function public.fn_get_allowed_amount to authenticated;
grant execute on function public.fn_get_provider_pay_rule to authenticated;
grant execute on function public.sp_recompute_provider_earnings to authenticated;
grant execute on function public.sp_recompute_provider_earnings_range to authenticated;
grant execute on function public.sp_recompute_provider_earnings_for_provider to authenticated;

-- ============================================================
-- SECTION 6: Verification
-- ============================================================

do $$
begin
  -- Test that functions exist
  if not exists (
    select 1 from pg_proc where proname = 'sp_recompute_provider_earnings'
  ) then
    raise exception 'Migration 042 failed: sp_recompute_provider_earnings not created';
  end if;

  raise notice 'Migration 042 completed successfully: Provider earnings calculation engine ready';
end $$;
