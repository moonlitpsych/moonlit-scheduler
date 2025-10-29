# Moonlit Admin Finance — Appointments MVP

**Complete finance management system for appointment tracking, revenue recognition, and provider compensation.**

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Admin UI](#admin-ui)
- [Workflows](#workflows)
- [Deployment](#deployment)
- [Testing](#testing)
- [Future Enhancements](#future-enhancements)

---

## Overview

The Moonlit Finance system provides:

✅ **CSV Upload & Ingestion** — Import appointments and ERA (payment) data with idempotency
✅ **Automated Calculations** — Deterministic provider earnings based on fee schedules and pay rules
✅ **Manual Overrides** — Edit key fields with full audit trail
✅ **Provenance Tracking** — Every dollar has a traceable calculation source
✅ **Provider Pay Management** — Track compensation by period with export capabilities
✅ **Revenue Reporting** — Expected vs actual revenue tracking

### Tech Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** Supabase Postgres 15
- **Auth:** Supabase Auth with RLS
- **CSV:** csv-parse library

---

## Architecture

### Data Flow

```
CSV Upload → Parse & Hash → Ingest Table → Upsert Appointments
                ↓
          Match Entities (Provider, Service, Payer)
                ↓
          Calculate Earnings (sp_recompute_provider_earnings)
                ↓
          Display in Grid View (v_appointments_grid)
```

### Key Design Principles

1. **Idempotency** — File hashing prevents duplicate imports
2. **Determinism** — Same inputs always produce same calculations
3. **Audit Trail** — Every calculation stored with full provenance
4. **Flexibility** — Manual overrides for exceptions without breaking automation
5. **Row-Level Security** — Admin-only writes, finance role can read

---

## Database Schema

### Core Tables

#### `appointment_ingests`
Raw CSV import tracking with idempotency
```sql
- source_filename, source_hash, row_index
- raw (jsonb), external_appt_id, appt_date
- service_name, practitioner_name, patient_last_name
- payer_name, revenue_type, price_cents
- unique(source_hash, row_index)
```

#### `fee_schedule_lines`
CPT-level allowed amounts by payer
```sql
- payer_id, plan_code, cpt, modifiers, pos, units
- allowed_cents
- effective_from, effective_to (date range)
```

#### `provider_pay_rules`
Compensation rules with specificity matching
```sql
- provider_id, basis (EXPECTED/ACTUAL)
- percent (0.330 = 33%), flat_cents
- applies_service_id, applies_payer_id (optional filters)
- priority (lower = higher precedence)
- effective_from, effective_to
```

#### `provider_earnings`
Calculated compensation snapshot
```sql
- appointment_id, provider_id, basis
- amount_cents, calc_source (jsonb with full provenance)
- locked (prevents recalculation)
- unique(appointment_id, provider_id, basis)
```

#### `manual_overrides`
Field overrides with audit trail
```sql
- scope ('appointment'), record_id, column_name
- value (jsonb), reason
- changed_by, changed_at
- unique(scope, record_id, column_name)
```

### Claims & Payments

#### `extracted_claims`
Claims from 837 files or manual entry
```sql
- appointment_id, claim_control_number
- member_id, dos, provider_npi
- billed_amount_cents, status, denial_reason
```

#### `extracted_remittances`
Payments from ERA (835) files
```sql
- claim_id, payment_cents, adjustment_cents
- remark_codes, check_number, payment_date
- payer_id
```

### Pay Runs

#### `provider_pay_periods`
Payroll periods (biweekly/monthly)
```sql
- period_start, period_end
- status (OPEN/LOCKED)
```

#### `provider_pay_runs`
Payroll batches
```sql
- period_id, status (DRAFT/POSTED/VOID)
- posted_by, posted_at, total_cents
```

#### `provider_pay_run_lines`
Individual pay items
```sql
- run_id, appointment_id, provider_id
- amount_cents, notes
```

### Views

#### `v_appointments_grid`
Unified finance grid matching spreadsheet columns
- Core appointment data
- Expected gross (from fee schedule)
- Provider expected/actual pay
- Posted pay (from pay runs)
- Claim status and reimbursements
- Manual overrides
- Calculated net amounts

#### `v_provider_pay_summary`
Aggregated provider compensation
- Total appointments, expected pay, paid amounts
- Pending vs paid counts

#### `v_revenue_summary`
Daily revenue by payer type
- Expected vs actual revenue
- Net amounts after provider pay

---

## API Endpoints

### Upload Endpoints

#### `POST /api/finance/upload/appointments`
Upload appointment CSV with automatic earnings calculation

**CSV Columns:**
- `Date` — Appointment date (YYYY-MM-DD or MM/DD/YYYY)
- `Service` — Service name
- `Practitioner` — Provider full name
- `Patient_Last` — Patient last name
- `Payer` — Payer name (optional)
- `Revenue_Type` — Cash/Medicaid/Commercial
- `Price` — Dollar amount
- `External_ID` — IntakeQ ID (optional)

**Response:**
```json
{
  "success": true,
  "message": "Processed 100 rows",
  "file_hash": "sha256...",
  "results": {
    "total": 100,
    "ingested": 100,
    "appointments_created": 95,
    "appointments_updated": 5,
    "errors": []
  }
}
```

#### `POST /api/finance/upload/era`
Upload ERA (835) payment CSV

**CSV Columns:**
- `Claim_Control_Number` — Unique claim ID
- `Member_ID` — Insurance member ID
- `DOS` — Date of service
- `Provider_NPI` — Provider NPI
- `Payment_Amount` — Dollar amount paid
- `Adjustment_Amount` — Adjustment (optional)
- `Check_Number` — Check/EFT number (optional)
- `Payment_Date` — Payment date (optional)
- `Payer_Name` — Payer name for matching (optional)

### Query Endpoints

#### `GET /api/finance/appointments`
Fetch appointments grid with filters

**Query Params:**
- `from`, `to` — Date range (YYYY-MM-DD)
- `provider_id`, `payer_id` — Filter by ID
- `status` — Appointment status
- `limit`, `offset` — Pagination

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 1000,
    "limit": 100,
    "offset": 0,
    "has_more": true
  }
}
```

#### `POST /api/finance/appointments` (recompute)
Recompute provider earnings for date range

**Body:**
```json
{
  "from": "2025-10-01",
  "to": "2025-10-31"
}
```

### Override Endpoints

#### `PATCH /api/finance/appointments/[id]/override`
Update manual override

**Body:**
```json
{
  "column_name": "patient_paid",
  "value": 25.00,
  "reason": "Patient made copay",
  "changed_by": "admin_user_id"
}
```

**Allowed columns:**
- `patient_paid`, `patient_paid_date`
- `discount_reason`
- `claim_needed`, `claim_status`
- `appt_status`, `notes`

#### `DELETE /api/finance/appointments/[id]/override`
Remove override

**Query Params:**
- `column_name` — Field to clear

---

## Admin UI

### Pages

#### `/admin/finance/appointments`
Main finance grid page

**Features:**
- Date range filters
- Search by practitioner, patient, payer
- Summary cards (Revenue, Expected Gross, Provider Pay, Net)
- Sortable table with all spreadsheet columns
- Click row to open detail drawer
- Upload Appointments/ERA buttons
- Export to CSV
- Recompute earnings

**Table Columns:**
- Date, Service, Practitioner, Patient, Payer, Rev Type
- Expected Gross, Provider Pay, Pay Status
- Claim Status, Reimbursement, Actual Net

#### `/admin/finance/provider-pay`
Provider compensation management

**Features:**
- Pay period selector (biweekly/monthly)
- Provider summary table
- Total calculations
- Export pay stubs to CSV
- Future: Create/post pay runs

**Table Columns:**
- Provider, Title, Appointments
- Total Expected Pay, Already Paid, Pending Amount
- Paid/Pending counts

### Components

#### `AppointmentDetailDrawer`
Side drawer showing full appointment details

**Sections:**
- Core Information (practitioner, service, patient, payer)
- Financial Summary (expected/actual amounts, pay status)
- Calculation Provenance (JSON with rule details)
- Manual Overrides (editable fields)

#### `FileUploadModal`
CSV upload interface with format guide

**Features:**
- Drag & drop or click to upload
- CSV column reference
- Progress indicator
- Results display with error details
- Duplicate detection

---

## Workflows

### 1. Appointment CSV Import

```
1. Admin uploads CSV via UI
2. System calculates SHA256 hash
3. Check if file already processed (idempotency)
4. Parse CSV rows
5. For each row:
   a. Insert into appointment_ingests (raw data)
   b. Match provider by name
   c. Match service by name
   d. Match payer by name (optional)
   e. Upsert appointment (or skip if external ID exists)
   f. Call sp_recompute_provider_earnings(appointment_id)
6. Return summary report
```

### 2. ERA Payment Import

```
1. Admin uploads ERA CSV via UI
2. Parse payment records
3. For each payment:
   a. Match claim by control number
   b. If no claim, try to match appointment by (NPI, DOS, Member ID)
   c. Create claim if needed
   d. Insert remittance record
   e. Recompute affected appointment earnings
4. Return summary report
```

### 3. Provider Earnings Calculation

**Deterministic Algorithm** (`sp_recompute_provider_earnings`):

```sql
1. Lookup allowed amount from fee_schedule_lines
   - Match by: payer_id, cpt, effective date
   - Priority: plan+pos > plan > pos > general
   - Fallback: service.price if no fee schedule

2. Lookup paid amount from extracted_remittances
   - Sum all payments for this appointment's claims

3. Find applicable provider_pay_rule
   - Match by: provider_id, service_id, payer_id, effective date
   - Priority: lowest priority number wins
   - Specificity: service+payer > service > payer > general

4. Calculate earnings:
   EXPECTED = (percent × allowed) + flat_cents
   ACTUAL = (percent × paid) + flat_cents

5. Upsert provider_earnings (both EXPECTED and ACTUAL)
   - Store calc_source JSON with full provenance
   - Only update if not locked
```

### 4. Manual Override

```
1. Admin opens appointment detail drawer
2. Click "Edit" on Manual Overrides section
3. Modify fields (patient paid, discount, claim status, etc.)
4. Click "Save All Changes"
5. System creates/updates manual_overrides record
6. Changed values appear in v_appointments_grid view
7. Original values remain in appointments table
```

### 5. Provider Pay Run (Future)

```
1. Select pay period (e.g., Oct 1-15)
2. Review provider summary table
3. Click "Create Draft Run"
   → Creates provider_pay_run (status=DRAFT)
   → Copies all PENDING appointments to provider_pay_run_lines
4. Review draft, make adjustments if needed
5. Click "Post Run"
   → Updates provider_pay_run (status=POSTED, posted_at=now())
   → Updates provider_earnings (locked=true)
   → Sets provider_pay_status=PAID in grid view
6. Export pay stubs CSV for payroll
```

---

## Deployment

### 1. Run Migrations

```bash
# In Supabase SQL Editor or via migration tool:

# Core tables and RLS
psql -f database-migrations/041-create-finance-tables.sql

# Calculation engine
psql -f database-migrations/042-provider-earnings-calc-engine.sql

# Grid view
psql -f database-migrations/043-create-appointments-grid-view.sql

# Seed data (optional, for testing)
psql -f database-migrations/044-seed-finance-test-data.sql
```

### 2. Verify Tables

```sql
-- Check all tables exist
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'appointment_ingests',
    'fee_schedule_lines',
    'provider_pay_rules',
    'provider_earnings',
    'extracted_claims',
    'extracted_remittances',
    'provider_pay_periods',
    'provider_pay_runs',
    'provider_pay_run_lines',
    'manual_overrides',
    'patients'
  );

-- Check view exists
select * from v_appointments_grid limit 1;

-- Check stored procedure
select sp_recompute_provider_earnings('some-uuid-here');
```

### 3. Configure RLS

Ensure JWT contains `role` claim:
- `admin` — Full read/write access
- `finance` — Read-only access

### 4. Add Navigation Links

Update `/src/app/admin/layout.tsx` or navigation component:

```tsx
<nav>
  <Link href="/admin/finance/appointments">Finance — Appointments</Link>
  <Link href="/admin/finance/provider-pay">Finance — Provider Pay</Link>
</nav>
```

---

## Testing

### Manual Testing Checklist

#### CSV Upload
- [ ] Upload appointments CSV (new file)
- [ ] Upload same file again (should detect duplicate)
- [ ] Upload ERA CSV with matching claims
- [ ] Verify earnings automatically recalculate

#### Grid View
- [ ] Filter by date range
- [ ] Search by practitioner/patient/payer
- [ ] Click row to open detail drawer
- [ ] Verify summary cards match totals

#### Manual Overrides
- [ ] Edit patient paid amount
- [ ] Edit discount reason
- [ ] Override claim status
- [ ] Add notes
- [ ] Save and verify changes persist

#### Provider Pay
- [ ] Select current pay period
- [ ] Verify provider totals match appointments grid
- [ ] Export pay stubs CSV
- [ ] Verify CSV contains correct data

#### Calculations
- [ ] Create fee schedule line for payer
- [ ] Create provider pay rule
- [ ] Upload appointment matching payer
- [ ] Verify expected pay calculated correctly
- [ ] Upload ERA payment
- [ ] Verify actual pay calculated correctly

### Automated Testing (Future)

```typescript
// Example test
describe('Provider Earnings Calculation', () => {
  it('calculates 33% of allowed amount', async () => {
    // Given: Fee schedule with $100 allowed
    // And: Provider rule at 33%
    // When: Appointment created
    // Then: Expected pay = $33
  })

  it('is deterministic on repeated runs', async () => {
    // Run calculation twice
    // Verify same result
  })
})
```

---

## Future Enhancements

### Phase 2: Advanced Features

#### Pay Run Creation & Posting
- [ ] UI to create draft pay runs
- [ ] Review and adjustment interface
- [ ] Posting workflow (locks earnings)
- [ ] Void/reversal capability

#### Bank Reconciliation
- [ ] Upload bank transaction CSV
- [ ] Match payments to remittances
- [ ] Flag unmatched items
- [ ] Reconciliation reports

#### Advanced Reporting
- [ ] Revenue by service type
- [ ] Provider productivity metrics
- [ ] Payer performance analysis
- [ ] Aging reports (claims pending)

#### Workflow Automation
- [ ] Auto-submit claims to payers
- [ ] Auto-match payments to claims
- [ ] Alerts for anomalies
- [ ] Scheduled reports via email

#### Audit & Compliance
- [ ] Audit log viewer page
- [ ] Override history per appointment
- [ ] Compliance reports
- [ ] Role-based access controls

### Phase 3: Integrations

#### Direct Payer APIs
- [ ] Real-time eligibility checks
- [ ] Electronic claims submission (EDI 837)
- [ ] Automated ERA download (EDI 835)

#### Accounting Software
- [ ] QuickBooks sync
- [ ] Xero integration
- [ ] Export to accounting format

#### Payroll Systems
- [ ] Direct deposit integration
- [ ] Tax calculation
- [ ] 1099 generation

---

## Troubleshooting

### Common Issues

#### "No fee schedule found"
**Problem:** Provider earnings show $0
**Solution:** Add fee_schedule_lines for the payer/CPT combination

```sql
insert into fee_schedule_lines (payer_id, cpt, allowed_cents, effective_from)
values ('payer-uuid', '99213', 9500, '2025-01-01');
```

#### "No provider pay rule found"
**Problem:** Expected pay is $0
**Solution:** Add provider_pay_rules

```sql
insert into provider_pay_rules (provider_id, basis, percent, effective_from)
values ('provider-uuid', 'ACTUAL', 0.330, '2025-01-01');
```

#### "Duplicate file detected"
**Problem:** Can't re-import after fixing data
**Solution:** Either modify file content (changes hash) or manually delete from appointment_ingests

```sql
delete from appointment_ingests where source_hash = 'sha256-hash-here';
```

#### "RLS policy violation"
**Problem:** 403 errors on API calls
**Solution:** Ensure JWT contains `role` claim (`admin` or `finance`)

---

## Support

For questions or issues:

1. Check this README
2. Review migration files for schema details
3. Check API endpoint comments for usage
4. Review stored procedure comments for calculation logic
5. Contact Moonlit engineering team

---

**Built with ❤️ by Claude Code for Moonlit Health**
Last Updated: October 29, 2025
