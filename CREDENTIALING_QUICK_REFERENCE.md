# Provider Credentialing System - Quick Reference Guide

## What It Does

Automates provider onboarding by managing multi-payer credentialing tasks. Admins select payers, system generates payer-specific tasks, tracks progress, and manages applications.

## Key Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `payer_credentialing_workflows` | Payer-specific processes | workflow_type, task_templates, contact_info |
| `provider_credentialing_tasks` | Individual to-do items | provider_id, payer_id, task_status, task_order |
| `provider_payer_applications` | Application status tracking | provider_id, payer_id, application_status |

## Quick Facts

- **Task Status**: pending, in_progress, completed, blocked, not_applicable
- **Workflow Types**: instant_network, online_portal, excel_submission
- **Application Status**: not_started, in_progress, submitted, under_review, approved, denied, on_hold, withdrawn
- **Tasks per Payer**: 1-4 tasks generated from workflow template
- **RLS**: Admin-only access via auth_profiles.role = 'admin'

## API Endpoints

```
GET  /api/admin/payers/selection-stats?providerId=UUID
POST /api/admin/providers/{id}/credential-payers
GET  /api/admin/providers/{id}/credentialing-dashboard
PATCH /api/admin/credentialing-tasks/{id}
```

## UI Components

1. **PayerSelectionPanel** - Select payers to credential with
2. **CredentialingTaskList** - View/manage tasks by payer
3. **ProviderCredentialingDashboard** - Main dashboard (combines both)

## How It Works

```
1. Admin visits /admin/provider-credentialing/[providerId]
2. Click "Select Payers" tab
3. Select payers using checkboxes
4. Click "Generate Tasks"
   - Creates provider_payer_applications records
   - Creates provider_credentialing_tasks from templates
5. Click "Credentialing Tasks" tab
6. Update task statuses as work progresses
7. Notes auto-save, completed_date auto-set
```

## Query Tasks for a Payer

```typescript
// Get all tasks for provider-payer combination
const { data: tasks } = await supabaseAdmin
  .from('provider_credentialing_tasks')
  .select('*')
  .eq('provider_id', providerId)
  .eq('payer_id', payerId)
  .order('task_order', { ascending: true })
```

## Most Important Files

**Database**:
- `032-create-payer-credentialing-workflows.sql` - Workflow table
- `033-create-provider-credentialing-tasks.sql` - Task table
- `034-create-provider-payer-applications.sql` - Application table

**API**:
- `src/app/api/admin/payers/selection-stats/route.ts` - Get payer list
- `src/app/api/admin/providers/[providerId]/credential-payers/route.ts` - Create tasks
- `src/app/api/admin/providers/[providerId]/credentialing-dashboard/route.ts` - Get dashboard
- `src/app/api/admin/credentialing-tasks/[taskId]/route.ts` - Update task

**UI**:
- `src/components/admin/ProviderCredentialingDashboard.tsx` - Main dashboard
- `src/components/admin/PayerSelectionPanel.tsx` - Payer selection
- `src/components/admin/CredentialingTaskList.tsx` - Task list

**Page**:
- `src/app/admin/provider-credentialing/[providerId]/page.tsx` - Route

## Known Issues

1. **Task Persistence** (FIXED) - Updates weren't persisting due to page reload masking failures. Fixed with local state updates.
2. **Auto-Contract Creation** (TODO) - When application_status = 'approved', should auto-create provider_payer_networks entry

## Next Steps (Phase 2)

- File attachment system for credentials
- Email notifications for overdue tasks
- Bulk task status updates
- Integration with CAQH for auto-sync

---

**For comprehensive details**, see `/CREDENTIALING_SYSTEM_RESEARCH.md`
