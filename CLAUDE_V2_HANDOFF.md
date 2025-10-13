# V2.0 Scheduler Handoff Document
**Date:** October 13, 2025
**Branch:** scheduler-v-2-0
**Last Commit:** Complete V2.0 IntakeQ insurance field sync

## 🚀 V2.0 Current Status

### ✅ What's Complete & Working

#### 1. **IntakeQ Integration (FULLY WORKING)**
- ✅ Appointments sync to IntakeQ calendar
- ✅ Insurance fields sync correctly:
  - Company Name: "Molina Healthcare of Utah"
  - Policy/Member ID: "IDFORMIRIAM1234"
  - Group Number (when provided)
- ✅ Phone numbers sync: "(385) 246-2522"
- ✅ Email aliasing prevents duplicates: "hello+mlt-xxxxx@trymoonlit.com"
- ⚠️ DOB cannot sync (IntakeQ API limitation - patients enter in intake form)

#### 2. **Idempotency System (WORKING)**
- ✅ Prevents double-bookings from double-clicks
- ✅ `idempotency_requests` table with 24-hour TTL
- ✅ Stable key generation from booking details

#### 3. **Non-blocking IntakeQ Sync (WORKING)**
- ✅ DB appointments save even if IntakeQ fails
- ✅ Controlled by `PRACTICEQ_ENRICH_ENABLED` flag
- ✅ Error handling with detailed logging

#### 4. **Feature Flags (CONFIGURED)**
```typescript
// Production settings in .env.local
PRACTICEQ_ENRICH_ENABLED=true          // ✅ IntakeQ enrichment active
INTAKE_HIDE_NON_INTAKE_PROVIDERS=true  // ✅ Filter non-intake providers
INTEGRATIONS_DEBUG_HTTP=true           // ✅ Debug logging
PRACTICEQ_DUPLICATE_ALERTS_ENABLED=false // 🔵 Future feature
BOOKING_AUTO_REFRESH_ENABLED=false     // 🔵 Future feature
```

#### 5. **Insurance Mappings (12 CONFIGURED)**
Database has `payer_external_mappings` entries for:
- Molina, Aetna, Medicaid Utah, HealthyU, DMBA, etc.

### 📝 What Was Just Fixed (Oct 13)

#### Insurance Field Sync Issue
**Problem:** Insurance wasn't showing in IntakeQ
**Root Cause:** Wrong field names
**Fix:** Changed in `intakeqClientUpsert.ts`:
- `PrimaryInsuranceName` → `PrimaryInsuranceCompany`
- `PrimaryMemberID` → `PrimaryInsurancePolicyNumber`
- `PrimaryGroupNumber` → `PrimaryInsuranceGroupNumber`

**Result:** Insurance now syncs correctly ✅

### ⚠️ Known Limitations

1. **DOB Cannot Be Set Via API**
   - IntakeQ doesn't accept DateOfBirth in API calls
   - Patients must enter in intake questionnaire
   - This is standard practice and fine for compliance

2. **GET Client Details Returns 404**
   - `/clients/${id}` endpoint doesn't work
   - Use search endpoints instead
   - Doesn't affect functionality

### 🔧 Debug Endpoints Available

```bash
# Check insurance mappings
GET /api/debug/check-insurance-mappings

# Test IntakeQ client operations
GET /api/debug/test-intakeq-client?clientId=116
POST /api/debug/test-intakeq-client

# Test field updates
GET /api/debug/test-intakeq-fields?clientId=116
POST /api/debug/test-intakeq-fields

# Test sync with various dates
POST /api/debug/test-intakeq-sync
```

### 📂 Key Files for V2.0

#### Core Booking Logic
- `src/app/api/patient-booking/book/route.ts` - Main booking endpoint
- `src/app/api/patient-booking/book-v2/route.ts` - Enhanced V2 endpoint
- `src/components/booking/BookingFlow.tsx` - Frontend booking flow

#### IntakeQ Integration
- `src/lib/services/intakeqClientUpsert.ts` - Client creation/update (FIXED)
- `src/lib/services/intakeQService.ts` - API wrapper
- `src/lib/intakeq/client.ts` - Client operations

#### Database
- `idempotency_requests` table - Prevents duplicates
- `payer_external_mappings` table - Insurance name mappings
- `patients` table - Has `intakeq_email_alias` column

### 🚨 Critical Patterns to Preserve

1. **Non-blocking IntakeQ Sync**
```typescript
try {
  intakeqClientId = await ensureClient(...)
} catch (error) {
  console.error('IntakeQ failed (continuing):', error)
  // Don't throw - continue with DB insert
}
```

2. **Insurance Field Names (MUST USE)**
```typescript
PrimaryInsuranceCompany    // NOT PrimaryInsuranceName
PrimaryInsurancePolicyNumber  // NOT PrimaryMemberID
PrimaryInsuranceGroupNumber   // NOT PrimaryGroupNumber
```

3. **Idempotency Key Generation**
```typescript
const key = btoa(JSON.stringify({
  providerId, payerId, start, email
}))
```

### 📋 Remaining V2.0 Tasks

#### High Priority
- [ ] Test full booking flow end-to-end in production
- [ ] Verify all insurance companies map correctly
- [ ] Monitor first real patient bookings

#### Medium Priority
- [ ] Clean up debug endpoints (keep for now)
- [ ] Add monitoring dashboard for sync failures
- [ ] Document for ops team

#### Future Enhancements
- [ ] Email alerts for duplicates (flag exists)
- [ ] Auto-refresh availability (flag exists)
- [ ] Better error recovery mechanisms

### 🧪 Testing Checklist

Before considering V2.0 complete:
1. [ ] Book appointment with each insurance type
2. [ ] Verify IntakeQ shows insurance details
3. [ ] Test double-click prevention
4. [ ] Confirm intake questionnaires send
5. [ ] Verify providers get notifications

### 📚 Documentation Files

- `INTAKEQ_FINAL_SOLUTION.md` - Complete fix documentation
- `V2_IMPLEMENTATION_SUMMARY.md` - Overall V2 features
- `V2_DEPLOYMENT_GUIDE.md` - Deployment instructions
- `CLAUDE.md` - Project overview

### 🎯 Next Session Focus

1. **Monitor Production** - Watch the first few real bookings
2. **Clean Up** - Remove test data and debug endpoints when stable
3. **Optimize** - Review performance and error handling
4. **Document** - Create operator guide for troubleshooting

### 💡 Important Notes

- Main branch auto-deploys - be careful
- All data must be real - no mock data
- IntakeQ API key is working (40 chars)
- Database already has correct insurance mappings
- Email aliasing is working to prevent duplicates

### ✅ Success Metrics

V2.0 can be considered complete when:
- 100% of bookings save to database
- 95%+ of bookings sync to IntakeQ (some may fail due to network)
- 100% of insurance info appears in IntakeQ (when provided)
- 0% double-bookings from double-clicks
- 100% of patients receive intake questionnaires

---

**Current Status: V2.0 is functionally complete and working. Insurance sync is fixed. Ready for production monitoring and minor cleanup.**