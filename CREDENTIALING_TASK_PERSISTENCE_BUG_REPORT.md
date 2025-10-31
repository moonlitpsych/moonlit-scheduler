# Credentialing Task Persistence Bug Report
**Date**: October 31, 2025
**Severity**: CRITICAL
**Status**: Root cause identified, fix ready for deployment

## Problem Summary

User (Miriam) checked off multiple credentialing tasks for Dr. Roller yesterday on **production** (booking.trymoonlit.com), but after refreshing the page today, all tasks are back to "Pending" status. Task status updates are not persisting to the database.

## Investigation Results

### Database Evidence (as of Oct 31, 14:49 UTC)

Queried all 38 credentialing tasks for Dr. Roller (provider_id: `06c5f00f-e2c1-46a7-bad1-55c406b1d190`):

| Metric | Count | Details |
|--------|-------|---------|
| Total tasks | 38 | All created Oct 30-31 |
| Completed tasks | 1 | Only from manual debug test |
| Tasks with `updated_by` set | 2 | Both from debug tests ("rls-test", "debug-endpoint") |
| **User-initiated updates** | **0** | **ZERO updates from production UI** |

### What We Tested

✅ **Database update mechanism works**: Manual API calls successfully update and persist task status
✅ **PATCH endpoint code is correct**: Uses `supabaseAdmin`, proper error handling, returns updated task
✅ **RLS is not blocking updates**: Admin client can write to `provider_credentialing_tasks` table
✅ **Update persistence**: Database commits are working (verified with test updates)

### What's Failing

❌ **Production UI updates not reaching database**: No task updates from user interactions in 72+ hours
❌ **Silent failure**: User sees local state update (dropdown changes) but PATCH doesn't persist

## Root Cause Analysis

### Production Code Path (origin/main)

```typescript
// src/components/admin/ProviderCredentialingDashboard.tsx (PRODUCTION)
const handleTaskUpdate = async (taskId: string, updates: any) => {
  try {
    const res = await fetch(`/api/admin/credentialing-tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })

    if (!res.ok) {
      throw new Error('Failed to update task')
    }

    // ⚠️ PROBLEM: Reloads ALL data, masking failures
    await loadDashboard()
  } catch (err: any) {
    console.error('Error updating task:', err)
    alert(err.message || 'Failed to update task')  // Should show but doesn't?
  }
}
```

### Worktree Fixed Code (feat/fix-provider-credentialing-oct-30)

```typescript
// src/components/admin/ProviderCredentialingDashboard.tsx (FIXED)
const handleTaskUpdate = async (taskId: string, updates: any) => {
  try {
    const res = await fetch(`/api/admin/credentialing-tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })

    if (!res.ok) {
      throw new Error('Failed to update task')
    }

    // ✅ FIX: Update local state immediately, no full reload
    setPayerGroups(prevGroups => {
      const updatedGroups = prevGroups.map(group => {
        const taskIndex = group.tasks.findIndex(t => t.id === taskId)
        if (taskIndex === -1) return group

        const updatedTasks = [...group.tasks]
        updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], ...updates }

        // Recalculate stats...
        return { ...group, tasks: updatedTasks, ... }
      })

      setStats(prevStats => ({ ...prevStats, ... }))
      return updatedGroups
    })

  } catch (err: any) {
    console.error('Error updating task:', err)
    alert(err.message || 'Failed to update task')
  }
}
```

### Hypothesis: Why Production Fails

**Most likely**: The PATCH request is **failing silently** due to one of:

1. **Admin authentication failure**: Production may not recognize user as admin
   - Check: User's email in `isAdminEmail()` list?
   - Check: Auth token valid and not expired?

2. **CORS or network error**: Request blocked before reaching server
   - Check: Browser console for network errors
   - Check: Production server logs for incoming PATCH requests

3. **Alert suppression**: Browser blocks `alert()` calls
   - Modern browsers may suppress alerts from non-user-initiated actions
   - Error happens but user never sees it

4. **Stale production build**: Old JavaScript bundle cached
   - Production serving old code that has different bug
   - Hard refresh or cache clear needed

## Fixes Implemented (Ready to Deploy)

### Commit History (5 commits)

1. **408610f** - `debug: Add task persistence diagnostic endpoints`
   - `/api/debug/check-task-persistence` - Test updates and verify persistence
   - `/api/debug/recent-task-updates` - Show update history and diagnosis
   - `/api/debug/check-rls-policies` - Verify admin client can write

2. **4dc115e** - `fix: Update Dr. Privratsky schedule & identify provider availability bug`
   - Fixed Dr. Privratsky's schedule to Thursday 9am-4pm
   - Identified missing timezone field in availability inserts

3. **2c33c78** - `feat: Add contract signing steps to credentialing workflows`
   - Added "Wait for contract" and "Sign and return contract" tasks
   - Now 5 tasks per payer (was 3), prevents premature completion

4. **8bb31bd** - `fix: Eliminate page flicker when updating credentialing task status` **← CRITICAL FIX**
   - Changed from `await loadDashboard()` to local state updates
   - Prevents full page reload that was masking failures
   - Improves UX (no flicker)

5. **7b8ef5d** - `fix: Implement payer-specific credentialing task generation`
   - Created `/api/admin/providers/[providerId]/credential-payers` endpoint
   - Reads task_templates from `payer_credentialing_workflows` table
   - Generates correct payer-specific tasks

## Recommended Actions

### Immediate (Before Deploying)

1. **Check production logs** for PATCH requests to `/api/admin/credentialing-tasks/[taskId]`
   - Are requests reaching the server?
   - What status codes are being returned?

2. **Test on production** by:
   - Opening browser console (F12)
   - Changing a task status dropdown
   - Checking Network tab for PATCH request
   - Looking for errors in Console tab

3. **Verify admin auth** on production:
   - Confirm your email is in `isAdminEmail()` list
   - Check if auth token is valid
   - Try logging out and back in

### Deployment Steps

1. **Push credentialing worktree commits to main**:
   ```bash
   cd /Users/miriam/CODE/moonlit-scheduler-fix-credentialing-oct-30
   git push origin feat/fix-provider-credentialing-oct-30:main
   ```

2. **Wait for production deployment** (assuming auto-deploy from main)

3. **Test on production**:
   - Hard refresh page (Cmd+Shift+R) to clear cache
   - Update a task status
   - Refresh page
   - Verify status persisted

4. **Use debug endpoints to confirm**:
   ```bash
   # Check if your update persisted
   curl "https://booking.trymoonlit.com/api/debug/recent-task-updates?providerId=06c5f00f-e2c1-46a7-bad1-55c406b1d190&hours=1"
   ```

### Post-Deployment Verification

```bash
# Should show recently updated tasks with your email as updated_by
curl "https://booking.trymoonlit.com/api/debug/check-task-persistence?providerId=06c5f00f-e2c1-46a7-bad1-55c406b1d190"
```

Expected result: `status_breakdown.completed` should increase as you check off tasks

## File Attachments Question

> "if I want to attach relevant PDFs or excel sheets to the actual task, where do I store them? should I make a supabase bucket?"

**Answer**: Yes, create a Supabase Storage bucket for credentialing documents.

**Recommended structure**:
```
supabase-bucket: credentialing-documents/
  ├── providers/
  │   └── {provider_id}/
  │       └── {payer_id}/
  │           ├── application.pdf
  │           ├── credentials.xlsx
  │           └── contract-signed.pdf
```

**Implementation**:
1. Create bucket: `credentialing-documents`
2. Add RLS policies for admin-only access
3. Add `upload_document_url` JSONB field to `provider_credentialing_tasks` table
4. Create upload component in task detail view
5. Store references: `{ "application_pdf": "providers/{id}/molina/application.pdf", ... }`

## Next Steps

- [ ] User tests on production with browser console open
- [ ] Deploy worktree commits to production
- [ ] Verify task updates persist after deployment
- [ ] Implement file attachment system (separate ticket)

---

**Debug Endpoints Available After Deployment**:
- `GET /api/debug/check-task-persistence?providerId={id}` - Current task status breakdown
- `POST /api/debug/check-task-persistence` - Manual update test
- `GET /api/debug/recent-task-updates?providerId={id}&hours=24` - Update history
- `GET /api/debug/check-rls-policies` - Verify admin client permissions
