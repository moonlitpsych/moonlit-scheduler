# Insurance Data Sync Recommendation

**Date**: October 7, 2025
**Status**: Analysis Complete

---

## 📋 Current State

### What We Capture During Booking
The booking flow (`InsuranceInfoView.tsx`) collects:
- ✅ Patient demographics (name, DOB, email, phone)
- ✅ **Insurance ID** (`patientInfo.insuranceId`)
- ✅ Selected payer (e.g., "Molina Utah")
- ⚠️ Does NOT capture: group number, policy holder name, relationship

### What We Store in Our Database
- ✅ `appointments.payer_id` - FK to payers table
- ✅ `appointments.insurance_info` - JSONB with `payer_id` and `payer_name`
- ✅ `patients` table - demographics
- ❌ **No dedicated insurance table** - insurance data not persisted to patient profile

### What Gets Sent to IntakeQ
Currently:
- ✅ Client demographics (via `createClient`)
- ❌ Insurance information - **NOT synced**

---

## 🔍 Investigation Findings

### Option A: Sync Insurance to IntakeQ Client Profile

**IntakeQ API Support:** ✅ **CONFIRMED**

The IntakeQ Client API supports updating insurance via POST `/clients`:

```typescript
{
  FirstName: string,
  LastName: string,
  Email: string,
  Phone: string,
  DateOfBirth: string,

  // Primary Insurance Fields
  PrimaryInsuranceCompany: string,           // "Molina Utah"
  PrimaryInsurancePolicyNumber: string,      // member ID
  PrimaryInsuranceGroupNumber: string,       // optional
  PrimaryInsuranceHolderName: string,        // if different from patient
  PrimaryInsuranceRelationship: string,      // "Self", "Spouse", etc.
  PrimaryInsuranceHolderDateOfBirth: number, // Unix timestamp ms

  // Secondary Insurance (if needed)
  SecondaryInsuranceCompany: string,
  // ... same fields as primary
}
```

**Method**: POST (not PUT) - must GET client first, modify, then POST back
**Documentation**: https://support.intakeq.com/article/251-intakeq-client-api

**Pros:**
- ✅ Insurance data available in IntakeQ for claims processing
- ✅ One-time sync at booking keeps data current
- ✅ Survives even if intake form isn't filled out
- ✅ Visible in IntakeQ client profile for billing staff

**Cons:**
- ❌ Requires collecting MORE fields during booking (group #, policy holder, relationship)
- ❌ Longer booking form = higher abandonment risk
- ❌ Duplicate data entry (will also be in intake form)
- ❌ Insurance changes require API update, not just form resubmission

---

### Option B: Collect Insurance via Intake Form

**IntakeQ Form Support:** ✅ **CONFIRMED** (Image #2 shows form attachment)

IntakeQ intake forms can include insurance information fields.

**How It Works:**
1. Booking creates appointment → Sends intake form email
2. Patient fills out form **before appointment** → Includes insurance section
3. Form data auto-populates IntakeQ client profile
4. Billing staff sees complete info in IntakeQ

**Pros:**
- ✅ **Simpler booking flow** - just basic demographics + insurance ID
- ✅ Insurance details collected when patient has card in hand
- ✅ Patient can update/correct information easily via form
- ✅ Reduces booking abandonment (shorter form)
- ✅ IntakeQ handles form → profile sync automatically
- ✅ Forms can collect additional clinical intake data at same time

**Cons:**
- ⚠️ Depends on patient completing intake form
- ⚠️ Insurance data not available until form submission
- ⚠️ Need to ensure form is sent automatically with appointment

---

## 🎯 **RECOMMENDED APPROACH: Option B (Intake Form)**

**Rationale:**

1. **UX Best Practice**: Keep booking flow minimal to reduce friction
   - Current form already asks for 7 fields
   - Adding 3-4 more insurance fields = 40%+ longer form
   - Each additional field increases abandonment risk

2. **Data Quality**: Patients provide better data when they have insurance card
   - During booking: rushed, may not have card handy
   - During intake: scheduled, can gather materials

3. **Already Automated**: Your IntakeQ service is configured to send forms
   - Service: "New Patient Visit (insurance — UT)"
   - Form: "All intake forms | Moonlit" (Image #2)
   - Settings: ✅ "Send form before appointment is confirmed"

4. **Billing Workflow Alignment**: Insurance verification happens after booking anyway
   - Billing staff review intake forms before appointment
   - Insurance ID from booking is enough for initial verification
   - Full details collected via intake form for claims

---

## ✅ Implementation Plan (Recommended)

### Phase 1: Verify Intake Form Configuration (5 min)

**Action**: Confirm "All intake forms | Moonlit" includes insurance section

```
Navigate to IntakeQ → Forms → "All intake forms | Moonlit"
Check for fields:
- Primary Insurance Company
- Insurance Policy/Member ID
- Group Number
- Policy Holder Name
- Relationship to Policy Holder
```

**If missing**: Add insurance section to form template

---

### Phase 2: Ensure Form Auto-Send (Already Done ✅)

Your service configuration shows:
- ✅ "Default form when booking service for new appointments"
- ✅ "Send form before appointment is confirmed"

**Action**: Test that form is sent in confirmation email

---

### Phase 3: Update Booking Confirmation Message (Optional)

Add reminder to check email for intake paperwork:

```typescript
"Your appointment has been saved.
Check your email to submit required intake paperwork."
```

---

## 🔄 Alternative: Hybrid Approach (If Needed)

If you later determine you need insurance in IntakeQ immediately:

### Minimal Booking + Post-Booking Sync

1. **Keep booking form simple** (current fields only)
2. **Sync basic insurance** to IntakeQ client:
   ```typescript
   {
     PrimaryInsuranceCompany: payer.name,
     PrimaryInsurancePolicyNumber: patientInfo.insuranceId,
     PrimaryInsuranceRelationship: "Self" // default assumption
   }
   ```
3. **Intake form completes** the rest (group #, actual relationship, etc.)

**Pros**: Quick win, minimal code, low UX impact
**Cons**: Duplicate data entry, IntakeQ form overwrites API data

---

## 📊 Data Currently Lost

From booking flow, we capture but don't persist:
- `patientInfo.insuranceId` → stored in `insurance_info` JSONB, **not** patient profile
- `patientInfo.address` → stored in `patient_info` JSONB, **not** patient profile

**Recommendation**: Create `patient_insurance_policies` table for future claims automation:

```sql
CREATE TABLE patient_insurance_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id),
    payer_id UUID REFERENCES payers(id),
    member_id VARCHAR(100),
    group_number VARCHAR(100),
    policy_holder_name VARCHAR(200),
    relationship VARCHAR(50), -- "Self", "Spouse", "Child", "Other"
    effective_date DATE,
    termination_date DATE,
    is_primary BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Populate from**: Intake form submissions (future automation)

---

## 🎬 Next Steps

1. **✅ KEEP CURRENT BOOKING FLOW** - No changes needed
2. **✅ VERIFY INTAKE FORM** - Has insurance fields
3. **✅ TEST AUTO-SEND** - Confirm form arrives in email
4. **📋 DOCUMENT** - Update CLAUDE.md with insurance workflow
5. **🔮 FUTURE** - Build `patient_insurance_policies` table when ready for claims automation

---

## 📝 Summary

**Decision**: Use IntakeQ intake forms to collect insurance details
**Why**: Better UX, better data quality, already automated
**Trade-off**: Insurance not in system until patient completes form (acceptable for current workflow)
**Future**: Can add automated insurance table when building claims system

**No code changes required** - current implementation is optimal.
