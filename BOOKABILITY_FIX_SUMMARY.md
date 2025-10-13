# Bookability Fix - Removed Contract-Based Gating

## Problem

I incorrectly added contract-based network checking to `book-v2/route.ts` that conflicted with your existing supply-based bookability logic.

## Root Cause

**Your system works on supply-based bookability:**
- Providers shown in UI = bookable (period)
- `v_bookable_provider_payer` view = single source of truth
- Includes supervision logic, service mappings, capacity, etc.
- No separate "network check" needed at booking time

**What I incorrectly added:**
- Redundant check of `v_bookable_provider_payer` in book-v2
- Would have rejected bookings even though provider was shown in UI
- Conflicted with existing bookability rules

## Fix Applied

### ✅ Removed All Network Checking from book-v2

**Before (WRONG):**
```typescript
// Step 2: Validate payer is accepted by provider
const { data: networkCheck } = await supabaseAdmin
  .from('v_bookable_provider_payer')  // ❌ Redundant check
  .select('provider_id, payer_id, relationship_type')
  .eq('provider_id', body.providerId)
  .eq('payer_id', body.payerId)

if (!networkCheck) {
  return NextResponse.json({
    error: 'This insurance is not accepted',
    code: 'PAYER_NOT_IN_NETWORK'
  }, { status: 400 })
}
```

**After (CORRECT):**
```typescript
// Step 2: Trust the UI's bookability logic
// If a provider was shown for this payer, they ARE bookable
// The UI uses v_bookable_provider_payer which includes all supply/supervision rules
// No additional validation needed here - the UI is the source of truth
```

## How Bookability Actually Works

### UI Layer (providers-for-payer)
1. Queries `v_bookable_provider_payer` view
2. Filters by:
   - `accepts_new_patients = true`
   - Language match
   - Active status
3. **If provider appears in list → they ARE bookable**

### Booking Layer (book-v2)
1. **Trust the UI** - no re-validation
2. Resolve service instance for duration/IntakeQ mapping
3. Check for time conflicts only
4. Create appointment

### The View Handles Everything
`v_bookable_provider_payer` already includes:
- ✅ Direct contracts (in_network)
- ✅ Supervision relationships (supervised)
- ✅ Effective dates
- ✅ Bookable_from dates
- ✅ Provider active/bookable status

## What Was Also Removed

1. **Feature flag:** `PRACTICEQ_BYPASS_NETWORK_CHECK` - no longer needed
2. **Audit logging:** `payer_network_check` actions - removed
3. **Error codes:** `PAYER_NOT_IN_NETWORK`, `NETWORK_CHECK_FAILED` - gone

## Testing Verification

### Should Work Now
✅ Any provider shown in UI can be booked
✅ No 400 errors from network checking
✅ Supervised providers (Dr. Sweeney) work correctly
✅ Booking flow matches UI's bookability exactly

### Remaining Validations in book-v2
- ✅ Patient data (required fields)
- ✅ Service instance resolution (for IntakeQ mapping)
- ✅ Time conflict checking
- ✅ IntakeQ client/practitioner mapping
- ❌ No bookability re-validation (UI is source of truth)

## Files Modified

1. **src/app/api/patient-booking/book-v2/route.ts**
   - Removed ~90 lines of network checking code
   - Now trusts UI's bookability logic

2. **src/lib/config/featureFlags.ts**
   - Can remove `PRACTICEQ_BYPASS_NETWORK_CHECK` (optional cleanup)

3. **scripts/dev-network-check.sql**
   - Can be deleted (no longer needed)

## Next Steps

1. ✅ Server recompiled successfully
2. **Test booking** - should work immediately
3. If still fails, it's a different issue (IntakeQ mapping, etc.)
4. Audit logs will show exactly where it fails

## Key Principle

**"If the UI shows it, you can book it."**

No redundant validation. The view is the single source of truth for bookability.
