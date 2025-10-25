# Payer Contract Automation System - User Guide

## Overview

This system automates your entire payer contract onboarding process, replacing the previous 8-step manual SQL workflow with a single UI workflow.

## Accessing the System

Navigate to: **http://localhost:3001/admin/test-payer-contract**

## Complete Workflow

### Step 1: Select a Payer

1. Choose whether to **Update Existing Payer** or **Create New Payer**
2. If updating existing:
   - Use the search box to find your payer by name or ID
   - Click on the payer card to select it
3. Click **"Launch Existing Payer Editor"** or **"Launch New Payer Editor"**

### Step 2: Basic Info Tab

Configure essential payer settings:

- **Status**: Change to "approved" when contract is finalized
- **Effective Date**: When the contract becomes active (YYYY-MM-DD)
- **Allows Supervised Care**: Enable if residents can provide care under supervision
- **Supervision Level**: How much supervision is required
  - `none` - No supervision needed
  - `sign_off_only` - Attending signs off after visit
  - `first_visit_in_person` - Attending must be present for first visit
  - `co_visit_required` - Attending must be present for all visits

### Step 3: Provider Contracts Tab

Add providers who have direct contracts with this payer:

1. Click **"Add Provider"**
2. Select provider from dropdown
3. Set effective/expiration dates (leave blank for open-ended)
4. Set status:
   - `in_network` - Direct contract with payer
   - `pending` - Contract being negotiated
   - `out_of_network` - No contract

**Note**: The counter shows "New: X contract(s)" for providers you're adding.

### Step 4: Supervision Tab

Configure which residents can provide care under which attendings:

**Bulk Actions:**
1. Select a **Default Attending** from dropdown
2. Click **"Select All"** to assign all providers to that attending
3. Click **"Apply to Selected"** to change the attending for all selected residents
   - You'll see: "Applied to X resident(s)" confirmation message

**Individual Selection:**
1. Check the box next to each resident who should be able to provide supervised care
2. For each checked resident, select their supervising attending from the dropdown

**Current Setup:** All active providers appear in the residents list (temporary - will be role-based once we configure your roles properly)

### Step 5: PracticeQ Tab (Optional)

Configure PracticeQ EMR integration:

1. **Insurance Company Name**: Exact name as it appears in PracticeQ
2. **Payer Code**: PracticeQ's internal code for this payer
3. **Aliases**: Alternative names patients might use

The system will suggest PracticeQ names based on the payer name.

### Step 6: Validation Tab

**Before applying your contract:**

1. Click **"Run Validation"** button (at bottom of modal)
2. Review the validation summary:
   - **Bookable Providers**: How many providers can currently be booked
   - **Supervisor Issues**: Problems with supervision setup
   - **Resident Issues**: Residents without proper supervision
   - **Blocked Providers**: Providers who can't be booked and why

**Interpreting Results:**

- 🔴 **Errors** (Red): Must fix before proceeding
- ⚠️ **Warnings** (Yellow): Should review, but can proceed
- ℹ️ **Info** (Blue): Informational, no action needed

**Common Warnings:**
- "No providers are currently bookable" - Expected if you haven't set an effective date yet
- "Payer has no effective date set" - Set one in Basic Info tab if contract is active

**Expand Sections:**
- Click "Show details" to see specific issues
- Each finding includes which provider is affected and why

### Step 7: Apply Contract

1. Click **"Apply Contract"** button (bottom right)
2. Enter an **Audit Note** (required for compliance):
   - Example: "In network notice received Oct 2025 -- added new contract and supervision relationships."
3. Review the summary showing what will be created/updated:
   - Provider Contracts: Current vs New
   - Supervision Relationships: Current vs New
   - PracticeQ Mapping: Whether it will be configured
4. Click **"Confirm"** to apply all changes

**What Happens:**
- All changes are applied in a single transaction
- Full audit trail is created
- Validation is run again to confirm success
- Results are shown in the Validation tab

## Troubleshooting

### "No providers in dropdown"
- Ensure you're logged in as admin
- Check browser console for API errors
- Refresh the page

### "Failed to update payer configuration"
- Check that all required fields are filled
- Ensure effective date is in YYYY-MM-DD format
- Check server logs for specific error

### "No residents found"
- This is temporary - all active providers appear as residents currently
- If you see this, no active providers exist in your database

### "Apply to Selected" doesn't seem to work
- After clicking, look for green confirmation message: "Applied to X resident(s)"
- Check individual resident rows to verify attending changed

## Technical Notes

### Database Tables Modified:
- `payers` - Status and supervision settings
- `provider_payer_networks` - Provider contracts
- `supervision_relationships` - Resident-attending mappings
- `payer_external_mappings` - PracticeQ configuration

### Audit Trail:
All actions are logged with:
- Who made the change (admin user)
- What was changed (before/after values)
- When it was changed (timestamp)
- Why it was changed (your audit note)

### Safe Mode:
- Migration only adds columns, never modifies existing ones
- Backward compatible with existing code
- Uses existing column names (attending_provider_id, resident_provider_id)

## Future Improvements

1. **Role-based filtering**: Automatically detect residents vs attendings based on provider roles
2. **Bulk import**: Upload CSV of provider contracts
3. **Effective date automation**: Automatically activate contracts on effective date
4. **Email notifications**: Alert providers when they're added to a new payer network
5. **Contract templates**: Save common contract configurations for reuse
