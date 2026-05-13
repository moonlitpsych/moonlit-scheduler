# Bear River Behavioral Health - Payer Implementation

**Date:** November 19, 2025
**Branch:** `feature/add-bear-river-payer`
**Migration:** `065-add-bear-river-behavioral-health.sql`

## Summary

Added Bear River Behavioral Health as a searchable payer in the booking system to explicitly show patients that we are **NOT in-network** with this Medicaid payer.

## Problem Solved

When patients search for "Bear River Behavioral Health" in the booking flow, they need to:
1. See that this payer exists
2. Understand that Moonlit does NOT accept this insurance
3. Have options to either join a waitlist or pay cash

Previously, if a payer wasn't in the database, users would see no results and be confused about whether we accept it or not.

## Implementation Details

### Database Changes

**New Payer Record:**
```sql
name: 'Bear River Behavioral Health'
payer_type: 'medicaid'
state: 'UT'
status_code: 'not_in_network'
requires_attending: FALSE
requires_individual_contract: FALSE
effective_date: NULL
projected_effective_date: NULL
```

### How It Works

1. **Search Results:** When users type "Bear River" in the payer search, this payer appears in results
2. **Acceptance Status:** The `status_code: 'not_in_network'` maps to `acceptanceStatus: 'not-accepted'` in the booking flow (see `PayerSearchView.tsx:275-301`)
3. **User Experience:** Upon selecting this payer, users see `InsuranceNotAcceptedView` which offers:
   - Go back to search for different insurance
   - Join waitlist to be notified if we get in-network
   - Pay cash instead

### No Provider Contracts

Since `status_code: 'not_in_network'`, no entries will be created in:
- `provider_payer_contracts` table
- `v_bookable_provider_payer` view

This ensures booking validation will correctly prevent appointments with this payer.

### Ways to Pay Page

The payer will **NOT** appear on the `/ways-to-pay` page because:
- `ways-to-pay/payers/route.ts` only shows payers with `status_code IN ('approved', 'in_progress', 'waiting_on_them', 'not_started')`
- Payers with other status codes (like 'not_in_network') are excluded from that public-facing page

## Testing Checklist

- [ ] Run migration: `065-add-bear-river-behavioral-health.sql`
- [ ] Search for "Bear River" in booking flow payer search
- [ ] Verify it appears in search results
- [ ] Select the payer and confirm `InsuranceNotAcceptedView` is shown
- [ ] Verify it does NOT appear on `/ways-to-pay` page
- [ ] Confirm no bookable providers show up for this payer

## File Changes

**Created:**
- `database-migrations/065-add-bear-river-behavioral-health.sql` - Migration to add payer

**No frontend changes required** - existing logic already handles this status code correctly.

## Deployment

1. Merge `feature/add-bear-river-payer` to `main`
2. Run migration on production database
3. Verify in production booking flow

## Notes

- Bear River Behavioral Health is a Medicaid mental health authority serving northern Utah
- This is the correct pattern for adding payers we don't accept but want to be transparent about
- Future payers in similar situations should use `status_code: 'not_in_network'`
