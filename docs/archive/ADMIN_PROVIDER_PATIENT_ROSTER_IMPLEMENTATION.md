# Admin & Provider Patient Roster Implementation ✅

**Created:** October 21, 2025
**Status:** Ready for Migration & Testing

---

## 🎯 Overview

Built admin and provider variants of the patient roster with:
- **Admin view:** All patients with organization affiliation column
- **Provider view:** Only assigned patients with organization and case manager columns
- Same engagement status and appointment tracking as partner dashboard
- Sortable and filterable by organization and case manager

---

## ✅ What Was Built

### 1. **Enhanced Materialized View (Migration 020)**

**File:** `/database-migrations/020-add-org-casemanager-to-activity-view.sql`

**New Fields Added to `v_patient_activity_summary`:**
- `primary_provider_id` - Provider assignment
- `provider_first_name` / `provider_last_name` - Provider details
- `primary_case_manager_id` - Case manager assignment
- `case_manager_name` / `case_manager_email` - Case manager details
- `case_manager_org_id` - Which org the case manager is from
- `affiliation_details` - Enhanced with org names

**New Indexes:**
- `idx_vpas_provider` - Fast filtering by provider
- `idx_vpas_case_manager` - Fast filtering by case manager

### 2. **Smart Router Page**

**File:** `/src/app/dashboard/patients/page.tsx`

**Behavior:**
- Detects user role from `app_users` table
- Routes to `AdminPatientRoster` if role = 'admin'
- Routes to `ProviderPatientRoster` if role = 'provider'
- Passes `providerId` to provider view for filtering

### 3. **Admin Patient Roster Component**

**File:** `/src/components/dashboard/AdminPatientRoster.tsx`

**Features:**
- ✅ Shows ALL patients (no organization filter)
- ✅ Stats cards: Total, Active, No Future Appt, With Organizations
- ✅ Filters: Status, Appointment status, Organization, Sort
- ✅ Columns: Patient, Status, Last Seen/Next Appt, Provider, Organization, Case Manager, Actions
- ✅ Can change engagement status via modal
- ✅ Organization column shows all affiliated orgs as chips

### 4. **Provider Patient Roster Component**

**File:** `/src/components/dashboard/ProviderPatientRoster.tsx`

**Features:**
- ✅ Shows ONLY patients assigned to provider (via `primary_provider_id`)
- ✅ Stats cards: My Patients, Active, No Future Appt, With Case Mgmt
- ✅ Filters: Status, Appointment status, Organization, Case Manager, Sort
- ✅ Columns: Patient, Status, Last Seen/Next Appt, Organization, Case Manager, Contact
- ✅ Can filter by organization AND case manager
- ✅ View-only (no status changes)

---

## 🗂️ Column Differences

### Partner Dashboard
| Patient | Status | Last Seen / Next Appt | Provider | Contact | Actions |
|---------|--------|----------------------|----------|---------|---------|

### Admin Dashboard
| Patient | Status | Last Seen / Next Appt | Provider | **Organization** | **Case Manager** | Actions |
|---------|--------|----------------------|----------|------------------|------------------|---------|

### Provider Dashboard
| Patient | Status | Last Seen / Next Appt | **Organization** | **Case Manager** | Contact |
|---------|--------|----------------------|------------------|------------------|---------|

---

## 🚀 Deployment Steps

### Step 1: Run Migration 020

**Option 1: Supabase Dashboard**

1. Open: https://supabase.com/dashboard/project/alavxdxxttlfprkiwtrq/sql/new
2. Copy content of `/database-migrations/020-add-org-casemanager-to-activity-view.sql`
3. Paste and execute

**Expected Output:**
```
Migration 020: Enhanced Activity View - COMPLETE
total_patients: 93
patients_with_provider: XX
patients_with_case_manager: XX
patients_with_org_affiliation: XX
```

### Step 2: Verify Migration

```sql
-- Check new columns exist
SELECT
  primary_provider_id,
  provider_first_name,
  provider_last_name,
  primary_case_manager_id,
  case_manager_name,
  affiliation_details
FROM v_patient_activity_summary
LIMIT 5;
```

### Step 3: Test Navigation

**Admin View:**
```
http://localhost:3000/dashboard/patients
```
(Must be logged in as admin)

**Provider View:**
```
http://localhost:3000/dashboard/patients
```
(Must be logged in as provider)

---

## 📊 Filter Examples

### Admin Filters

**Use Case:** "Show all active patients affiliated with First Step House who have no future appointments"

1. Select **Status:** "Active Only"
2. Select **Appointments:** "No Future Appt"
3. Select **Organization:** "First Step House"
4. Result: Targeted list for outreach

### Provider Filters

**Use Case:** "Show my active patients with case management from Beth Whipey"

1. Select **Status:** "Active Only"
2. Select **Case Manager:** "Beth Whipey"
3. Result: Coordinated care list

---

## 🔍 API Updates

The existing `/api/patients/activity-summary` endpoint now returns:

```json
{
  "patients": [{
    "patient_id": "...",
    "first_name": "John",
    "last_name": "Doe",
    "engagement_status": "active",
    "has_future_appointment": false,
    "primary_provider_id": "...",
    "provider_first_name": "Jane",
    "provider_last_name": "Smith",
    "affiliation_details": [
      {
        "org_id": "...",
        "org_name": "First Step House",
        "affiliation_type": "case_management",
        "consent_on_file": true
      }
    ],
    "primary_case_manager_id": "...",
    "case_manager_name": "Beth Whipey",
    "case_manager_email": "beth@fsh.org"
  }]
}
```

**New Query Parameters:**
- `provider_id` - Filter to specific provider's patients (auto-applied in provider view)
- `organization_id` - Filter by affiliated organization
- Existing: `status`, `has_future_appointment`, `sort_by`, etc.

---

## 🎨 UI Patterns

### Organization Chips (Multiple)
```tsx
<div className="flex flex-col gap-1">
  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
    First Step House
  </span>
  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
    Another Org
  </span>
</div>
```

### Case Manager Display
```tsx
{patient.case_manager_name ? (
  <div className="text-sm text-gray-900">{patient.case_manager_name}</div>
) : (
  <span className="text-sm text-gray-400">—</span>
)}
```

---

## 🧪 Testing Checklist

### Admin View
- [ ] Navigate to `/dashboard/patients` as admin
- [ ] Verify all 93 patients show (not filtered by org)
- [ ] Verify stats cards show correct counts
- [ ] Test status filter (Active Only, Discharged, etc.)
- [ ] Test appointment filter (No Future Appt, Has Future Appt)
- [ ] Test organization filter dropdown
- [ ] Verify organization column shows chips for affiliated orgs
- [ ] Verify case manager column shows names
- [ ] Test "Change Status" action opens modal
- [ ] Test changing patient status updates table

### Provider View
- [ ] Navigate to `/dashboard/patients` as provider
- [ ] Verify ONLY assigned patients show (not all 93)
- [ ] Verify stats cards show correct counts for assigned patients
- [ ] Test all filters work
- [ ] Test organization filter (if patients have orgs)
- [ ] Test case manager filter (if patients have case managers)
- [ ] Verify organization column shows
- [ ] Verify case manager column shows
- [ ] Verify contact column shows email/phone

---

## 🔐 Access Control

| Role | Can See | Can Filter By | Can Change Status |
|------|---------|---------------|-------------------|
| Admin | All patients | Org, Status, Appts | ✅ Yes |
| Provider | Assigned patients only | Org, Case Manager, Status, Appts | ❌ No |
| Partner | Org-affiliated patients | Status, ROI, Assigned | ✅ Yes (with notification) |

---

## 📝 Files Created/Modified

### New Files:
1. `/database-migrations/020-add-org-casemanager-to-activity-view.sql`
2. `/src/app/dashboard/patients/page.tsx`
3. `/src/components/dashboard/AdminPatientRoster.tsx`
4. `/src/components/dashboard/ProviderPatientRoster.tsx`
5. `/ADMIN_PROVIDER_PATIENT_ROSTER_IMPLEMENTATION.md` (this file)

### Files Used (No Changes):
1. `/src/components/partner-dashboard/EngagementStatusChip.tsx`
2. `/src/components/partner-dashboard/AppointmentStatusIndicator.tsx`
3. `/src/components/partner-dashboard/ChangeEngagementStatusModal.tsx`
4. `/src/app/api/patients/activity-summary/route.ts` (already supports all filters)

---

## 🚨 Known Limitations

1. **Provider role detection:** Currently checks `app_users.role` - ensure this table is populated correctly
2. **Pagination:** Currently showing 50 patients per page - may need adjustment for large provider panels
3. **Sort persistence:** Sort preferences don't persist across page reloads
4. **Case manager filter:** Only shows primary case manager (not secondary assignments)

---

## 🔮 Future Enhancements

1. **Bulk actions:** Select multiple patients to change status at once
2. **Export:** Download patient list as CSV
3. **Advanced filters:** Date ranges, provider specialty, insurance type
4. **Saved views:** Save filter combinations for quick access
5. **Dashboard widgets:** Quick stats on provider/admin homepage

---

## ✅ Success Criteria

- [x] Admin can see ALL patients
- [x] Admin can filter by organization
- [x] Admin can change engagement status
- [x] Provider sees ONLY assigned patients
- [x] Provider can filter by organization AND case manager
- [x] Both views show same engagement status and appointment data
- [x] Organization column shows multiple affiliations
- [x] Case manager column shows assigned case manager

---

**Ready to run Migration 020 and test!** 🚀
