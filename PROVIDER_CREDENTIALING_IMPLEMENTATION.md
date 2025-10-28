# Provider Payer Credentialing System - Implementation Summary

**Created:** 2025-10-28
**Branch:** `feat/session-oct-28-evening`
**Status:** ✅ Complete - Ready for Testing

---

## Overview

Built a comprehensive system for admins to select which payers to prioritize for new providers, automatically generate credentialing tasks based on each payer's workflow, and track credentialing progress.

This addresses the "Decide which payers to prioritize" step in the provider onboarding process.

---

## What Was Built

### 1. Database Schema (3 new tables)

#### `payer_credentialing_workflows`
Stores different credentialing processes per payer.

**Key fields:**
- `workflow_type`: 'instant_network' | 'online_portal' | 'excel_submission'
- `task_templates`: JSONB array of task definitions
- `portal_url`, `portal_instructions`, `excel_template_url`
- `credentialing_contact_name`, `credentialing_contact_email`
- `typical_approval_days`: Expected days from submission to approval

**Migration:** `database-migrations/032-create-payer-credentialing-workflows.sql`

---

#### `provider_credentialing_tasks`
Tracks individual credentialing to-do items.

**Key fields:**
- `provider_id`, `payer_id`, `task_type`, `title`, `description`
- `task_status`: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'not_applicable'
- `due_date`, `completed_date`, `task_order`
- `notes`, `uploaded_document_url`, `assigned_to`
- `application_id`, `portal_url`

**Features:**
- Auto-sets `completed_date` when status changes to 'completed'
- Includes helper function: `get_provider_credentialing_progress()`

**Migration:** `database-migrations/033-create-provider-credentialing-tasks.sql`

---

#### `provider_payer_applications`
Tracks application status and submission details.

**Key fields:**
- `provider_id`, `payer_id`
- `application_status`: 'not_started' | 'in_progress' | 'submitted' | 'under_review' | 'approved' | 'denied' | 'on_hold' | 'withdrawn'
- `application_started_date`, `application_submitted_date`, `approval_date`, `effective_date`
- `caqh_application_id`, `payer_application_id`, `portal_reference`
- `denial_reason`, `reapplication_eligible`

**Auto-triggers:**
- Auto-creates `provider_payer_networks` entry when application is approved
- Auto-sets dates when status changes

**Helper functions:**
- `get_credentialing_pipeline_summary()`
- `get_overdue_applications()`

**Migration:** `database-migrations/034-create-provider-payer-applications.sql`

---

### 2. API Endpoints (5 new routes)

#### GET `/api/admin/payers/selection-stats`

Returns payer list with statistics for selection UI.

**Query params:**
- `providerId` (optional): If provided, includes provider-specific flags

**Returns:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Molina Healthcare of Utah",
      "payer_type": "medicaid",
      "state": "UT",

      "requires_individual_contract": true,
      "allows_supervised": true,
      "requires_attending": false,
      "supervision_level": "sign_off_only",

      "total_contracts": 3,
      "bookable_providers": 4,
      "current_census": 15,

      "workflow_type": "online_portal",
      "typical_approval_days": 30,

      "already_credentialing": false,
      "already_contracted": false,
      "is_recommended": false
    }
  ]
}
```

**Features:**
- Highlights `requires_attending=true` payers if provider is attending
- Shows existing contracts and applications
- Patient census based on latest appointment per patient

**File:** `src/app/api/admin/payers/selection-stats/route.ts`

---

#### POST `/api/admin/providers/[providerId]/credential-payers`

Creates credentialing tasks and application records for selected payers.

**Request body:**
```json
{
  "payerIds": ["uuid1", "uuid2", "uuid3"]
}
```

**Returns:**
```json
{
  "success": true,
  "data": {
    "tasksCreated": 12,
    "applicationsCreated": 3,
    "details": [
      {
        "payerId": "uuid1",
        "payerName": "Molina Healthcare of Utah",
        "taskCount": 4,
        "applicationId": "uuid"
      }
    ]
  }
}
```

**Task generation logic:**

**Instant Network (no individual contract):**
1. Notify payer of provider addition

**Excel Submission:**
1. Download Excel roster template
2. Add provider to template
3. Submit roster to payer
4. Confirm receipt

**Online Portal:**
1. Obtain portal credentials
2. Submit provider application
3. Record application ID
4. Follow up on status

**Custom workflows:**
- If payer has `task_templates` in workflows table, uses those instead

**File:** `src/app/api/admin/providers/[providerId]/credential-payers/route.ts`

---

#### GET `/api/admin/providers/[providerId]/credentialing-dashboard`

Returns comprehensive credentialing progress for a provider.

**Returns:**
```json
{
  "success": true,
  "data": {
    "provider": {
      "id": "uuid",
      "first_name": "Jane",
      "last_name": "Doe",
      "role": "Psychiatrist",
      "npi": "1234567890"
    },
    "overall_stats": {
      "total_payers": 5,
      "total_tasks": 20,
      "completed_tasks": 12,
      "in_progress_payers": 2,
      "approved_payers": 1,
      "pending_approval": 2
    },
    "payers": [
      {
        "payer_id": "uuid",
        "payer_name": "Molina Healthcare of Utah",
        "application_status": "submitted",
        "completion_percentage": 75,
        "total_tasks": 4,
        "completed_tasks": 3,
        "tasks": [...]
      }
    ]
  }
}
```

**File:** `src/app/api/admin/providers/[providerId]/credentialing-dashboard/route.ts`

---

#### PATCH `/api/admin/credentialing-tasks/[taskId]`

Updates a specific credentialing task.

**Request body:**
```json
{
  "task_status": "completed",
  "notes": "Application submitted successfully",
  "assigned_to": "admin@example.com",
  "application_id": "APP-12345",
  "due_date": "2025-11-15"
}
```

**Also includes:** GET and DELETE methods for task management.

**File:** `src/app/api/admin/credentialing-tasks/[taskId]/route.ts`

---

### 3. UI Components (3 new components)

#### `PayerSelectionPanel.tsx`

Interactive payer selection table with statistics.

**Features:**
- Sortable/filterable table (by name, contracts, census, bookable)
- Multi-select checkboxes
- Visual badges for credentialing requirements:
  - Individual Contract Required (orange)
  - Attending Required (blue)
  - Allows Supervised (green)
- Workflow type badges (Instant/Excel/Portal)
- Status indicators (Contracted, In Progress, Not Started)
- **⭐ Recommended for Attendings** highlight for `requires_attending=true` payers
- "Generate Tasks" button to create credentialing tasks

**Columns:**
- Payer name and type
- Requirements badges
- Workflow type
- Contract count
- Bookable providers count
- Current census

**File:** `src/components/admin/PayerSelectionPanel.tsx`

---

#### `CredentialingTaskList.tsx`

Task management interface grouped by payer.

**Features:**
- Expandable payer groups
- Progress bars showing completion percentage
- Task status icons (✓ Completed, ⏰ In Progress, ⊗ Blocked, ○ Pending)
- Color-coded task cards
- Status dropdown for each task
- Notes editing (inline)
- Due date display with overdue warnings
- Application status badges

**Task statuses:**
- Pending (gray)
- In Progress (blue)
- Completed (green)
- Blocked (red)
- Not Applicable (gray)

**File:** `src/components/admin/CredentialingTaskList.tsx`

---

#### `ProviderCredentialingDashboard.tsx`

Main dashboard integrating both components.

**Features:**
- Provider header (name, role, NPI)
- Overall statistics cards:
  - Total Payers
  - Tasks Progress (with progress bar)
  - Approved Payers
  - Pending Approval
- Tab navigation: "Select Payers" | "Credentialing Tasks"
- Automatic data refresh after task updates
- Error handling and loading states

**File:** `src/components/admin/ProviderCredentialingDashboard.tsx`

---

### 4. Admin Route

#### `/admin/provider-credentialing/[providerId]`

Standalone page for provider credentialing.

**Access URL:**
```
http://localhost:3000/admin/provider-credentialing/[PROVIDER_UUID]
```

**File:** `src/app/admin/provider-credentialing/[providerId]/page.tsx`

---

## How to Use

### Step 1: Run Database Migrations

```bash
# Connect to Supabase and run migrations in order:
psql $DATABASE_URL -f database-migrations/032-create-payer-credentialing-workflows.sql
psql $DATABASE_URL -f database-migrations/033-create-provider-credentialing-tasks.sql
psql $DATABASE_URL -f database-migrations/034-create-provider-payer-applications.sql
```

**Or using Supabase CLI:**
```bash
supabase db execute --file database-migrations/032-create-payer-credentialing-workflows.sql
supabase db execute --file database-migrations/033-create-provider-credentialing-tasks.sql
supabase db execute --file database-migrations/034-create-provider-payer-applications.sql
```

---

### Step 2: Seed Credentialing Workflows (Optional)

Populate `payer_credentialing_workflows` table with your payer workflows:

```sql
-- Example: Molina Healthcare (online portal)
INSERT INTO payer_credentialing_workflows (
  payer_id,
  workflow_type,
  portal_url,
  credentialing_contact_email,
  typical_approval_days,
  task_templates
) VALUES (
  (SELECT id FROM payers WHERE name = 'Molina Healthcare of Utah' LIMIT 1),
  'online_portal',
  'https://provider.molinahealthcare.com',
  'credentialing@molinahealthcare.com',
  30,
  '[
    {"title": "Update CAQH profile", "description": "Ensure CAQH profile is current", "order": 1, "estimated_days": 1},
    {"title": "Submit application in portal", "description": "Complete Molina provider application", "order": 2, "estimated_days": 2},
    {"title": "Record application ID", "description": "Save confirmation number", "order": 3, "estimated_days": 0},
    {"title": "Follow up after 30 days", "description": "Check portal for status", "order": 4, "estimated_days": 30}
  ]'::jsonb
);

-- Example: Regence (excel submission)
INSERT INTO payer_credentialing_workflows (
  payer_id,
  workflow_type,
  excel_template_url,
  excel_submission_email,
  typical_approval_days,
  task_templates
) VALUES (
  (SELECT id FROM payers WHERE name = 'Regence BlueCross BlueShield of Utah' LIMIT 1),
  'excel_submission',
  'https://regence.com/provider-roster-template.xlsx',
  'provider.network@regence.com',
  45,
  '[
    {"title": "Download Regence roster template", "description": "Get latest Excel template", "order": 1, "estimated_days": 0},
    {"title": "Add provider to roster", "description": "Fill in all required fields", "order": 2, "estimated_days": 1},
    {"title": "Submit roster via email", "description": "Send to provider.network@regence.com", "order": 3, "estimated_days": 0},
    {"title": "Request confirmation", "description": "Confirm receipt from Regence", "order": 4, "estimated_days": 3}
  ]'::jsonb
);
```

---

### Step 3: Access the Dashboard

Navigate to:
```
http://localhost:3000/admin/provider-credentialing/[PROVIDER_UUID]
```

**To get a provider UUID:**
```sql
SELECT id, first_name, last_name FROM providers WHERE is_active = true;
```

---

### Step 4: Select Payers

1. Click **"Select Payers"** tab
2. Review payer statistics:
   - Contract count (how many Moonlit providers have contracts)
   - Bookable providers (from bookability view)
   - Current census (patients with this as active payer)
3. **Look for ⭐ Recommended badges** if provider is an attending
4. Check workflow type (Instant/Excel/Portal)
5. Select payers using checkboxes
6. Click **"Generate Tasks (N)"** button

---

### Step 5: Track Progress

1. Switch to **"Credentialing Tasks"** tab
2. Expand payer groups to see tasks
3. Update task status using dropdown
4. Add notes inline by clicking "Add notes"
5. Monitor progress bars and completion percentages

---

### Step 6: Application Management

As tasks are completed, update application status in the database:

```sql
-- Update application status
UPDATE provider_payer_applications
SET application_status = 'submitted',
    payer_application_id = 'APP-12345'
WHERE provider_id = 'provider-uuid'
  AND payer_id = 'payer-uuid';

-- Mark as approved (auto-creates contract)
UPDATE provider_payer_applications
SET application_status = 'approved',
    effective_date = '2025-12-01'
WHERE provider_id = 'provider-uuid'
  AND payer_id = 'payer-uuid';
```

**Note:** When `application_status` changes to 'approved', a database trigger automatically creates the `provider_payer_networks` entry!

---

## Integration Points

### In Provider Onboarding Wizard

To integrate into the provider onboarding flow (branch `moonlit-scheduler-session-oct-28`):

```tsx
import PayerSelectionPanel from '@/components/admin/PayerSelectionPanel'

// Inside provider creation form:
<PayerSelectionPanel
  providerId={newlyCreatedProviderId}
  onPayersSelected={(payerIds) => {
    console.log('Selected payers:', payerIds)
    // Continue to next step or show success message
  }}
  showGenerateButton={true}
/>
```

### As Standalone Tool

Already implemented at `/admin/provider-credentialing/[providerId]`

---

## Key Features

### 🎯 Smart Recommendations
- Automatically highlights `requires_attending=true` payers for attending psychiatrists
- Shows which payers provider is already contracted with
- Displays in-progress applications

### 📊 Data-Driven Decisions
- **Contract count**: How many Moonlit providers have this payer?
- **Bookable providers**: How many providers can see patients with this payer?
- **Current census**: How many patients currently have this payer?

### ⚙️ Workflow Automation
- **Instant Network**: Single notification task
- **Excel Submission**: 3-4 tasks for template workflow
- **Online Portal**: 4 tasks for portal submission
- **Custom**: Use `task_templates` from workflows table

### 🔄 Auto-Contract Creation
- When application status → 'approved', automatically creates entry in `provider_payer_networks`
- Sets contract `effective_date` from application
- Adds audit note referencing application ID

### 📝 Task Management
- Auto-set completion dates
- Overdue warnings
- Inline notes editing
- Task assignment
- Application ID tracking

---

## Testing Checklist

### Database Setup
- [ ] Run all 3 migrations successfully
- [ ] Verify tables exist: `payer_credentialing_workflows`, `provider_credentialing_tasks`, `provider_payer_applications`
- [ ] Verify triggers and functions exist
- [ ] Seed workflow data for 2-3 payers

### API Endpoints
- [ ] GET `/api/admin/payers/selection-stats` returns payer list
- [ ] GET `/api/admin/payers/selection-stats?providerId=UUID` includes provider-specific flags
- [ ] POST `/api/admin/providers/[id]/credential-payers` creates tasks and applications
- [ ] GET `/api/admin/providers/[id]/credentialing-dashboard` returns progress data
- [ ] PATCH `/api/admin/credentialing-tasks/[id]` updates task status

### UI Components
- [ ] PayerSelectionPanel loads and displays payers
- [ ] Sorting and filtering work correctly
- [ ] Multi-select checkboxes function
- [ ] "Generate Tasks" button creates tasks
- [ ] CredentialingTaskList displays grouped tasks
- [ ] Task status dropdown updates successfully
- [ ] Notes can be added and saved
- [ ] Progress bars reflect completion percentage

### Full Workflow
- [ ] Create test provider
- [ ] Navigate to `/admin/provider-credentialing/[providerId]`
- [ ] Select 2-3 payers with different workflow types
- [ ] Generate tasks
- [ ] Verify tasks appear in "Credentialing Tasks" tab
- [ ] Mark some tasks as completed
- [ ] Update application status to 'approved'
- [ ] Verify contract auto-created in `provider_payer_networks`

---

## Database Schema Reference

### Table Relationships

```
providers
    ↓
provider_payer_applications → payers
    ↓                             ↓
provider_credentialing_tasks ← payer_credentialing_workflows
    ↓
provider_payer_networks (auto-created on approval)
```

### Key Constraints

- `provider_payer_applications`: UNIQUE(provider_id, payer_id)
- `payer_credentialing_workflows`: UNIQUE(payer_id)
- All tables have RLS enabled (admin-only access)

### Helper Functions

```sql
-- Get credentialing progress per payer
SELECT * FROM get_provider_credentialing_progress('provider-uuid');

-- Get pipeline summary
SELECT * FROM get_credentialing_pipeline_summary();

-- Get overdue applications
SELECT * FROM get_overdue_applications();
```

---

## Next Steps (Future Enhancements)

### High Priority
1. **Document upload system** - Allow uploading licenses, insurance certificates
2. **Email notifications** - Alert admins when applications are overdue
3. **Bulk actions** - Select multiple tasks and update status at once
4. **Application status sync** - Auto-check payer portals for status updates

### Medium Priority
5. **Analytics dashboard** - Average credentialing time per payer
6. **Calendar integration** - Add due dates to admin calendar
7. **Provider self-service** - Let providers upload their own documents
8. **Workflow templates library** - Pre-built templates for common payers

### Low Priority
9. **CAQH integration** - Auto-sync credentialing data
10. **Mobile app** - iOS/Android app for task management
11. **AI assistant** - Auto-fill application forms from provider data

---

## Files Created

### Database Migrations
- `database-migrations/032-create-payer-credentialing-workflows.sql`
- `database-migrations/033-create-provider-credentialing-tasks.sql`
- `database-migrations/034-create-provider-payer-applications.sql`

### API Endpoints
- `src/app/api/admin/payers/selection-stats/route.ts`
- `src/app/api/admin/providers/[providerId]/credential-payers/route.ts`
- `src/app/api/admin/providers/[providerId]/credentialing-dashboard/route.ts`
- `src/app/api/admin/credentialing-tasks/[taskId]/route.ts`

### UI Components
- `src/components/admin/PayerSelectionPanel.tsx`
- `src/components/admin/CredentialingTaskList.tsx`
- `src/components/admin/ProviderCredentialingDashboard.tsx`

### Pages
- `src/app/admin/provider-credentialing/[providerId]/page.tsx`

### Documentation
- `PROVIDER_CREDENTIALING_IMPLEMENTATION.md` (this file)

---

## Support

For questions or issues:
1. Check the database schema in migration files
2. Review API endpoint documentation above
3. Inspect browser console for errors
4. Check database logs for SQL errors
5. Verify RLS policies allow admin access

---

**Implementation Complete** ✅
**Branch:** `feat/session-oct-28-evening`
**Date:** 2025-10-28
