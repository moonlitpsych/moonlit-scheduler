-- Migration 055: Create Financial Tracking Tables for Deposits and Bank Transactions
-- Purpose: Track Stax deposits and Mercury bank transactions with proper relationships
-- Date: 2025-10-30

-- ============================================================
-- SECTION 1: Create Deposit Tracking Tables
-- ============================================================

-- Table for tracking deposits from payment processors (Stax, Stripe, etc)
CREATE TABLE IF NOT EXISTS public.finance_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_date DATE NOT NULL,
  amount_cents INTEGER NOT NULL,
  processor TEXT NOT NULL, -- 'stax', 'stripe', 'square', etc
  processor_batch_id TEXT, -- External batch/deposit ID from processor
  bank_account TEXT, -- Which bank account received the deposit
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'reconciled', 'failed')),
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES auth.users(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}', -- For storing processor-specific data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for allocating deposits to specific appointments
CREATE TABLE IF NOT EXISTS public.deposit_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID NOT NULL REFERENCES public.finance_deposits(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  allocation_type TEXT DEFAULT 'payment' CHECK (allocation_type IN ('payment', 'refund', 'adjustment', 'fee')),
  processor_transaction_id TEXT, -- Individual transaction ID from processor
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- ============================================================
-- SECTION 2: Create Bank Transaction Table
-- ============================================================

-- Table for tracking bank transactions from Mercury or other banks
CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_date DATE NOT NULL,
  posted_date DATE,
  amount_cents INTEGER NOT NULL, -- Positive for deposits, negative for withdrawals
  description TEXT,
  category TEXT, -- 'revenue', 'provider_pay', 'expense', 'transfer', etc
  subcategory TEXT, -- More specific categorization
  bank_account TEXT NOT NULL,
  external_id TEXT UNIQUE, -- Bank's transaction ID
  deposit_id UUID REFERENCES public.finance_deposits(id), -- Link to deposit if applicable
  provider_pay_run_id UUID REFERENCES public.provider_pay_runs(id), -- Link to pay run if applicable
  expense_category TEXT, -- For expense tracking
  notes TEXT,
  metadata JSONB DEFAULT '{}', -- For storing bank-specific data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 3: Create Indexes for Performance
-- ============================================================

-- Deposit indexes
CREATE INDEX idx_deposits_date ON public.finance_deposits(deposit_date);
CREATE INDEX idx_deposits_processor ON public.finance_deposits(processor);
CREATE INDEX idx_deposits_status ON public.finance_deposits(status);
CREATE INDEX idx_deposits_bank_account ON public.finance_deposits(bank_account);

-- Allocation indexes
CREATE INDEX idx_deposit_allocations_deposit ON public.deposit_allocations(deposit_id);
CREATE INDEX idx_deposit_allocations_appointment ON public.deposit_allocations(appointment_id);
CREATE INDEX idx_deposit_allocations_type ON public.deposit_allocations(allocation_type);

-- Bank transaction indexes
CREATE INDEX idx_bank_trans_date ON public.bank_transactions(transaction_date);
CREATE INDEX idx_bank_trans_category ON public.bank_transactions(category);
CREATE INDEX idx_bank_trans_bank_account ON public.bank_transactions(bank_account);
CREATE INDEX idx_bank_trans_deposit ON public.bank_transactions(deposit_id);
CREATE INDEX idx_bank_trans_pay_run ON public.bank_transactions(provider_pay_run_id);

-- ============================================================
-- SECTION 4: Create Helper Views
-- ============================================================

-- View for unreconciled deposits
CREATE OR REPLACE VIEW public.v_unreconciled_deposits AS
SELECT
  d.id,
  d.deposit_date,
  d.amount_cents,
  d.processor,
  d.processor_batch_id,
  d.bank_account,
  d.status,
  d.notes,
  COALESCE(SUM(da.amount_cents), 0) as allocated_cents,
  d.amount_cents - COALESCE(SUM(da.amount_cents), 0) as unallocated_cents,
  COUNT(da.id) as allocation_count
FROM public.finance_deposits d
LEFT JOIN public.deposit_allocations da ON da.deposit_id = d.id
WHERE d.status IN ('pending', 'posted')
GROUP BY d.id, d.deposit_date, d.amount_cents, d.processor, d.processor_batch_id,
         d.bank_account, d.status, d.notes
HAVING d.amount_cents != COALESCE(SUM(da.amount_cents), 0)
ORDER BY d.deposit_date DESC;

-- View for reconciliation summary
CREATE OR REPLACE VIEW public.v_reconciliation_summary AS
WITH daily_summary AS (
  SELECT
    transaction_date as date,
    SUM(CASE WHEN category = 'revenue' THEN amount_cents ELSE 0 END) as revenue_cents,
    SUM(CASE WHEN category = 'provider_pay' THEN -amount_cents ELSE 0 END) as provider_pay_cents,
    SUM(CASE WHEN category = 'expense' THEN -amount_cents ELSE 0 END) as expense_cents,
    SUM(amount_cents) as net_cents,
    COUNT(*) as transaction_count
  FROM public.bank_transactions
  GROUP BY transaction_date
),
deposit_summary AS (
  SELECT
    deposit_date as date,
    SUM(amount_cents) as deposit_total_cents,
    COUNT(*) as deposit_count
  FROM public.finance_deposits
  WHERE status IN ('posted', 'reconciled')
  GROUP BY deposit_date
)
SELECT
  COALESCE(ds.date, dep.date) as date,
  COALESCE(ds.revenue_cents, 0) as bank_revenue_cents,
  COALESCE(dep.deposit_total_cents, 0) as deposit_total_cents,
  COALESCE(ds.revenue_cents, 0) - COALESCE(dep.deposit_total_cents, 0) as revenue_variance_cents,
  COALESCE(ds.provider_pay_cents, 0) as provider_pay_cents,
  COALESCE(ds.expense_cents, 0) as expense_cents,
  COALESCE(ds.net_cents, 0) as net_cents,
  ds.transaction_count,
  dep.deposit_count
FROM daily_summary ds
FULL OUTER JOIN deposit_summary dep ON ds.date = dep.date
ORDER BY date DESC;

-- ============================================================
-- SECTION 5: Create Import Tracking Table for CSV Uploads
-- ============================================================

CREATE TABLE IF NOT EXISTS public.csv_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type TEXT NOT NULL CHECK (import_type IN ('appointments', 'deposits', 'bank_transactions')),
  file_name TEXT NOT NULL,
  file_hash TEXT, -- SHA256 of file contents to prevent duplicate imports
  row_count INTEGER,
  matched_count INTEGER,
  created_count INTEGER,
  updated_count INTEGER,
  error_count INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_details JSONB,
  imported_by UUID REFERENCES auth.users(id),
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_csv_imports_type ON public.csv_imports(import_type);
CREATE INDEX idx_csv_imports_status ON public.csv_imports(status);
CREATE INDEX idx_csv_imports_hash ON public.csv_imports(file_hash);

-- ============================================================
-- SECTION 6: Grant Permissions
-- ============================================================

-- Grant select permissions to authenticated users (for viewing)
GRANT SELECT ON public.finance_deposits TO authenticated;
GRANT SELECT ON public.deposit_allocations TO authenticated;
GRANT SELECT ON public.bank_transactions TO authenticated;
GRANT SELECT ON public.v_unreconciled_deposits TO authenticated;
GRANT SELECT ON public.v_reconciliation_summary TO authenticated;
GRANT SELECT ON public.csv_imports TO authenticated;

-- Grant insert/update/delete to service role (for admin operations)
GRANT ALL ON public.finance_deposits TO service_role;
GRANT ALL ON public.deposit_allocations TO service_role;
GRANT ALL ON public.bank_transactions TO service_role;
GRANT ALL ON public.csv_imports TO service_role;

-- ============================================================
-- SECTION 7: Add Comments for Documentation
-- ============================================================

COMMENT ON TABLE public.finance_deposits IS 'Tracks deposits from payment processors like Stax, Stripe, etc';
COMMENT ON TABLE public.deposit_allocations IS 'Maps deposits to specific appointments for reconciliation';
COMMENT ON TABLE public.bank_transactions IS 'Tracks all bank transactions from Mercury or other banks';
COMMENT ON TABLE public.csv_imports IS 'Audit log of all CSV imports with success/error tracking';

COMMENT ON VIEW public.v_unreconciled_deposits IS 'Shows deposits that have not been fully allocated to appointments';
COMMENT ON VIEW public.v_reconciliation_summary IS 'Daily summary comparing bank transactions to processor deposits';