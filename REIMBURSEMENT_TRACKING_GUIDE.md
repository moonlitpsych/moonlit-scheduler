# Reimbursement Tracking - User Guide

## What I Just Built (Nov 2025)

I've added **reimbursement tracking** and **provider pay summary** features to your finance page. This is the foundation for automating your weekly finance workflow.

---

## ✅ New Features

### 1. Reimbursement Amount Field (Appointment Detail Drawer)

**Where:** Click any appointment on the finance page → Detail drawer opens

**What's New:**
- New "Reimbursement Amount ($)" input field
- Enter the actual amount you received from insurance
- Automatically saves to `appointments.reimbursement_cents`

**How to Use:**
1. When UT Medicaid pays $1,280.96, open Office Ally to see which appointments were paid
2. For each covered appointment:
   - Click the appointment row on finance page
   - Click "Edit"
   - Enter reimbursement amount (e.g., 144.58)
   - Update claim status to "Paid"
   - Click "Save All Changes"

---

### 2. Provider Pay Summary Card

**Where:** `/admin/finance/appointments` (top of page, below summary cards)

**What It Shows:**
- Which providers are owed money
- How much they're owed (balance)
- Number of reimbursed but unpaid appointments
- Earned vs already paid breakdown

**Example Display:**
```
┌─────────────────────────────────────────────────┐
│ Provider Compensation Owed           $380.00    │
├─────────────────────────────────────────────────┤
│                                                 │
│ Dr. Travis Norseth                   $380.00   │
│   Reimbursed (unpaid): 12 appts                │
│   Earned:              $2,280.00               │
│   Already Paid:        $1,900.00               │
│   Balance Owed:        $380.00                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

**How It Works:**
- Automatically calculates based on appointments with `reimbursement_cents` filled in
- Only shows providers with a balance owed > $0
- Updates in real-time as you mark appointments as reimbursed

---

### 3. Enhanced CSV Export

**Where:** Finance page → "Export CSV" button

**What's New:**
Added columns:
- Provider Paid Date
- Reimbursement (actual insurance payment)
- Patient Paid
- Patient Paid Date
- Discount Note

Now you can export complete financial data including reimbursement tracking.

---

## 🔄 Workflow: Track Insurance Reimbursement

### Current Process (Manual):
1. UT Medicaid pays $1,280.96 → Shows in Mercury
2. Walk into Office Ally → Check claims
3. Manually calculate provider earnings
4. Update Google Sheet

### New Process (Semi-Automated):
1. UT Medicaid pays $1,280.96 → Shows in Mercury
2. Walk into Office Ally → Check claims (still manual for now)
3. **For each covered appointment:**
   - Open appointment detail drawer
   - Enter reimbursement amount
   - Set claim status to "Paid"
4. **Provider Pay Summary automatically calculates:**
   - Dr. Norseth owed $380 (12 appointments)
5. Send ACH payment via Mercury
6. **Record payment:**
   - Open each of Dr. Norseth's 12 appointments
   - Enter provider paid amount
   - Enter payment date
   - Save

**Time Saved:** ~15min (no more manual calculation in Google Sheets)

---

## 📊 API Endpoints Added

### GET `/api/finance/provider-pay-summary`

Returns provider balances based on reimbursed appointments.

**Response:**
```json
{
  "success": true,
  "summary": [
    {
      "provider_id": "uuid",
      "provider_name": "Dr. Travis Norseth",
      "reimbursed_appointments": 12,
      "earned_cents": 228000,
      "paid_cents": 190000,
      "balance_owed_cents": 38000
    }
  ],
  "metadata": {
    "total_providers_owed": 2,
    "total_balance_owed_cents": 90000
  }
}
```

---

## 🗄️ Database Schema (Already Exists)

No new tables created! Using existing columns:

```sql
-- appointments table
reimbursement_cents int,     -- Actual amount received from insurance
claim_status text,            -- 'submitted', 'paid', 'denied', etc.
provider_paid_cents int,      -- What you've actually paid the provider
provider_paid_date date,      -- When you sent ACH
patient_paid_cents int,       -- Copay amount
patient_paid_date date,       -- When copay was received
discount_note text            -- No-show, cancellation notes
```

All of these columns already existed but weren't exposed in the UI until now!

---

## 🚀 Next Steps (Phase 2 - Bulk Tools)

What we'll build next week to save even more time:

### **Bulk Reimbursement Linking**
Instead of opening appointments one-by-one:
1. Upload Mercury CSV
2. Click "UT Medicaid $1,280.96"
3. Bulk-select 10 appointments
4. One-click: Mark all as reimbursed

**Time Saved:** 25min/week

### **Bulk Provider Payment Recording**
Instead of updating appointments one-by-one:
1. Provider Pay Summary shows: "Dr. Norseth owed $380"
2. Click "Record Payment"
3. Modal shows 12 appointments
4. Enter payment date + confirmation #
5. One-click: Updates all 12 appointments

**Time Saved:** 15min/week

---

## 🧪 Testing the New Features

### Test Scenario: Track a Reimbursement

1. **Go to finance page:** http://localhost:3002/admin/finance/appointments

2. **Check Provider Pay Summary:**
   - Should say "No providers are owed compensation" (if no reimbursements yet)

3. **Mark an appointment as reimbursed:**
   - Click any appointment row
   - Click "Edit"
   - Enter Reimbursement Amount: 188.76
   - Change Claim Status to: "Paid"
   - Click "Save All Changes"

4. **Refresh page:**
   - Provider Pay Summary should now show that provider
   - Should show: "Balance Owed: $XXX"

5. **Export CSV:**
   - Click "Export CSV"
   - Open in Excel/Google Sheets
   - Check "Reimbursement" column has your $188.76

6. **Record provider payment:**
   - Open the same appointment again
   - Click "Edit"
   - Enter Provider Paid: 114.00 (60% of $190 example)
   - Enter Provider Paid Date: today
   - Save

7. **Refresh page again:**
   - Provider Pay Summary should show updated balance
   - If all appointments paid, provider disappears from summary

---

## 💡 Tips & Best Practices

### When to Mark as Reimbursed:
- **Do:** Mark appointments as reimbursed when you receive the insurance payment
- **Don't:** Wait until you pay the provider (that's a separate field!)

### Claim Status Values:
- `submitted` - Claim sent to insurance
- `accepted` - Insurance acknowledged receipt
- `paid` - **Use this when you receive payment**
- `denied` - Insurance rejected
- `pending` - Default status

### Provider Pay Workflow:
1. **Mark appointments as reimbursed** → Provider appears in summary
2. **Send ACH payment** → Record in Mercury
3. **Update appointments** → Enter provider paid amount & date
4. **Provider disappears from summary** → All caught up!

---

## 🐛 Troubleshooting

### "Provider Pay Summary says no providers owed"
- Check if any appointments have `reimbursement_cents` filled in
- Provider balance = (earned - paid), only shows if > $0

### "Can't save reimbursement amount"
- Make sure you clicked "Edit" first
- Check for JavaScript errors in browser console
- Try refreshing page and re-entering

### "Provider balance seems wrong"
- Check if some appointments already have `provider_paid_cents` filled in
- Summary only counts appointments with reimbursement but no provider payment

---

## 📋 Summary of Changes

**Files Created:**
- `/src/app/api/finance/provider-pay-summary/route.ts` - API endpoint
- `/src/components/finance/ProviderPaySummary.tsx` - Summary card component

**Files Modified:**
- `/src/components/finance/AppointmentDetailDrawer.tsx` - Added reimbursement field
- `/src/app/admin/finance/appointments/page.tsx` - Added summary card, enhanced CSV export

**Database:**
- No schema changes (used existing columns)

**Testing:**
- Frontend compiles successfully
- API endpoint accessible at `/api/finance/provider-pay-summary`
- Summary card renders on finance page

---

## ⏱️ Time Savings Estimate

**Current weekly workflow:** 75min
**After today's features:** 60min
**Savings:** 15min/week

**After Phase 2 (bulk tools):** 5min/week
**Total savings:** 70min/week = **60 hours/year**

---

## 🎯 Next Session Goals

1. Build bulk reimbursement linking tool
2. Build bulk provider payment recording
3. Mercury CSV upload & auto-classification
4. Office Ally API integration (if available)

Ready to test! Go to http://localhost:3002/admin/finance/appointments and check it out.
