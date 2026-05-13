# Finance Workflow Digitization Plan (REVISED)

## Critical Discovery: Your Revenue Flow

After reviewing your actual CSVs, I now understand the real workflow:

### **Revenue Sources (Not What I Initially Thought!)**

| Source | Amount | Frequency | Current Tracking |
|--------|--------|-----------|------------------|
| **Insurance ACH** (UT Medicaid, DMBA, etc.) | $199-$1,500 | Weekly | Manual classification in Mercury CSV |
| **Stax Copays** (via PracticeQ) | $10-$400 | Per appointment | Manual matching to Mercury deposits |
| **Total Revenue Split** | ~70% Insurance / 30% Stax | | |

**Key Insight:** Stax is NOT your primary revenue source - it's just copays/cash appointments. Most revenue comes directly from insurance payers via ACH to Mercury.

---

## Current Workflow Reality Check

### What You Actually Do (Not What I Thought):

**Step 1: Mercury CSV Import**
- Export bank transactions from Mercury
- Paste into Google Sheets "Transactions" tab
- **Manual Classification in Column R (RevType):**
  - "Revenue" → Insurance reimbursements + Stax deposits
  - "Software/office expense" → IntakeQ, Google, etc.
  - "Contract labor" → Provider payments
  - "Payment processing fees" → Stax fees
  - "Marketing and advertising" → Psychology Today, etc.
  - "Owner contribution" → Capital injections
  - "Professional fees" → Licensing, credentialing

**Step 2: Stax CSV Import (SMALL subset)**
- Export Stax deposits (copays only)
- Paste into "STAX_raw_report" tab
- Helper formulas create matching keys

**Step 3: Reconciliation (The Painful Part)**
- Match Stax auth IDs to Mercury "StaxPmtsMerchant" deposits
- Fill Column 25 (stax_auth) and Column 26 (RevStatus)
- Note lag status: "deposit lag – OK" or blank

**Step 4: Provider Pay Tracking**
- Review Contract labor transactions (Dr. Norseth, Dr. Privratsky)
- Cross-reference appointments to calculate earnings
- Send ACH payments via Mercury
- Update tracking manually

---

## Revised Digitization Plan

### **Phase 1: Mercury Transaction Classification** (Weeks 1-2)
**Saves 30min/week** - Eliminates manual Column R classification

#### What We'll Build:

**1.1 Bank Transaction Import**
```typescript
// New table: bank_transactions
create table bank_transactions (
  id uuid primary key,
  transaction_date date not null,
  description text not null,
  amount_cents int not null,  // Stored as cents
  status text,  // 'Sent', 'Pending', etc.
  source_account text,
  category text,  // Mercury's auto-category
  gl_code text,
  raw_data jsonb,

  // Our classification (the key!)
  rev_type text,  // 'Revenue', 'Software/office expense', etc.
  auto_classified boolean default false,
  classification_confidence text,  // 'high', 'medium', 'low'

  // For revenue transactions
  linked_appointment_id uuid references appointments(id),
  linked_payment_id uuid references provider_payments(id),

  created_at timestamptz default now()
);
```

**1.2 Auto-Classification Engine**

Use pattern matching on `description` field:

```typescript
const classificationRules = [
  // Revenue (Insurance Reimbursements)
  { pattern: /UT Medicaid/i, revType: 'Revenue', confidence: 'high' },
  { pattern: /DMBA/i, revType: 'Revenue', confidence: 'high' },
  { pattern: /SelectHealth/i, revType: 'Revenue', confidence: 'high' },
  { pattern: /Molina/i, revType: 'Revenue', confidence: 'high' },
  { pattern: /Travis Norseth.*Revenue/i, revType: 'Revenue', confidence: 'high' },

  // Revenue (Stax Copays)
  { pattern: /StaxPmtsMerchant.*(?!-)/i, revType: 'Revenue', confidence: 'high' },  // Positive amounts only

  // Expenses - Software
  { pattern: /Intakeq\.com/i, revType: 'Software/office expense', confidence: 'high' },
  { pattern: /GOOGLE/i, revType: 'Software/office expense', confidence: 'high' },
  { pattern: /Bubble/i, revType: 'Software/office expense', confidence: 'high' },
  { pattern: /Notifyre/i, revType: 'Software/office expense', confidence: 'high' },
  { pattern: /CONTINUUM MIND B/i, revType: 'Software/office expense', confidence: 'high' },

  // Expenses - Provider Payments
  { pattern: /Dr\. (Norseth|Privratsky|Anthony)/i, revType: 'Contract labor', confidence: 'high' },

  // Expenses - Payment Processing
  { pattern: /StaxPmtsMerchant.*-/i, revType: 'Payment processing fees', confidence: 'high' },

  // Expenses - Marketing
  { pattern: /Psychology Today/i, revType: 'Marketing and advertising', confidence: 'high' },
  { pattern: /usara/i, revType: 'Marketing and advertising', confidence: 'high' },

  // Expenses - Professional Fees
  { pattern: /Prof.*Lic/i, revType: 'Professional fees', confidence: 'high' },
  { pattern: /SLC CORP/i, revType: 'Professional fees', confidence: 'high' },
  { pattern: /PROF RSK MGMT/i, revType: 'Professional fees', confidence: 'high' },

  // Owner Contributions
  { pattern: /Miriam Sweeney.*(?=\d)/i, revType: 'Owner contribution', confidence: 'medium' },  // Positive = contribution

  // Refunds
  { pattern: /Refund|ACCTVERIFY/i, revType: 'Refund', confidence: 'high' }
]
```

**1.3 Classification UI**
- Upload Mercury CSV
- Show auto-classified transactions with confidence badges
- "Review Low Confidence" filter → Shows only items needing manual review
- Inline dropdown to override classification
- Bulk actions: "Approve All High Confidence"

**Impact:** Eliminates 90% of Column R manual classification

---

### **Phase 2: Insurance Reimbursement Tracking** (Weeks 3-4)
**Saves 15min/week** - Automatically links insurance payments to appointments

#### What We'll Build:

**2.1 Insurance Payer Deposits**

When UT Medicaid deposit arrives ($1,280.96), automatically:
1. Find all pending appointments with payer = "Utah Medicaid FFS"
2. Calculate expected reimbursement based on fee schedules
3. Match deposit to appointments (by total amount or date range)
4. Mark appointments as "Paid"
5. Update `reimbursement_cents` on each appointment

**2.2 ERA Matching (Optional Enhancement)**
- Upload ERA file (835 remittance advice)
- Parse claim-level payment details
- Match to specific appointments by claim ID
- Handle adjustments, denials, partial payments

**2.3 Variance Alerts**
- Expected: $200.00 (from fee schedule)
- Actual: $180.00 (from ERA)
- Alert: "UT Medicaid underpaid by $20 - Reason: CO-45 (charge exceeds fee schedule)"

**Database:**
```sql
create table insurance_deposits (
  id uuid primary key,
  bank_transaction_id uuid references bank_transactions(id),
  payer_id uuid references payers(id),
  deposit_date date not null,
  amount_cents int not null,
  matched_appointments uuid[],  // Array of appointment IDs
  unmatched_amount_cents int,  // Leftover after matching
  era_file_id uuid references era_files(id),
  status text,  // 'pending', 'matched', 'partial', 'investigate'
  created_at timestamptz default now()
);
```

**Impact:** Eliminates manual tracking of "which insurance payments covered which appointments"

---

### **Phase 3: Stax → Mercury Reconciliation** (Weeks 5-6)
**Saves 25min/week** - Automates Stax auth ID matching

#### What We'll Build:

**3.1 Stax Transaction Import**
- Upload Stax CSV (same as current workflow)
- Parse into `stax_transactions` table
- Auto-match to Mercury transactions using:
  1. Amount match (within $1 tolerance for fees)
  2. Date proximity (same day or 1-day lag)
  3. Auth ID linking

**3.2 Matching Algorithm**
```typescript
// For each Stax transaction:
const staxAmount = 400  // $400 charge
const staxAuthId = "119348"
const staxDate = "2025-04-11"

// Find Mercury deposit:
const mercuryDeposit = await db.bank_transactions.findFirst({
  where: {
    description: { contains: 'StaxPmtsMerchant' },
    amount_cents: { gte: 38800, lte: 40000 },  // $388-$400 (accounting for fees)
    transaction_date: { gte: staxDate, lte: addDays(staxDate, 2) }
  }
})

// Link them:
await db.bank_transactions.update({
  where: { id: mercuryDeposit.id },
  data: {
    stax_auth_id: staxAuthId,
    stax_matched: true,
    rev_status: lagDays > 0 ? 'deposit lag – OK' : null
  }
})
```

**3.3 Reconciliation Dashboard**
- Show matched vs unmatched Stax transactions
- Flag: "Stax charge $400 (auth: 119348) - No matching Mercury deposit - INVESTIGATE"
- Allow manual linking with dropdown

**Impact:** Eliminates Step 3 manual reconciliation entirely

---

### **Phase 4: P&L Dashboard** (Weeks 7-8)
**Real-time financial visibility**

#### What We'll Build:

**4.1 Revenue Metrics**
- Total Revenue (all sources): $X,XXX
- Insurance Reimbursements: $X,XXX (70%)
- Copays/Cash (Stax): $X,XXX (30%)
- Outstanding Claims: $X,XXX
- Collection Rate: XX%

**4.2 Expense Breakdown**
- Provider Compensation: $X,XXX
- Software: $XXX
- Marketing: $XXX
- Professional Fees: $XXX
- Payment Processing: $XXX

**4.3 Net Income**
- Gross Revenue: $X,XXX
- Total Expenses: $(X,XXX)
- Net Income: $X,XXX
- Profit Margin: XX%

**4.4 Time-Series**
- Monthly revenue trend
- Revenue by payer (UT Medicaid, DMBA, Cash, etc.)
- Provider compensation trend

**Impact:** Eliminates Step 6 pivot refresh, real-time P&L visibility

---

## Feature Prioritization (Revised)

| Feature | Impact | Effort | Saves Time | Priority |
|---------|--------|--------|------------|----------|
| Mercury auto-classification | HIGH | Medium | 30min/week | **P0** |
| Insurance deposit matching | HIGH | Medium | 15min/week | **P1** |
| Stax reconciliation | HIGH | Medium | 25min/week | **P1** |
| Provider payment tracking | HIGH | Medium | 20min/week | **P2** |
| P&L dashboard | Medium | Low | 5min/week | **P3** |
| ERA file parsing | Low | High | 5min/week | **P4** |

**Total Time Savings:** 70min/week → **60 hours/year**

---

## Revised Data Architecture

### Central Tables:

```
bank_transactions (Mercury CSV)
    ↓
├── Insurance deposits → appointments (reimbursement tracking)
├── Stax deposits → stax_transactions → appointments (copay tracking)
├── Provider payments → appointments (expense tracking)
└── Expense classification → P&L categories
```

### Data Flow:

```
1. Upload Mercury CSV
   ↓
2. Auto-classify transactions
   ↓
3. Match insurance deposits to appointments
   ↓
4. Match Stax deposits to Mercury deposits
   ↓
5. Link provider payments to appointments
   ↓
6. Generate P&L dashboard
```

---

## Quick Wins (Can Build Today - 3 hours)

### 1. Mercury CSV Upload API (1 hour)
**What:** Create `/api/finance/upload/mercury` endpoint
**Impact:** Eliminates manual CSV paste into Google Sheets

### 2. Basic Auto-Classification (1.5 hours)
**What:** Implement pattern matching for top 10 revenue/expense types
**Impact:** Auto-classifies 80% of transactions

### 3. Classification Review UI (30min)
**What:** Show uploaded transactions with classification, allow override
**Impact:** Quick review interface replaces Google Sheets Column R editing

---

## Questions for You

1. **Mercury API vs CSV Upload:**
   - Would you prefer CSV upload (simple, 0 setup) or direct Mercury API integration (auto-syncs daily)?
   - CSV upload is fine for MVP, API can come later

2. **Insurance Reimbursement Matching:**
   - When UT Medicaid pays $1,280.96, how do you currently figure out which appointments it covers?
   - Do you match by date range, or do you have ERA files with claim-level details?

3. **Provider Payment Calculations:**
   - Is provider pay a flat percentage (e.g., 60% of revenue)?
   - Or does it vary by provider, service type, or payer?
   - I see Dr. Norseth payments like $190, $285, $253 - what's the calculation?

4. **Expense Approval:**
   - Personal expenses (Chris's card, Sweeney Checking) are marked "🌙Moonlit expense" - Should these flow through?
   - Or should we filter to only Mercury Checking transactions?

5. **Priority Confirmation:**
   - Does Phase 1 (Mercury auto-classification) sound like the highest value?
   - Or would you prefer to start with Stax reconciliation (Phase 3)?

---

## Next Steps

### This Week:
1. **Answer the 5 questions above**
2. **Review revised plan** - Does this match your actual workflow now?
3. **Pick Phase 1 or Phase 3** - Which should we build first?

### Next Week (Phase 1 Kickoff):
1. Build `bank_transactions` table
2. Implement Mercury CSV upload
3. Test auto-classification with your last month of data
4. Iterate on pattern matching until 90%+ accuracy

Ready to start?
