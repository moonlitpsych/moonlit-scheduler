# Finance Workflow Digitization Plan

## Executive Summary

**Goal:** Transform your 7-step weekly Google Sheets finance process into an integrated app workflow, eliminating manual CSV imports, formula management, and duplicate data entry across multiple tools.

**Current State:** Manual process across 4 tools (Google Sheets, PracticeQ, Stax, Mercury)
**Target State:** Single integrated finance dashboard with automated data flows

**Timeline:** 6-8 weeks (4 phases)
**High-Impact Quick Wins:** Phases 1-2 (eliminate 60% of manual work in 2-3 weeks)

---

## Current Workflow Analysis

### What You Do Now (Weekly)

| Step | Tool | Time | Pain Points |
|------|------|------|-------------|
| 1. Prep | Multiple logins | 5min | Context switching, tab management |
| 2. Appointments CSV | PracticeQ→Sheets | 10min | Manual export, paste, verify formulas |
| 3. Stax CSV | Stax→Sheets | 5min | Manual export, paste, verify formulas |
| 4. Bank CSV | Mercury→Sheets | 5min | Manual export, paste, verify formulas |
| 5. Reconciliation | Manual matching | **30min** | Tedious, error-prone, lag handling |
| 6. Sanity Check | Pivot refresh | 5min | Manual verification |
| 7. Provider Pay | Manual tracking | **20min** | Message sending, payment tracking |
| **TOTAL** | | **80min/week** | **52 steps, 3 tools, 4 CSVs** |

### What Slows You Down

1. **Data Silos:** Appointment data lives in app, but finance data lives in Google Sheets
2. **Manual Matching:** Reconciling Stax deposits to appointments by hand
3. **Formula Fragility:** `#VALUE!` errors when pasting CSV data
4. **Provider Messaging:** Copying payment info into messages manually
5. **Lag Detection:** Manually checking if deposits are 1-day late vs missing

---

## Existing App Infrastructure

### ✅ Already Built

| Feature | Status | Location |
|---------|--------|----------|
| Appointments table with payer | ✅ Complete | `appointments` table |
| Expected gross calculation | ✅ Complete | `v_appointments_grid.expected_gross_cents` |
| Provider pay calculation | ✅ Complete | `v_appointments_grid.provider_expected_pay_cents` |
| Finance appointments page | ✅ Complete | `/admin/finance/appointments` |
| Appointment detail drawer | ✅ Complete | Edit claim status, notes |
| Upload Appointments button | ✅ UI exists | Backend TBD |
| Upload ERA button | ✅ UI exists | Backend TBD |
| Export CSV | ✅ Complete | Downloads current grid |
| Recompute earnings | ✅ Complete | Calls stored procedure |

### ⚠️ Partially Built

| Feature | Current State | Missing |
|---------|---------------|---------|
| Provider pay status | Shows "PENDING" for all | No payment tracking |
| Reimbursement column | Shows "-" for all | No actual paid amounts |
| Actual net calculation | Shows $0 | No revenue data |
| Claim status | Shows generic status | No granular tracking |

### ❌ Not Yet Built

| Feature | Impact | Complexity |
|---------|--------|------------|
| Stax deposit import | HIGH | Medium |
| Deposit-to-appointment matching | HIGH | High |
| Provider payment tracking | HIGH | Medium |
| ERA file parsing | Medium | High |
| Provider pay statements | Medium | Medium |
| P&L dashboard | Medium | Low |

---

## Proposed Phases

### **Phase 1: Payment Reconciliation** (Week 1-2)
**Goal:** Eliminate manual Stax matching ➔ Saves 30min/week

#### Features to Build:

**1.1 Stax Deposit Import**
- Create `payment_transactions` table
- Upload Stax CSV via UI
- Parse columns: Date, Amount, Auth ID, Status
- Store raw transaction data

**1.2 Automatic Matching Algorithm**
```typescript
// Match logic:
// 1. Exact amount match on same day
// 2. Exact amount match within 1-day lag
// 3. Fuzzy match within $5 tolerance
// 4. Flag unmatched as "investigate"
```

**1.3 Reconciliation Dashboard**
- Show matched vs unmatched deposits
- Display lag status (OK, 1-day lag, missing)
- Allow manual override linking
- Flag discrepancies

**1.4 Revenue Status Column**
- Add `revenue_status` to appointments table
- Values: `pending`, `paid`, `lag_ok`, `investigate`
- Auto-populate from matching results
- Display on finance grid

**Database Schema:**
```sql
create table payment_transactions (
  id uuid primary key default uuid_generate_v4(),
  source text not null,  -- 'stax', 'stripe', 'manual'
  transaction_date date not null,
  settled_date date,
  amount_cents int not null,
  auth_id text,  -- Stax authorization ID
  description text,
  status text,  -- 'settled', 'pending', 'refunded'
  matched_appointment_id uuid references appointments(id),
  match_confidence text,  -- 'exact', 'lag_ok', 'fuzzy', 'manual'
  raw_data jsonb,  -- Original CSV row
  created_at timestamptz default now()
);

create index idx_payment_txn_date on payment_transactions(transaction_date);
create index idx_payment_auth_id on payment_transactions(auth_id);
create index idx_payment_matched_appt on payment_transactions(matched_appointment_id);
```

**UI Additions:**
- New tab: `/admin/finance/reconciliation`
- Upload button for Stax CSV
- Table: Unmatched transactions with "Link to Appointment" button
- Filter: Show only unmatched, show lag cases, show all

**Estimated Time:** 10-12 hours
**Impact:** Eliminates Steps 3, 5 ➔ Saves 35min/week

---

### **Phase 2: Provider Payment Tracking** (Week 3-4)
**Goal:** Track provider payments & generate statements ➔ Saves 20min/week

#### Features to Build:

**2.1 Provider Pay Configuration**
- Table: `provider_compensation_rates`
- Define base rate OR percentage split per provider
- Effective date ranges for rate changes
- Service-specific overrides (e.g., intake vs follow-up)

**2.2 Provider Payment Records**
- Table: `provider_payments`
- Record payment date, amount, method (ACH, check)
- Link to appointments (many-to-many via junction table)
- Track payment status: pending, ready, paid

**2.3 Payment Tracking UI**
- Mark appointments as "Ready to Pay"
- Bulk select appointments → "Create Payment Batch"
- Record payment: date, amount, method, confirmation #
- Automatically update `provider_pay_status`

**2.4 Provider Statements**
- Generate PDF/CSV statement per provider
- Show: Earned (expected pay), Paid (amount & date), Balance
- Include appointment details (date, patient, service, amount)
- Email directly to provider

**Database Schema:**
```sql
create table provider_compensation_rates (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid not null references providers(id),
  rate_type text not null,  -- 'percentage', 'fixed_per_service', 'hourly'
  rate_value numeric not null,  -- e.g., 0.60 for 60%, or 100.00 for $100
  service_id uuid references services(id),  -- NULL = applies to all services
  effective_from date not null,
  effective_to date,
  created_at timestamptz default now()
);

create table provider_payments (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid not null references providers(id),
  payment_date date not null,
  amount_cents int not null,
  payment_method text,  -- 'ach', 'check', 'wire'
  confirmation_number text,
  notes text,
  created_at timestamptz default now(),
  created_by text  -- admin user who recorded payment
);

create table provider_payment_appointments (
  payment_id uuid references provider_payments(id),
  appointment_id uuid references appointments(id),
  amount_cents int not null,  -- How much of this appointment was paid in this batch
  primary key (payment_id, appointment_id)
);
```

**UI Additions:**
- Checkbox column on finance grid for bulk selection
- "Mark as Ready" button → Sets status to READY
- "Create Payment" modal:
  - Auto-calculates total expected pay
  - Input: Payment date, method, confirmation #
  - Shows list of included appointments
- New page: `/admin/finance/provider-pay`
  - Table of providers with balances
  - "Generate Statement" button per provider
  - "Record Payment" button opens modal

**Estimated Time:** 12-15 hours
**Impact:** Eliminates Step 7 manual tracking ➔ Saves 20min/week

---

### **Phase 3: Claims & Reimbursement Tracking** (Week 5-6)
**Goal:** Track insurance claims from submission to payment ➔ Better cash flow visibility

#### Features to Build:

**3.1 ERA (835) File Import**
- Upload ERA files (X12 format)
- Parse remittance advice: Claim #, Paid Amount, Adjustments
- Match to appointments by claim ID or patient+date+amount
- Populate `reimbursement_cents` in appointments

**3.2 Claim Status Workflow**
- Add granular statuses: `not_submitted`, `submitted`, `adjudication`, `paid`, `denied`, `appeal`
- Track submission date, payer reference #
- Track payment date, check #, variance from expected
- Flag: Over/under paid, denied, needs follow-up

**3.3 Claims Dashboard**
- Filter appointments by claim status
- Aging report: Claims > 30 days in adjudication
- Denial tracking: Reason codes, appeal status
- Payment variance report: Expected vs actual

**Database Schema:**
```sql
create table insurance_claims (
  id uuid primary key default uuid_generate_v4(),
  appointment_id uuid not null references appointments(id),
  claim_number text unique not null,  -- Payer's claim reference
  payer_id uuid references payers(id),
  submitted_date date,
  submission_method text,  -- 'clearinghouse', 'portal', 'paper'
  adjudication_date date,
  payment_date date,
  check_number text,
  expected_reimbursement_cents int,
  actual_reimbursement_cents int,
  adjustment_reason_codes text[],
  status text not null default 'not_submitted',
  notes text,
  created_at timestamptz default now()
);

create table era_files (
  id uuid primary key default uuid_generate_v4(),
  filename text not null,
  uploaded_at timestamptz default now(),
  payer_name text,
  check_date date,
  check_amount_cents int,
  raw_content text,  -- Original X12 content
  parsed_data jsonb,  -- Parsed remittance details
  processed_at timestamptz
);
```

**UI Additions:**
- ERA upload modal with parsing preview
- Claim status dropdown on appointment detail drawer
- New page: `/admin/finance/claims`
  - Aging report table
  - Denial tracking section
  - Payment variance alerts

**Estimated Time:** 15-18 hours
**Impact:** Better cash flow forecasting, faster denial follow-up

---

### **Phase 4: P&L Dashboard** (Week 7-8)
**Goal:** Replace Google Sheets pivot with live dashboard ➔ Real-time financial visibility

#### Features to Build:

**4.1 Revenue Metrics**
- Total revenue (actual payments received)
- Expected gross (from fee schedules)
- Collection rate (actual / expected %)
- Revenue by payer, provider, service type

**4.2 Expense Tracking**
- Provider compensation (expected vs paid)
- Operating expenses (manual entry or import)
- Net income (revenue - provider pay - expenses)

**4.3 Time-Series Charts**
- Monthly revenue trend
- Provider compensation trend
- Payer mix distribution
- Service type distribution

**4.4 Sanity Checks**
- Compare Stax deposits total to calculated revenue
- Flag discrepancies > $100
- Show unmatched transactions count
- Alert if provider pay > revenue

**UI Additions:**
- New page: `/admin/finance/dashboard`
- Cards: Total Revenue, Total Provider Pay, Net Income, Outstanding Claims
- Charts: Revenue by Month, Payer Mix, Provider Earnings
- Alerts section: Unmatched deposits, payment variances, aging claims

**Estimated Time:** 10-12 hours
**Impact:** Eliminates Step 6 pivot refresh, real-time visibility

---

## Feature Prioritization Matrix

| Feature | Impact | Effort | Priority | Saves Time |
|---------|--------|--------|----------|------------|
| Stax deposit import | HIGH | Medium | P0 | 10min/week |
| Automatic matching | HIGH | High | P0 | 25min/week |
| Provider payment tracking | HIGH | Medium | P1 | 20min/week |
| Provider statements | Medium | Medium | P1 | 10min/week |
| Claim status tracking | Medium | Low | P2 | 5min/week |
| ERA file import | Medium | High | P3 | 5min/week |
| P&L dashboard | Medium | Low | P3 | 5min/week |

**P0 (Phase 1):** Critical path, highest ROI ➔ Saves 35min/week
**P1 (Phase 2):** High value, enables provider pay automation ➔ Saves 20min/week
**P2 (Phase 3):** Better cash flow management
**P3 (Phase 4):** Real-time visibility, nice-to-have

---

## Quick Wins (Can Build Today)

### 1. Inline Claim Status Editing (30min)
**What:** Add claim status dropdown to appointment detail drawer
**Impact:** Stop manually tracking in Google Sheets
**Code:**
```typescript
// In AppointmentDetailDrawer.tsx
const claimStatuses = ['Not Submitted', 'Submitted', 'Adjudication', 'Paid', 'Denied']

<select value={claimStatus} onChange={(e) => setClaimStatus(e.target.value)}>
  {claimStatuses.map(status => <option key={status}>{status}</option>)}
</select>
```

### 2. Co-Pay Tracking Field (30min)
**What:** Add patient co-pay amount & date fields
**Impact:** Track patient payments directly in app
**Schema:**
```sql
-- Already exists in appointments table!
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS patient_paid_cents int,
ADD COLUMN IF NOT EXISTS patient_paid_date date;
```

### 3. Discount/No-Show Tracking (30min)
**What:** Add discount note field to mark no-shows/cancellations
**Impact:** Calculate accurate provider pay (discounted appointments)
**Already exists:** `discount_note` field in appointments table

### 4. Export with Revenue Status (15min)
**What:** Add revenue status column to CSV export
**Impact:** Import into Google Sheets for legacy reporting during transition

---

## Data Migration Strategy

### Option A: Hybrid (Recommended)
- Keep Google Sheets for historical data (pre-2025)
- Use app for all 2025+ appointments
- One-time backfill of 2025 YTD data from Sheets

### Option B: Full Import
- Write script to import all historical data from Google Sheets
- Requires mapping: Sheet columns → App tables
- Risk: Data quality issues, formula dependencies

**Recommendation:** Start with Option A, migrate to Option B after 3 months of validation

---

## Training & Adoption Plan

### Week 1-2 (Phase 1 rollout):
1. Demo new Stax upload feature
2. Show automatic matching results
3. Compare app matched list vs your manual list
4. Fix any matching algorithm issues

### Week 3-4 (Phase 2 rollout):
1. Configure provider compensation rates
2. Record first payment batch in app
3. Generate first provider statement
4. Compare app statement vs your manual message

### Week 5-6 (Parallel operation):
- Continue using Google Sheets as backup
- Record all data in both systems
- Verify app calculations match your formulas

### Week 7+ (Full cutover):
- Stop updating Google Sheets
- Use app as primary finance tool
- Archive Google Sheet as historical reference

---

## Success Metrics

| Metric | Baseline | Target (3 months) |
|--------|----------|-------------------|
| Weekly finance time | 80min | **20min** (-75%) |
| Manual data entry steps | 52 steps | **5 steps** (-90%) |
| Tools used | 4 | **1** |
| CSV exports | 4 per week | **0** |
| Reconciliation errors | ~2 per month | **0** |
| Provider statement generation | 20min | **30sec** |

---

## Next Steps

### Immediate Actions (This Week):
1. **Review this plan** - Which phases are highest priority for you?
2. **Quick wins** - Implement 3 quick wins (2 hours total) to start building momentum
3. **Data audit** - Export sample CSVs from Stax, Mercury to finalize schema

### Phase 1 Kickoff (Next Week):
1. Build `payment_transactions` table
2. Implement Stax CSV upload API
3. Test matching algorithm with your last 2 weeks of data
4. Iterate on matching logic until 95%+ accuracy

### Questions for You:
1. **Stax CSV format:** Can you share a sample (redacted) Stax export so I can parse columns correctly?
2. **Provider pay logic:** Is it a flat percentage (e.g., 60% of revenue), or does it vary by provider/service?
3. **Mercury integration:** Would you prefer CSV upload or direct API integration (requires OAuth)?
4. **Claim tracking:** Do you want full ERA parsing or just manual entry of payment amounts?

---

## Appendix: Technical Architecture

### Data Flow Diagram
```
┌─────────────┐
│   Stax CSV  │
└──────┬──────┘
       │ Upload
       ▼
┌─────────────────────┐
│ payment_transactions│
└──────┬──────────────┘
       │ Matching Algorithm
       ▼
┌─────────────────────┐
│   appointments      │ ← revenue_status, reimbursement_cents
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ v_appointments_grid │ ← Powers finance page
└─────────────────────┘
```

### API Endpoints to Build

**Phase 1:**
- `POST /api/finance/upload/stax` - Upload Stax CSV
- `GET /api/finance/reconciliation` - List unmatched transactions
- `PATCH /api/finance/reconciliation/:txn_id/link` - Manual override linking

**Phase 2:**
- `POST /api/finance/provider-pay/rates` - Configure compensation rates
- `POST /api/finance/provider-pay/payments` - Record payment
- `GET /api/finance/provider-pay/statements/:provider_id` - Generate statement

**Phase 3:**
- `POST /api/finance/upload/era` - Upload ERA file
- `GET /api/finance/claims` - Claims dashboard data
- `PATCH /api/finance/claims/:claim_id` - Update claim status

**Phase 4:**
- `GET /api/finance/dashboard/metrics` - Summary metrics
- `GET /api/finance/dashboard/charts` - Time-series data

---

## Cost-Benefit Analysis

### Time Savings
- **Current:** 80min/week × 52 weeks = **69 hours/year**
- **After digitization:** 20min/week × 52 weeks = **17 hours/year**
- **Savings:** **52 hours/year** (1.3 work weeks)

### Development Cost
- **Phase 1:** 12 hours @ $150/hr = $1,800
- **Phase 2:** 15 hours @ $150/hr = $2,250
- **Phase 3:** 18 hours @ $150/hr = $2,700
- **Phase 4:** 12 hours @ $150/hr = $1,800
- **Total:** **57 hours = $8,550**

### ROI
- **Year 1:** 52 hours saved @ $100/hr (your time) = **$5,200 value**
- **Payback period:** ~1.6 years
- **Intangible benefits:** Fewer errors, better cash flow visibility, scalability

### Alternative: Hire VA
- **Cost:** $15/hr × 1.33hr/week × 52 weeks = **$1,040/year recurring**
- **Pros:** Lower upfront cost
- **Cons:** Still manual, error-prone, requires training, turnover risk

**Recommendation:** Build automation for long-term scalability and accuracy.
