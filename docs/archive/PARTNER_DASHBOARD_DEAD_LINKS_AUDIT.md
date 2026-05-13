# Partner Dashboard - Dead Link Audit (Oct 16, 2025)

## Summary

Scanned all partner dashboard pages for dead-end links that lead to non-existent pages.

---

## Dead Links Found

### 1. ❌ Profile & Settings
- **Link:** `/partner-dashboard/profile`
- **Location:** PartnerHeader user dropdown menu
- **Visible to:** All users
- **File:** `src/components/partner-dashboard/PartnerHeader.tsx:111`

### 2. ❌ Notifications
- **Link:** `/partner-dashboard/notifications`
- **Location:** PartnerHeader user dropdown menu
- **Visible to:** All users
- **File:** `src/components/partner-dashboard/PartnerHeader.tsx:118`

### 3. ❌ Organization Settings
- **Link:** `/partner-dashboard/organization`
- **Location:** PartnerHeader user dropdown menu
- **Visible to:** Partner admins only
- **File:** `src/components/partner-dashboard/PartnerHeader.tsx:126`

### 4. ❌ Individual Patient Detail Page
- **Link:** `/partner-dashboard/patients/${patient.id}`
- **Location:** Patients page - patient name links
- **Visible to:** All users viewing patients list
- **File:** `src/app/partner-dashboard/patients/page.tsx:466`

---

## Working Links (No Issues)

### ✅ Dashboard Home
- **Link:** `/partner-dashboard`
- **Page exists:** Yes
- **Fully functional:** Yes

### ✅ Patients Roster
- **Link:** `/partner-dashboard/patients`
- **Page exists:** Yes
- **Fully functional:** Yes

### ✅ Calendar Subscription
- **Link:** `/partner-dashboard/calendar`
- **Page exists:** Yes
- **Fully functional:** Yes

### ✅ Logout
- **Link:** `/partner-auth/logout`
- **Page exists:** Yes
- **Fully functional:** Yes

---

## Recommendation

**Option 1: Remove all dead links (RECOMMENDED for MVP)**
- Remove Profile & Settings menu item
- Remove Notifications menu item
- Remove Organization Settings menu item
- Remove patient name links (or disable them)
- Keep only: Dashboard, Patients, Calendar, Logout

**Option 2: Build missing pages**
- Build Profile & Settings page (medium priority)
- Build Notifications page (medium priority)
- Build Organization Settings page (low priority - admin only)
- Build Patient Detail page (high priority - needed for patient management)

---

## Action Plan

**For MVP Launch:**
1. ✅ Remove Profile & Settings link from header dropdown
2. ✅ Remove Notifications link from header dropdown
3. ✅ Remove Organization Settings link from header dropdown
4. ✅ Disable patient name links (make them non-clickable, just display name)

**Post-MVP (Future Development):**
1. Build Patient Detail page (highest priority - needed for case management)
2. Build Profile & Settings page (user preferences, password change)
3. Build Notifications page (notification preferences and history)
4. Build Organization Settings page (admin-only features)

---

## Notes

- **Calendar page is complete** - Full calendar subscription functionality with iCal feed
- **Patients page is functional** - List, search, filter, transfer, and notify all working
- **Dashboard page is functional** - Stats cards, activity feed, navigation all working

**The only critical missing piece for full case management is the Patient Detail page.**

---

**Status:** ✅ Audit complete - 4 dead links identified
**Recommended action:** Remove dead links for clean MVP experience
**Date:** October 16, 2025
