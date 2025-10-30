-- Migration 056: Create Provider Dashboard and Patient History Views
-- Purpose: Provide aggregated views for provider earnings and patient financial history
-- Date: 2025-10-30

-- ============================================================
-- SECTION 1: Provider Earnings Dashboard Views
-- ============================================================

-- Detailed provider earnings view with payment tracking
CREATE OR REPLACE VIEW public.v_provider_earnings_detail AS
WITH appointment_earnings AS (
  -- Get all appointments with earnings calculations
  SELECT
    a.id as appointment_id,
    a.start_time::date as appointment_date,
    a.provider_id,
    p.first_name || ' ' || p.last_name as provider_name,
    p.npi as provider_npi,
    a.patient_id,
    COALESCE(pt.last_name, a.patient_info->>'lastName') as patient_last_name,
    s.name as service_name,
    py.name as payer_name,
    py.payer_type as revenue_type,

    -- Financial amounts
    COALESCE(fs.allowed_cents, s.price, 0) as expected_gross_cents,
    COALESCE(pe_expected.amount_cents, 0) as provider_expected_cents,
    COALESCE(
      (o_provider_paid.value #>> '{v}')::numeric,
      ppl.amount_cents,
      0
    ) as provider_paid_cents,
    COALESCE(
      (o_provider_paid_date.value #>> '{v}')::date,
      pr.posted_at::date
    ) as provider_paid_date,
    COALESCE(
      (o_reimbursement.value #>> '{v}')::numeric,
      er.total_paid_cents,
      0
    ) as reimbursement_cents,

    -- Status fields
    a.status as appointment_status,
    COALESCE(
      (o_claim_status.value #>> '{v}'),
      ec.status,
      'not_needed'
    ) as claim_status,
    CASE
      WHEN pr.status = 'POSTED' THEN 'PAID'
      WHEN ppl.id IS NOT NULL AND pr.status = 'DRAFT' THEN 'READY'
      WHEN COALESCE(
        (o_reimbursement.value #>> '{v}')::numeric,
        er.total_paid_cents,
        0
      ) > 0 THEN 'REIMBURSED_UNPAID'
      ELSE 'PENDING'
    END as provider_pay_status

  FROM public.appointments a
  JOIN public.providers p ON p.id = a.provider_id
  JOIN public.service_instances si ON si.id = a.service_instance_id
  JOIN public.services s ON s.id = si.service_id
  LEFT JOIN public.patients pt ON pt.id = a.patient_id
  LEFT JOIN public.payers py ON py.id = a.payer_id

  -- Fee schedule
  LEFT JOIN LATERAL (
    SELECT fsl.allowed_cents
    FROM public.fee_schedule_lines fsl
    WHERE fsl.payer_id = a.payer_id
      AND fsl.cpt = s.default_cpt
      AND (fsl.effective_to IS NULL OR a.start_time::date <= fsl.effective_to)
      AND a.start_time::date >= fsl.effective_from
    ORDER BY fsl.effective_from DESC
    LIMIT 1
  ) fs ON true

  -- Provider earnings
  LEFT JOIN public.provider_earnings pe_expected
    ON pe_expected.appointment_id = a.id
    AND pe_expected.provider_id = a.provider_id
    AND pe_expected.basis = 'EXPECTED'

  -- Manual overrides
  LEFT JOIN public.manual_overrides o_provider_paid
    ON o_provider_paid.scope = 'appointment'
    AND o_provider_paid.record_id = a.id
    AND o_provider_paid.column_name = 'provider_paid_cents'

  LEFT JOIN public.manual_overrides o_provider_paid_date
    ON o_provider_paid_date.scope = 'appointment'
    AND o_provider_paid_date.record_id = a.id
    AND o_provider_paid_date.column_name = 'provider_paid_date'

  LEFT JOIN public.manual_overrides o_reimbursement
    ON o_reimbursement.scope = 'appointment'
    AND o_reimbursement.record_id = a.id
    AND o_reimbursement.column_name = 'reimbursement_cents'

  LEFT JOIN public.manual_overrides o_claim_status
    ON o_claim_status.scope = 'appointment'
    AND o_claim_status.record_id = a.id
    AND o_claim_status.column_name = 'claim_status'

  -- Claims and remittances
  LEFT JOIN public.finance_claims ec ON ec.appointment_id = a.id
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(r.payment_cents), 0) as total_paid_cents
    FROM public.finance_remittances r
    WHERE r.claim_id = ec.id
  ) er ON ec.id IS NOT NULL

  -- Provider pay runs
  LEFT JOIN public.provider_pay_run_lines ppl
    ON ppl.appointment_id = a.id
    AND ppl.provider_id = a.provider_id
  LEFT JOIN public.provider_pay_runs pr
    ON pr.id = ppl.run_id
    AND pr.status = 'POSTED'

  WHERE a.status NOT IN ('cancelled', 'no_show')
)
SELECT * FROM appointment_earnings
ORDER BY appointment_date DESC, provider_name;

-- Provider earnings summary by month
CREATE OR REPLACE VIEW public.v_provider_earnings_summary AS
SELECT
  provider_id,
  provider_name,
  DATE_TRUNC('month', appointment_date) as month,
  COUNT(*) as appointment_count,

  -- Gross amounts
  SUM(expected_gross_cents) as total_expected_gross_cents,
  SUM(reimbursement_cents) as total_reimbursement_cents,

  -- Provider earnings
  SUM(provider_expected_cents) as total_expected_earnings_cents,
  SUM(CASE WHEN provider_pay_status = 'PAID' THEN provider_paid_cents ELSE 0 END) as total_paid_cents,
  SUM(CASE WHEN provider_pay_status IN ('REIMBURSED_UNPAID', 'PENDING') THEN provider_expected_cents ELSE 0 END) as total_unpaid_cents,

  -- Status counts
  COUNT(*) FILTER (WHERE provider_pay_status = 'PAID') as paid_count,
  COUNT(*) FILTER (WHERE provider_pay_status = 'REIMBURSED_UNPAID') as reimbursed_unpaid_count,
  COUNT(*) FILTER (WHERE provider_pay_status = 'PENDING') as pending_count,

  -- Claim status breakdown
  COUNT(*) FILTER (WHERE claim_status = 'paid') as claims_paid,
  COUNT(*) FILTER (WHERE claim_status IN ('submitted', 'pending')) as claims_pending,
  COUNT(*) FILTER (WHERE claim_status IN ('denied', 'rejected')) as claims_denied

FROM public.v_provider_earnings_detail
GROUP BY provider_id, provider_name, DATE_TRUNC('month', appointment_date)
ORDER BY month DESC, provider_name;

-- Current provider balance (what we owe them)
CREATE OR REPLACE VIEW public.v_provider_current_balance AS
SELECT
  provider_id,
  provider_name,
  COUNT(*) as total_appointments,

  -- Totals
  SUM(provider_expected_cents) as lifetime_expected_cents,
  SUM(provider_paid_cents) as lifetime_paid_cents,

  -- Current balance (what we owe)
  SUM(
    CASE
      WHEN reimbursement_cents > 0 AND provider_pay_status != 'PAID'
      THEN provider_expected_cents
      ELSE 0
    END
  ) as current_balance_cents,

  -- Breakdown by status
  COUNT(*) FILTER (WHERE provider_pay_status = 'REIMBURSED_UNPAID') as reimbursed_unpaid_count,
  SUM(provider_expected_cents) FILTER (WHERE provider_pay_status = 'REIMBURSED_UNPAID') as reimbursed_unpaid_cents,

  -- Pending reimbursements (we haven't been paid yet)
  COUNT(*) FILTER (WHERE claim_status IN ('submitted', 'pending') AND provider_pay_status = 'PENDING') as pending_reimbursement_count,
  SUM(provider_expected_cents) FILTER (WHERE claim_status IN ('submitted', 'pending') AND provider_pay_status = 'PENDING') as pending_reimbursement_cents,

  -- Last payment info
  MAX(provider_paid_date) as last_payment_date,
  MAX(appointment_date) as last_appointment_date

FROM public.v_provider_earnings_detail
GROUP BY provider_id, provider_name
HAVING SUM(
  CASE
    WHEN reimbursement_cents > 0 AND provider_pay_status != 'PAID'
    THEN provider_expected_cents
    ELSE 0
  END
) > 0
ORDER BY current_balance_cents DESC;

-- ============================================================
-- SECTION 2: Patient Financial History Views
-- ============================================================

-- Complete patient financial history across all appointments
CREATE OR REPLACE VIEW public.v_patient_financial_history AS
WITH patient_appointments AS (
  SELECT
    COALESCE(pt.id, a.patient_id) as patient_id,
    COALESCE(pt.last_name, a.patient_info->>'lastName') as last_name,
    COALESCE(pt.first_name, a.patient_info->>'firstName') as first_name,
    COALESCE(pt.email, a.patient_info->>'email') as email,
    COALESCE(pt.phone, a.patient_info->>'phone') as phone,
    a.id as appointment_id,
    a.start_time::date as appointment_date,
    a.status as appointment_status,
    p.first_name || ' ' || p.last_name as provider_name,
    s.name as service_name,
    py.name as payer_name,
    py.payer_type as revenue_type,

    -- Financial data
    COALESCE(s.price, 0) as service_price_cents,
    COALESCE(
      (o_patient_paid.value #>> '{v}')::numeric,
      0
    ) as patient_paid_cents,
    COALESCE(
      (o_reimbursement.value #>> '{v}')::numeric,
      er.total_paid_cents,
      0
    ) as insurance_paid_cents,
    COALESCE(
      (o_claim_status.value #>> '{v}'),
      ec.status,
      'not_needed'
    ) as claim_status,

    -- Calculate patient responsibility
    CASE
      WHEN py.payer_type = 'Cash' THEN COALESCE(s.price, 0)
      WHEN py.payer_type IN ('Medicaid', 'Medicare') THEN 0  -- No patient responsibility
      ELSE GREATEST(0, COALESCE(s.price, 0) - COALESCE(fs.allowed_cents, 0))  -- Copay/deductible
    END as patient_responsibility_cents

  FROM public.appointments a
  LEFT JOIN public.patients pt ON pt.id = a.patient_id
  JOIN public.providers p ON p.id = a.provider_id
  JOIN public.service_instances si ON si.id = a.service_instance_id
  JOIN public.services s ON s.id = si.service_id
  LEFT JOIN public.payers py ON py.id = a.payer_id

  -- Fee schedule for insurance rates
  LEFT JOIN LATERAL (
    SELECT fsl.allowed_cents
    FROM public.fee_schedule_lines fsl
    WHERE fsl.payer_id = a.payer_id
      AND fsl.cpt = s.default_cpt
      AND (fsl.effective_to IS NULL OR a.start_time::date <= fsl.effective_to)
      AND a.start_time::date >= fsl.effective_from
    ORDER BY fsl.effective_from DESC
    LIMIT 1
  ) fs ON true

  -- Manual overrides
  LEFT JOIN public.manual_overrides o_patient_paid
    ON o_patient_paid.scope = 'appointment'
    AND o_patient_paid.record_id = a.id
    AND o_patient_paid.column_name = 'patient_paid'

  LEFT JOIN public.manual_overrides o_reimbursement
    ON o_reimbursement.scope = 'appointment'
    AND o_reimbursement.record_id = a.id
    AND o_reimbursement.column_name = 'reimbursement_cents'

  LEFT JOIN public.manual_overrides o_claim_status
    ON o_claim_status.scope = 'appointment'
    AND o_claim_status.record_id = a.id
    AND o_claim_status.column_name = 'claim_status'

  -- Claims and remittances
  LEFT JOIN public.finance_claims ec ON ec.appointment_id = a.id
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(r.payment_cents), 0) as total_paid_cents
    FROM public.finance_remittances r
    WHERE r.claim_id = ec.id
  ) er ON ec.id IS NOT NULL

  WHERE (pt.id IS NOT NULL OR a.patient_id IS NOT NULL)
)
SELECT
  patient_id,
  last_name,
  first_name,
  email,
  phone,
  appointment_id,
  appointment_date,
  appointment_status,
  provider_name,
  service_name,
  payer_name,
  revenue_type,
  service_price_cents,
  patient_paid_cents,
  insurance_paid_cents,
  patient_responsibility_cents,
  patient_responsibility_cents - patient_paid_cents as patient_balance_cents,
  claim_status
FROM patient_appointments
ORDER BY appointment_date DESC;

-- Patient financial summary
CREATE OR REPLACE VIEW public.v_patient_financial_summary AS
SELECT
  patient_id,
  last_name,
  first_name,
  email,
  COUNT(*) as total_appointments,
  COUNT(*) FILTER (WHERE appointment_status = 'confirmed') as completed_appointments,
  COUNT(*) FILTER (WHERE appointment_status = 'cancelled') as cancelled_appointments,
  COUNT(*) FILTER (WHERE appointment_status = 'no_show') as no_show_count,

  -- Financial totals
  SUM(service_price_cents) as total_service_value_cents,
  SUM(patient_paid_cents) as total_patient_paid_cents,
  SUM(insurance_paid_cents) as total_insurance_paid_cents,
  SUM(patient_responsibility_cents) as total_responsibility_cents,
  SUM(patient_responsibility_cents - patient_paid_cents) as total_balance_cents,

  -- Payer breakdown
  COUNT(DISTINCT payer_name) as payer_count,
  STRING_AGG(DISTINCT payer_name, ', ') as payers_used,

  -- Date ranges
  MIN(appointment_date) as first_appointment_date,
  MAX(appointment_date) as last_appointment_date,

  -- Provider relationships
  COUNT(DISTINCT provider_name) as provider_count,
  STRING_AGG(DISTINCT provider_name, ', ') as providers_seen

FROM public.v_patient_financial_history
GROUP BY patient_id, last_name, first_name, email
ORDER BY total_balance_cents DESC, last_appointment_date DESC;

-- ============================================================
-- SECTION 3: Data Quality Monitoring Views
-- ============================================================

-- Data quality dashboard
CREATE OR REPLACE VIEW public.v_data_quality_dashboard AS
WITH appointment_stats AS (
  SELECT
    COUNT(*) as total_appointments,
    COUNT(pq_appointment_id) as has_intakeq_id,
    COUNT(patient_id) as has_normalized_patient,
    COUNT(payer_id) as has_payer,
    COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
    COUNT(*) FILTER (WHERE provider_id IS NOT NULL) as has_provider
  FROM public.appointments
  WHERE created_at >= NOW() - INTERVAL '90 days'
),
financial_stats AS (
  SELECT
    COUNT(*) as total_with_claims,
    COUNT(*) FILTER (WHERE claim_status = 'paid') as claims_paid,
    COUNT(*) FILTER (WHERE claim_status IN ('submitted', 'pending')) as claims_pending,
    COUNT(*) FILTER (WHERE claim_status IN ('denied', 'rejected')) as claims_denied,
    COUNT(*) FILTER (WHERE reimbursement_cents > 0) as has_reimbursement,
    COUNT(*) FILTER (WHERE provider_paid_cents > 0) as provider_paid
  FROM public.v_appointments_grid
  WHERE appt_date >= CURRENT_DATE - INTERVAL '90 days'
    AND is_test_data = false
),
override_stats AS (
  SELECT
    COUNT(*) as total_overrides,
    COUNT(DISTINCT record_id) as appointments_with_overrides,
    COUNT(DISTINCT column_name) as unique_columns_overridden,
    COUNT(*) FILTER (WHERE column_name = 'provider_paid_cents') as provider_paid_overrides,
    COUNT(*) FILTER (WHERE column_name = 'claim_status') as claim_status_overrides,
    COUNT(*) FILTER (WHERE column_name = 'reimbursement_cents') as reimbursement_overrides
  FROM public.manual_overrides
  WHERE scope = 'appointment'
    AND created_at >= NOW() - INTERVAL '90 days'
)
SELECT
  -- Appointment completeness
  a.total_appointments,
  ROUND(100.0 * a.has_intakeq_id / NULLIF(a.total_appointments, 0), 1) as pct_with_intakeq,
  ROUND(100.0 * a.has_normalized_patient / NULLIF(a.total_appointments, 0), 1) as pct_normalized_patients,
  ROUND(100.0 * a.has_payer / NULLIF(a.total_appointments, 0), 1) as pct_with_payer,

  -- Financial completeness
  f.total_with_claims,
  ROUND(100.0 * f.claims_paid / NULLIF(f.total_with_claims, 0), 1) as pct_claims_paid,
  ROUND(100.0 * f.has_reimbursement / NULLIF(f.total_with_claims, 0), 1) as pct_reimbursed,
  ROUND(100.0 * f.provider_paid / NULLIF(f.total_with_claims, 0), 1) as pct_provider_paid,

  -- Override usage
  o.total_overrides,
  o.appointments_with_overrides,
  ROUND(100.0 * o.appointments_with_overrides / NULLIF(a.total_appointments, 0), 1) as pct_appointments_with_overrides,
  o.provider_paid_overrides,
  o.claim_status_overrides,
  o.reimbursement_overrides

FROM appointment_stats a
CROSS JOIN financial_stats f
CROSS JOIN override_stats o;

-- ============================================================
-- SECTION 4: Grant Permissions
-- ============================================================

GRANT SELECT ON public.v_provider_earnings_detail TO authenticated;
GRANT SELECT ON public.v_provider_earnings_summary TO authenticated;
GRANT SELECT ON public.v_provider_current_balance TO authenticated;
GRANT SELECT ON public.v_patient_financial_history TO authenticated;
GRANT SELECT ON public.v_patient_financial_summary TO authenticated;
GRANT SELECT ON public.v_data_quality_dashboard TO authenticated;

-- ============================================================
-- SECTION 5: Add Comments
-- ============================================================

COMMENT ON VIEW public.v_provider_earnings_detail IS 'Detailed provider earnings by appointment with payment tracking';
COMMENT ON VIEW public.v_provider_earnings_summary IS 'Monthly provider earnings summary with status breakdown';
COMMENT ON VIEW public.v_provider_current_balance IS 'Current balance owed to providers for reimbursed appointments';
COMMENT ON VIEW public.v_patient_financial_history IS 'Complete patient financial history across all appointments';
COMMENT ON VIEW public.v_patient_financial_summary IS 'Patient financial summary with totals and balances';
COMMENT ON VIEW public.v_data_quality_dashboard IS 'Data quality metrics for monitoring system health';