-- Migration 063: Fix Service Names - Trim Leading/Trailing Spaces
-- Purpose: Fix data quality issue where "Intake" has leading space
-- Date: 2025-10-30

-- ============================================================================
-- STEP 1: Fix existing data in services table
-- ============================================================================

UPDATE public.services
SET name = TRIM(name)
WHERE name != TRIM(name);

-- ============================================================================
-- STEP 2: Update view to always trim service names
-- ============================================================================

DROP VIEW IF EXISTS public.v_appointments_grid CASCADE;

CREATE OR REPLACE VIEW public.v_appointments_grid AS
SELECT
  -- Core identifiers
  a.id as appointment_id,
  a.start_time::date as appt_date,
  a.start_time,
  a.end_time,
  a.status as appointment_status,

  -- Service information (TRIM service name to fix data quality issue)
  TRIM(s.name) as service,
  s.id as service_id,
  s.default_cpt,
  s.price as service_price_cents,

  -- Provider information
  p.first_name || ' ' || p.last_name as practitioner,
  p.id as provider_id,
  p.title as provider_title,
  p.npi as provider_npi,

  -- Patient information
  case
    when pt.id is not null then pt.last_name
    else a.patient_info->>'lastName'
  end as last_name,
  case
    when pt.id is not null then pt.email
    else a.patient_info->>'email'
  end as patient_email,

  -- Payer information
  py.name as payer,
  py.id as payer_id,
  case
    when py.payer_type is null then 'Cash'
    else py.payer_type
  end as rev_type,

  -- Manual override fields
  (o_patient_paid.value #>> '{v}')::numeric as patient_paid,
  (o_patient_paid_date.value #>> '{v}')::date as patient_paid_date,

  -- Copay tracking (separate from full patient payment)
  (o_copay_cents.value #>> '{v}')::numeric as copay_cents,
  (o_copay_date.value #>> '{v}')::date as copay_date,

  (o_discount.value #>> '{v}') as discount_note,
  (o_claim_needed.value #>> '{v}') as claim_needed,
  (o_claim_status.value #>> '{v}') as claim_status_override,
  (o_appt_status.value #>> '{v}') as appt_status_override,
  (o_notes.value #>> '{v}') as notes_override,
  coalesce((o_test_data.value #>> '{v}')::boolean, false) as is_test_data,

  -- Expected calculations (from fee schedule)
  coalesce(fs.allowed_cents, s.price) as expected_gross_cents,

  -- Provider expected pay (EXPECTED basis for preview)
  coalesce(pe_expected.amount_cents, 0) as provider_expected_pay_cents,
  pe_expected.calc_source as provider_expected_calc_source,

  -- Provider actual pay (ACTUAL basis, if paid)
  coalesce(pe_actual.amount_cents, 0) as provider_actual_pay_cents,
  pe_actual.calc_source as provider_actual_calc_source,

  -- Posted provider pay (from pay runs OR manual override)
  coalesce(
    (o_provider_paid_cents.value #>> '{v}')::numeric,
    ppl.amount_cents
  ) as provider_paid_cents,
  coalesce(
    (o_provider_paid_date.value #>> '{v}')::date,
    pr.posted_at::date
  ) as provider_paid_date,
  pr.status as provider_pay_run_status,

  -- Provider pay status
  case
    when a.status IN ('cancelled', 'no_show') then 'NO COMPENSATION'
    when (o_appt_status.value #>> '{v}') IN ('cancelled', 'no_show') then 'NO COMPENSATION'
    when pr.status = 'POSTED' then 'PAID'
    when (o_provider_paid_cents.value #>> '{v}')::numeric > 0 then 'PAID'
    when ppl.id is not null and pr.status = 'DRAFT' then 'READY'
    when coalesce(
      (o_reimbursement_cents.value #>> '{v}')::numeric,
      er.total_paid_cents,
      0
    ) > 0 and coalesce(
      (o_provider_paid_cents.value #>> '{v}')::numeric,
      ppl.amount_cents
    ) is null then 'REIMBURSED_UNPAID'
    else 'PENDING'
  end as provider_pay_status,

  -- Claims information
  ec.id as claim_id,
  ec.claim_control_number,
  ec.billed_amount_cents,
  coalesce(
    (o_claim_status.value #>> '{v}'),
    ec.status,
    'not_needed'
  ) as claim_status,
  ec.denial_reason,
  ec.submitted_at,

  -- Reimbursement from remittances OR manual override
  coalesce(
    (o_reimbursement_cents.value #>> '{v}')::numeric,
    er.total_paid_cents
  ) as reimbursement_cents,
  er.total_adjustment_cents as adjustment_cents,
  er.payment_count,

  -- Actual Gross (total revenue actually received)
  -- Actual Gross = Insurance Reimbursement + Patient Paid (full) + Copay
  coalesce(
    coalesce(
      (o_reimbursement_cents.value #>> '{v}')::numeric,
      er.total_paid_cents
    ), 0
  ) + coalesce((o_patient_paid.value #>> '{v}')::numeric, 0)
    + coalesce((o_copay_cents.value #>> '{v}')::numeric, 0) as actual_gross_cents,

  -- Expected net (ExpectedGross - ProviderExpectedPay)
  greatest(
    coalesce(fs.allowed_cents, s.price, 0) - coalesce(pe_expected.amount_cents, 0),
    0
  ) as expected_net_cents,

  -- Actual net (ActualGross - ProviderPaid)
  greatest(
    coalesce(
      coalesce(
        (o_reimbursement_cents.value #>> '{v}')::numeric,
        er.total_paid_cents
      ), 0
    ) + coalesce((o_patient_paid.value #>> '{v}')::numeric, 0)
      + coalesce((o_copay_cents.value #>> '{v}')::numeric, 0)
    - coalesce(
      coalesce(
        (o_provider_paid_cents.value #>> '{v}')::numeric,
        ppl.amount_cents
      ), 0
    ),
    0
  ) as actual_net_cents,

  -- Payment received status
  case
    when coalesce(
      coalesce(
        (o_reimbursement_cents.value #>> '{v}')::numeric,
        er.total_paid_cents
      ), 0
    ) > 0 or coalesce((o_patient_paid.value #>> '{v}')::numeric, 0) > 0
       or coalesce((o_copay_cents.value #>> '{v}')::numeric, 0) > 0 then 'PAID'
    when coalesce(
      (o_claim_status.value #>> '{v}'),
      ec.status,
      'not_needed'
    ) in ('submitted', 'pending', 'accepted') then 'PENDING'
    else 'UNPAID'
  end as payment_received_status,

  -- Payment method
  case
    when coalesce(
      coalesce(
        (o_reimbursement_cents.value #>> '{v}')::numeric,
        er.total_paid_cents
      ), 0
    ) > 0 and (coalesce((o_patient_paid.value #>> '{v}')::numeric, 0) > 0
               or coalesce((o_copay_cents.value #>> '{v}')::numeric, 0) > 0) then 'MIXED'
    when coalesce(
      coalesce(
        (o_reimbursement_cents.value #>> '{v}')::numeric,
        er.total_paid_cents
      ), 0
    ) > 0 then 'CLAIM'
    when coalesce((o_patient_paid.value #>> '{v}')::numeric, 0) > 0
         or coalesce((o_copay_cents.value #>> '{v}')::numeric, 0) > 0 then 'CASH'
    else 'NONE'
  end as payment_method,

  -- Audit fields
  a.created_at,
  a.updated_at,
  a.booking_source

from public.appointments a

-- Core joins
join public.service_instances si on si.id = a.service_instance_id
join public.services s on s.id = si.service_id
join public.providers p on p.id = a.provider_id

-- Optional patient normalization
left join public.patients pt on pt.id = a.patient_id

-- Optional payer
left join public.payers py on py.id = a.payer_id

-- Manual overrides (all the LEFT JOINs from migration 062)
left join public.manual_overrides o_patient_paid
  on o_patient_paid.scope = 'appointment'
  and o_patient_paid.record_id = a.id
  and o_patient_paid.column_name = 'patient_paid'

left join public.manual_overrides o_patient_paid_date
  on o_patient_paid_date.scope = 'appointment'
  and o_patient_paid_date.record_id = a.id
  and o_patient_paid_date.column_name = 'patient_paid_date'

left join public.manual_overrides o_copay_cents
  on o_copay_cents.scope = 'appointment'
  and o_copay_cents.record_id = a.id
  and o_copay_cents.column_name = 'copay_cents'

left join public.manual_overrides o_copay_date
  on o_copay_date.scope = 'appointment'
  and o_copay_date.record_id = a.id
  and o_copay_date.column_name = 'copay_date'

left join public.manual_overrides o_discount
  on o_discount.scope = 'appointment'
  and o_discount.record_id = a.id
  and o_discount.column_name = 'discount_reason'

left join public.manual_overrides o_claim_status
  on o_claim_status.scope = 'appointment'
  and o_claim_status.record_id = a.id
  and o_claim_status.column_name = 'claim_status'

left join public.manual_overrides o_claim_needed
  on o_claim_needed.scope = 'appointment'
  and o_claim_needed.record_id = a.id
  and o_claim_needed.column_name = 'claim_needed'

left join public.manual_overrides o_appt_status
  on o_appt_status.scope = 'appointment'
  and o_appt_status.record_id = a.id
  and o_appt_status.column_name = 'appt_status'

left join public.manual_overrides o_notes
  on o_notes.scope = 'appointment'
  and o_notes.record_id = a.id
  and o_notes.column_name = 'notes'

left join public.manual_overrides o_test_data
  on o_test_data.scope = 'appointment'
  and o_test_data.record_id = a.id
  and o_test_data.column_name = 'is_test_data'

left join public.manual_overrides o_provider_paid_cents
  on o_provider_paid_cents.scope = 'appointment'
  and o_provider_paid_cents.record_id = a.id
  and o_provider_paid_cents.column_name = 'provider_paid_cents'

left join public.manual_overrides o_provider_paid_date
  on o_provider_paid_date.scope = 'appointment'
  and o_provider_paid_date.record_id = a.id
  and o_provider_paid_date.column_name = 'provider_paid_date'

left join public.manual_overrides o_reimbursement_cents
  on o_reimbursement_cents.scope = 'appointment'
  and o_reimbursement_cents.record_id = a.id
  and o_reimbursement_cents.column_name = 'reimbursement_cents'

-- Fee schedule lookup
left join lateral (
  select fsl.allowed_cents
  from public.fee_schedule_lines fsl
  where fsl.payer_id = a.payer_id
    and fsl.cpt = s.default_cpt
    and (fsl.effective_to is null or a.start_time::date <= fsl.effective_to)
    and a.start_time::date >= fsl.effective_from
  order by fsl.effective_from desc
  limit 1
) fs on true

-- Provider earnings
left join public.provider_earnings pe_expected
  on pe_expected.appointment_id = a.id
  and pe_expected.provider_id = a.provider_id
  and pe_expected.basis = 'EXPECTED'

left join public.provider_earnings pe_actual
  on pe_actual.appointment_id = a.id
  and pe_actual.provider_id = a.provider_id
  and pe_actual.basis = 'ACTUAL'

-- Claims
left join public.finance_claims ec on ec.appointment_id = a.id

-- Remittances summary
left join lateral (
  select
    coalesce(sum(r.payment_cents), 0) as total_paid_cents,
    coalesce(sum(r.adjustment_cents), 0) as total_adjustment_cents,
    count(r.id) as payment_count
  from public.finance_remittances r
  where r.claim_id = ec.id
) er on ec.id is not null

-- Posted provider pay
left join public.provider_pay_run_lines ppl
  on ppl.appointment_id = a.id
  and ppl.provider_id = a.provider_id

left join public.provider_pay_runs pr
  on pr.id = ppl.run_id
  and pr.status = 'POSTED';

-- Add comments
COMMENT ON VIEW public.v_appointments_grid IS 'Finance appointments grid with trimmed service names';

-- Grant permissions
GRANT SELECT ON public.v_appointments_grid TO authenticated;

-- Recreate dependent views
DROP VIEW IF EXISTS public.v_provider_pay_summary;

CREATE OR REPLACE VIEW public.v_provider_pay_summary AS
SELECT
  provider_id,
  practitioner,
  COUNT(*) FILTER (WHERE provider_pay_status = 'REIMBURSED_UNPAID') as reimbursed_unpaid_count,
  COALESCE(SUM(provider_expected_pay_cents) FILTER (WHERE provider_pay_status = 'REIMBURSED_UNPAID'), 0) as earned_cents,
  COALESCE(SUM(provider_paid_cents) FILTER (WHERE provider_pay_status = 'PAID'), 0) as paid_cents,
  COALESCE(SUM(provider_expected_pay_cents) FILTER (WHERE provider_pay_status = 'REIMBURSED_UNPAID'), 0) as balance_owed_cents
FROM public.v_appointments_grid
WHERE is_test_data = false
GROUP BY provider_id, practitioner
HAVING COALESCE(SUM(provider_expected_pay_cents) FILTER (WHERE provider_pay_status = 'REIMBURSED_UNPAID'), 0) > 0;

GRANT SELECT ON public.v_provider_pay_summary TO authenticated;

SELECT '✅ Migration 063: Fixed service names by trimming leading/trailing spaces' AS status;
