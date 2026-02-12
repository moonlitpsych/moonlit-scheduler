# Referral Network System - Session Status

**Last Updated:** February 12, 2026
**Status:** ACTIVE - Payer gap analysis in progress

---

## Quick Start for Next Claude

### MCP Setup (REQUIRED)
The Supabase MCP server is configured. After restarting Claude Code, you should have access to:
- `mcp__supabase__execute_sql` - Run SQL queries directly
- `mcp__supabase__list_tables` - List database tables
- `mcp__supabase__apply_migration` - Apply migrations

**Config file:** `/Users/miriam/CODE/moonlit-scheduler/.mcp.json`

If MCP tools aren't available, the user will need to copy/paste SQL into the Supabase dashboard.

---

## System Overview

The Referral Network System generates referral resource documents based on patient payer and care needs. Admin staff select criteria (payer, care type, optional specialties) and receive a list of matching organizations - viewable on-screen and downloadable as a branded PDF.

### Key Files

| File | Purpose |
|------|---------|
| `src/app/admin/referral-network/page.tsx` | Main generator UI |
| `src/app/api/admin/referral-network/search/route.ts` | Search API |
| `src/app/api/admin/referral-network/generate-pdf/route.ts` | PDF generation |
| `src/components/admin/referral-network/ReferralOrganizationCard.tsx` | Org display card |
| `src/lib/pdf/ReferralListTemplate.tsx` | PDF template |
| `src/types/referral-network.ts` | TypeScript types |

### Database Tables

| Table | Purpose |
|-------|---------|
| `organizations` | Main org data (extended with `is_referral_destination`, `service_area`, etc.) |
| `organization_accepted_payers` | Which payers each org accepts |
| `organization_care_types` | Which care types each org provides |
| `organization_specialties` | Specialty capabilities |
| `referral_care_types` | Care type definitions |
| `referral_specialty_tags` | Specialty tag definitions |

---

## Current Progress (Feb 12, 2026)

### Completed Today

1. **Added `service_area` column** to organizations table for multi-location orgs
   - Updated `ReferralOrganization` type in `src/types/referral-network.ts`
   - Updated `ReferralOrganizationCard.tsx` to display service_area
   - Updated `ReferralListTemplate.tsx` for PDF output
   - Updated search API to include service_area in SELECT

2. **Added 40+ referral destinations** including:
   - Community mental health centers (Valley BH, Davis BH, Wasatch BH, Weber Human Services)
   - RTC/IOP/PHP facilities (Ardu, New Roads, Odyssey House, Recovery Ways, etc.)
   - LifeStance Health (7 Utah locations - therapy + outpatient psychiatry)
   - Treatment centers from user-provided images

3. **Fixed outpatient psychiatry gap** - Added care type to 8 community mental health centers

4. **Payer gap analysis** - Identified 22 payers missing therapy/psychiatry referrals

### Payer Linking Completed

| Payer | Organizations Linked |
|-------|---------------------|
| DMBA | LifeStance Health |
| Health Choice Utah | Davis BH, Valley BH, Wasatch BH, Weber Human Services |

### Payer Research In Progress

| Payer | Status | Notes |
|-------|--------|-------|
| HealthyU (UUHP) | IN PROGRESS | LifeStance confirmed in-network |
| HMHI BHN | PENDING | Huntsman Mental Health Institute network |
| MotivHealth | PENDING | |
| Optum Commercial | PENDING | |
| First Health Network | PENDING | |
| U of U Health Plans | PENDING | |

---

## Key SQL Queries

### Find payers with no therapy/psychiatry referrals
```sql
SELECT p.id, p.name
FROM payers p
WHERE NOT EXISTS (
  SELECT 1 FROM organization_accepted_payers oap
  JOIN organization_care_types oct ON oct.organization_id = oap.organization_id
  JOIN referral_care_types rct ON rct.id = oct.care_type_id
  WHERE oap.payer_id = p.id
    AND oap.is_active = true
    AND oct.is_active = true
    AND rct.name IN ('therapy', 'outpatient_psychiatry')
)
ORDER BY p.name;
```

### Find referral destinations
```sql
SELECT id, name, service_area, city, state
FROM organizations
WHERE is_referral_destination = true
ORDER BY name;
```

### Link a payer to an organization
```sql
INSERT INTO organization_accepted_payers (organization_id, payer_id, is_active, notes)
VALUES ('org-uuid', 'payer-uuid', true, 'Verified Feb 2026')
ON CONFLICT (organization_id, payer_id) DO NOTHING;
```

### Add care type to organization
```sql
INSERT INTO organization_care_types (organization_id, care_type_id, is_active)
SELECT 'org-uuid', id, true
FROM referral_care_types
WHERE name = 'outpatient_psychiatry'
ON CONFLICT (organization_id, care_type_id) DO NOTHING;
```

---

## Research Process

When researching payers for referral options:

1. **Search for in-network providers** using web search
2. **Verify each organization** before adding - user explicitly requested: "please confirm by researching them one by one. we need to be sure we're accurate here -- do not guess."
3. **Check if org exists** in database before creating new records
4. **Link payer to existing orgs** when possible

### Confirmed In-Network Sources

| Organization | Payers Accepted |
|--------------|-----------------|
| LifeStance Health | DMBA, University of Utah Health Plans, UUHP Medicaid |
| Valley Behavioral Health | Medicaid (various MCOs), Health Choice Utah |
| Davis Behavioral Health | Medicaid (various MCOs), Health Choice Utah |
| Wasatch Behavioral Health | Medicaid (various MCOs), Health Choice Utah |
| Weber Human Services | Medicaid (various MCOs), Health Choice Utah |

---

## Multi-Location Organizations

These orgs have `service_area` set instead of single city:

| Organization | Service Area |
|--------------|--------------|
| Davis Behavioral Health | Bountiful, Layton, Syracuse |
| Valley Behavioral Health | Salt Lake City, Taylorsville, Kearns, West Valley |
| Wasatch Behavioral Health | Provo, Orem, Spanish Fork, American Fork |
| Weber Human Services | Ogden, Roy, Clearfield |
| LifeStance Health | Salt Lake City, Sandy, Draper, Lehi, Orem, Ogden, Logan |
| Odyssey House | Salt Lake City, Magna, Martindale |
| VOA Cornerstone | Salt Lake City, Midvale, Ogden |
| Recovery Ways | Murray, Salt Lake City |
| First Step House | Salt Lake City, Midvale |

---

## Next Steps

1. **Complete payer research** for remaining 6 payers
2. **Link LifeStance to HealthyU/UUHP** (confirmed in-network)
3. **Research HMHI BHN network** - may need to add Huntsman Mental Health Institute
4. **Test PDF generation** with new service_area display

---

## Original Implementation Plan

See `/Users/miriam/.claude/plans/kind-beaming-hammock.md` for the full system design and architecture decisions.
