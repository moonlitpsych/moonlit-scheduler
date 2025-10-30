-- Migration 053: Add test data flag to appointments grid view
-- Purpose: Allow marking appointments as test data for filtering
-- Date: 2025-10-30

-- ============================================================
-- SECTION 1: Update v_appointments_grid view to include is_test_data
-- ============================================================

drop view if exists public.v_appointments_grid cascade;

create or replace view public.v_appointments_grid as
select
  -- Core identifiers
  a.id as appointment_id,
  a.start_time::date as appt_date,
  a.start_time,
  a.end_time,
  a.status as appointment_status,

  -- Service information
  s.name as service,
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

  -- Posted provider pay (from pay runs)
  ppl.amount_cents as provider_paid_cents,
  pr.posted_at::date as provider_paid_date,
  pr.status as provider_pay_run_status,
  case
    when pr.status = 'POSTED' then 'PAID'
    when ppl.id is not null and pr.status = 'DRAFT' then 'READY'
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

  -- Reimbursement from remittances
  er.total_paid_cents as reimbursement_cents,
  er.total_adjustment_cents as adjustment_cents,
  er.payment_count,

  -- Expected net (ExpectedGross - ProviderExpectedPay)
  greatest(
    coalesce(fs.allowed_cents, s.price, 0) - coalesce(pe_expected.amount_cents, 0),
    0
  ) as expected_net_cents,

  -- Actual net (Reimbursement - ProviderPaid)
  greatest(
    coalesce(er.total_paid_cents, 0) - coalesce(ppl.amount_cents, 0),
    0
  ) as actual_net_cents,

  -- Payment received status (for "Which appointments we have already been paid for")
  case
    when coalesce(er.total_paid_cents, 0) > 0 or coalesce((o_patient_paid.value #>> '{v}')::numeric, 0) > 0 then 'PAID'
    when coalesce(
      (o_claim_status.value #>> '{v}'),
      ec.status,
      'not_needed'
    ) in ('submitted', 'pending', 'accepted') then 'PENDING'
    else 'UNPAID'
  end as payment_received_status,

  -- Payment method (for "How we were paid – via claim, cash, or some other method")
  case
    when coalesce(er.total_paid_cents, 0) > 0 and coalesce((o_patient_paid.value #>> '{v}')::numeric, 0) > 0 then 'MIXED'
    when coalesce(er.total_paid_cents, 0) > 0 then 'CLAIM'
    when coalesce((o_patient_paid.value #>> '{v}')::numeric, 0) > 0 then 'CASH'
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

-- Manual overrides (one join per override type)
left join public.manual_overrides o_patient_paid
  on o_patient_paid.scope = 'appointment'
  and o_patient_paid.record_id = a.id
  and o_patient_paid.column_name = 'patient_paid'

left join public.manual_overrides o_patient_paid_date
  on o_patient_paid_date.scope = 'appointment'
  and o_patient_paid_date.record_id = a.id
  and o_patient_paid_date.column_name = 'patient_paid_date'

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

-- Fee schedule lookup (most recent effective rate)
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

-- Provider earnings (EXPECTED basis for preview)
left join public.provider_earnings pe_expected
  on pe_expected.appointment_id = a.id
  and pe_expected.provider_id = a.provider_id
  and pe_expected.basis = 'EXPECTED'

-- Provider earnings (ACTUAL basis)
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

-- Pay run (only show if POSTED)
left join public.provider_pay_runs pr
  on pr.id = ppl.run_id
  and pr.status = 'POSTED';

-- Add helpful comment
comment on view public.v_appointments_grid is 'Finance appointments grid view with all calculated fields and overrides';

-- ============================================================
-- SECTION 2: Grant permissions
-- ============================================================

grant select on public.v_appointments_grid to authenticated;

-- ============================================================
-- SECTION 3: Recreate dependent views
-- ============================================================

-- Provider pay summary view
create or replace view public.v_provider_pay_summary as
select
  provider_id,
  practitioner,
  count(*) filter (where reimbursement_cents is not null and provider_paid_cents is null) as reimbursed_unpaid_count,
  coalesce(sum(provider_expected_pay_cents) filter (where reimbursement_cents is not null), 0) as earned_cents,
  coalesce(sum(provider_paid_cents) filter (where reimbursement_cents is not null), 0) as paid_cents,
  coalesce(sum(provider_expected_pay_cents) filter (where reimbursement_cents is not null), 0) -
    coalesce(sum(provider_paid_cents) filter (where reimbursement_cents is not null), 0) as balance_owed_cents
from public.v_appointments_grid
where is_test_data = false  -- Exclude test data from provider pay calculations
group by provider_id, practitioner
having coalesce(sum(provider_expected_pay_cents) filter (where reimbursement_cents is not null), 0) -
       coalesce(sum(provider_paid_cents) filter (where reimbursement_cents is not null), 0) > 0;

grant select on public.v_provider_pay_summary to authenticated;
