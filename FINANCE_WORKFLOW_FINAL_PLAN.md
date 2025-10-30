# Finance Workflow - Final Implementation Plan

## The Real Bottleneck (Now I Get It!)

### What Actually Takes Your Time:

1. **Insurance payment arrives** → UT Medicaid: $1,280.96
2. **Walk into Office Ally** → Check claims by date range to see which appointments were paid
3. **Manually calculate** → "Dr. Norseth earned $X from these reimbursed appointments"
4. **Manually calculate** → "I've already paid him $Y, so I owe him $Z more"
5. **Send ACH** → Pay provider the balance
6. **Update tracking** → Record payment date and amount

**This takes 30-40 minutes per week**

---

## Payment Model (Critical Understanding)

**You ONLY pay providers after reimbursement is received**

```
Appointment rendered (Jan 15)
   ↓ [Submit claim]
Insurance pays (Jan 30)
   ↓ [Now provider gets paid]
Provider payment (Feb 1)
```

**NOT:**
```
Appointment rendered → Pay provider immediately ❌
```

**This means:**
- Provider earnings are CONTINGENT on reimbursement
- You need to track: "Which appointments have been reimbursed?"
- You need to calculate: "How much do I owe each provider for reimbursed appointments?"

---

## Provider Pay Structure

**Flat rate per service:**
- Intake (~60min) → ~$190
- Follow-up Short (~30min) → ~$95
- Follow-up Extended (~60min) → ~$190

**Lump payments:**
- Dr. Norseth $285 = Multiple appointments (e.g., 1 intake + 1 short follow-up)

**Storage:**
```sql
-- Already in your database!
provider_expected_pay_cents  -- Calculated by stored procedure
provider_paid_cents         -- Manual entry (what you've actually paid)
provider_paid_date          -- When you sent ACH
provider_pay_status         -- 'PENDING' | 'READY' | 'PAID'
```

---

## The Workflow We Need to Build

### **Core Feature: Reimbursement → Provider Pay Pipeline**

#### Step 1: Link Insurance Deposits to Appointments

**UI Flow:**
1. Upload Mercury CSV
2. System finds insurance deposits (UT Medicaid, DMBA, etc.)
3. You click "UT Medicaid $1,280.96 (Oct 15)"
4. System shows: "Appointments from Oct 1-15 with Utah Medicaid payer"
5. You bulk-select the appointments this deposit covers
6. Click "Mark as Reimbursed"
7. System updates:
   - `reimbursement_cents` on each appointment
   - `claim_status` → "Paid"
   - `revenue_status` → "Deposited"

**Result:** Now you know which appointments have been reimbursed

---

#### Step 2: Calculate Provider Balances

**UI Flow:**
1. Go to "Provider Pay" page
2. System shows table:

| Provider | Reimbursed Appointments | Earned | Already Paid | Balance Owed |
|----------|-------------------------|--------|--------------|--------------|
| Dr. Norseth | 12 | $2,280 | $1,900 | **$380** |
| Dr. Privratsky | 8 | $1,520 | $1,000 | **$520** |

**Calculation:**
```sql
-- Earned = Sum of provider_expected_pay_cents for reimbursed appointments
SELECT
  provider_id,
  SUM(provider_expected_pay_cents) as earned_cents
FROM v_appointments_grid
WHERE reimbursement_cents IS NOT NULL  -- Only reimbursed appointments
  AND provider_paid_cents IS NULL      -- Not yet paid to provider
GROUP BY provider_id
```

**Result:** You instantly see who to pay and how much

---

#### Step 3: Record Provider Payments

**UI Flow:**
1. Click "Pay Dr. Norseth $380"
2. Modal opens:
   - Shows list of 12 appointments included
   - Input: Payment date (today)
   - Input: Payment method (ACH)
   - Input: Confirmation # (Mercury transaction ID)
3. Click "Record Payment"
4. System updates:
   - `provider_paid_cents` on each appointment
   - `provider_paid_date` on each appointment
   - `provider_pay_status` → "PAID"
5. System creates `provider_payments` record for your books

**Result:** Eliminates manual tracking, automatic balance calculation

---

## Implementation Phases

### **Phase 1: Reimbursement Tracking** (Week 1-2) ⭐ **START HERE**
**Saves 20min/week**

**What we'll build:**
1. Upload Mercury CSV → Parse bank transactions
2. "Link Deposit to Appointments" UI
3. Bulk-select appointments covered by deposit
4. Mark as reimbursed → Updates `reimbursement_cents`

**Database:**
```sql
-- New table
create table bank_transactions (
  id uuid primary key,
  transaction_date date not null,
  description text not null,
  amount_cents int not null,
  source_account text,
  rev_type text,  -- Your Column R classification
  linked_appointments uuid[],  -- Which appointments this deposit covers
  raw_data jsonb,
  created_at timestamptz default now()
);

-- Link table
create table reimbursement_allocations (
  bank_transaction_id uuid references bank_transactions(id),
  appointment_id uuid references appointments(id),
  allocated_cents int not null,  -- How much of this deposit goes to this appointment
  primary key (bank_transaction_id, appointment_id)
);

-- Update appointments table (columns already exist!)
-- reimbursement_cents
-- claim_status
```

**UI Mockup:**
```
┌─────────────────────────────────────────────────────────────┐
│ Bank Deposit: UT Medicaid $1,280.96 (Oct 15, 2025)        │
├─────────────────────────────────────────────────────────────┤
│ Appointments (Utah Medicaid FFS, Oct 1-15):                │
│                                                             │
│ ☑ Oct 5  │ Dr. Norseth  │ Smith     │ 99214 │ $144.58    │
│ ☑ Oct 7  │ Dr. Norseth  │ Jones     │ 99205 │ $177.24    │
│ ☑ Oct 10 │ Dr. Norseth  │ Williams  │ 99214 │ $144.58    │
│ ...                                                         │
│ ☑ Oct 14 │ Dr. Norseth  │ Davis     │ 99214 │ $144.58    │
│                                                             │
│ Total Selected: $1,280.96 ✓ (matches deposit)              │
│                                                             │
│ [Mark as Reimbursed]  [Cancel]                             │
└─────────────────────────────────────────────────────────────┘
```

---

### **Phase 2: Provider Pay Dashboard** (Week 3-4)
**Saves 15min/week**

**What we'll build:**
1. Provider balances calculation (earned - paid)
2. "Pay Provider" workflow
3. Record payment → Updates appointments
4. Payment history view

**UI Mockup:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ Provider Compensation                                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Dr. Travis Norseth                                                  │
│   Reimbursed (unpaid): 12 appointments                              │
│   Earned:              $2,280.00                                    │
│   Already Paid:        $1,900.00                                    │
│   Balance Owed:        $380.00  [Pay Now]                           │
│                                                                     │
│ Dr. Anthony Privratsky                                              │
│   Reimbursed (unpaid): 8 appointments                               │
│   Earned:              $1,520.00                                    │
│   Already Paid:        $1,000.00                                    │
│   Balance Owed:        $520.00  [Pay Now]                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### **Phase 3: Office Ally Integration** (Week 5-6)
**Saves 20min/week** - Eliminates manual claim checking

**What we'll build:**
1. Connect to Office Ally API (check if already integrated elsewhere)
2. Auto-sync claim status
3. Auto-populate reimbursement amounts from remittance
4. Alert when claims are paid

**Office Ally API Endpoints:**
```typescript
// Check if these exist in your codebase already:
GET /api/officeally/claims?date_from=2025-10-01&date_to=2025-10-15
GET /api/officeally/remittance/:claim_id
```

**If Office Ally is already integrated:**
- Leverage existing connection
- Add reimbursement tracking on top

---

### **Phase 4: Revenue Projections** (Week 7-8)
**Future revenue visibility**

**What we'll build:**
1. Show future bookings with projected revenue
2. By payer: "You have $X in future SelectHealth appointments"
3. By provider: "Dr. Norseth will earn $X from upcoming appointments"
4. By month: "November projected revenue: $X"

**Calculation:**
```sql
SELECT
  payer_name,
  COUNT(*) as future_appointments,
  SUM(expected_gross_cents) as projected_revenue_cents
FROM v_appointments_grid
WHERE appt_date > CURRENT_DATE
  AND appointment_status != 'Cancelled'
GROUP BY payer_name
ORDER BY projected_revenue_cents DESC
```

**UI:**
```
┌─────────────────────────────────────────────────────────────┐
│ Revenue Projections (Next 30 Days)                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Utah Medicaid FFS       │ 25 appts │ $3,850.00             │
│ SelectHealth Integrated │ 18 appts │ $3,395.00             │
│ DMBA                    │ 12 appts │ $2,260.00             │
│ Cash                    │ 5 appts  │ $2,000.00             │
│                                                             │
│ Total Projected: $11,505.00                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Time Savings Breakdown

| Task | Current Time | After Automation | Savings |
|------|-------------|------------------|---------|
| Match deposits to appointments | 20min | 3min | 17min |
| Calculate provider balances | 15min | 0min | 15min |
| Track provider payments | 10min | 2min | 8min |
| Check Office Ally claims | 20min | 0min | 20min |
| Revenue projections | 10min | 0min | 10min |
| **Total** | **75min/week** | **5min/week** | **70min/week** |

**Annual Savings: 60 hours**

---

## Quick Win: Provider Pay Calculator (Can Build Today - 2 hours)

Even without full automation, we can add a "Provider Pay Summary" page RIGHT NOW:

**What it does:**
- Queries `v_appointments_grid` for reimbursed appointments
- Groups by provider
- Shows earned vs paid
- Calculates balance

**Query:**
```sql
SELECT
  provider_id,
  practitioner as provider_name,
  COUNT(*) as reimbursed_appointments,
  SUM(provider_expected_pay_cents) as earned_cents,
  SUM(COALESCE(provider_paid_cents, 0)) as paid_cents,
  SUM(provider_expected_pay_cents) - SUM(COALESCE(provider_paid_cents, 0)) as balance_owed_cents
FROM v_appointments_grid
WHERE reimbursement_cents IS NOT NULL  -- Only reimbursed
GROUP BY provider_id, practitioner
HAVING SUM(provider_expected_pay_cents) - SUM(COALESCE(provider_paid_cents, 0)) > 0  -- Only show if owed
ORDER BY balance_owed_cents DESC
```

**Add to your existing `/admin/finance/appointments` page as a summary card**

Would you like me to implement this quick win right now?

---

## Next Steps

### Immediate (This Week):
1. **Quick Win:** Build provider pay summary (2 hours)
2. **Phase 1 Design:** Review reimbursement linking UI mockup
3. **Office Ally Check:** Find existing Office Ally integration in codebase

### Week 1-2 (Phase 1):
1. Build `bank_transactions` table
2. Mercury CSV upload API
3. Reimbursement linking UI
4. Test with your last month of data

### Questions Before I Start:

1. **Office Ally API:** Do you know if there's already Office Ally integration code in the app? If so, where?

2. **Provider Rates:** Should I hardcode the rates (Intake=$190, Short=$95, Extended=$190) or make them configurable per provider?

3. **Quick Win Priority:** Should I build the Provider Pay Summary card right now (2 hours) before tackling Phase 1?

4. **Testing Data:** Can you share 1 month of Mercury CSV so I can test the upload/parsing with real data?

Ready to start?
