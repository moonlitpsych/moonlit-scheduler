# Moonlit Referral Network — Ingest Guide

How to ingest referral-destination data (PDFs, screenshots, text, spreadsheets)
into the database. Keep this short; details live in the migration templates and
the live DB.

## What this system is for

Tracking organizations Moonlit refers patients to (or that refer patients to
Moonlit), the payers they accept, the care types they offer, and clinical /
population / administrative tags. Surfaces in `/admin/referral-network` (admin
editor + search) and `/dashboard/referrals` (provider search + PDF generation).

**Not for booking-flow validation.** Plan- and provider-level booking gates
live elsewhere — see `CLAUDE.md` → "NO PLAN VALIDATION IN BOOKING FLOW".

## Tables

- `organizations` — entities. No unique constraint on `name`; granularity is
  inconsistent (acronyms, parent-in-parens sub-locations, full names coexist).
- `organization_accepted_payers` — org ↔ payer.
- `organization_care_types` — org ↔ `referral_care_types`.
- `organization_specialties` — org ↔ `referral_specialty_tags` (category =
  clinical | population | administrative).
- `organization_aliases` — alternate names for acronym matching. Underused
  today; populate it as you encounter aliases.

No app code changes are needed for ingests — the UI reads these tables live.

## Invariants

1. **Catalog tables are admin-UI-seeded, not migration-seeded.** Always query
   the live DB for canonical names BEFORE drafting link migrations:
   ```sql
   SELECT name, display_name, tag_category FROM referral_specialty_tags
     ORDER BY tag_category, name;
   SELECT name, display_name FROM referral_care_types ORDER BY name;
   ```
   Use the canonical names you see. Add new ones via `WHERE NOT EXISTS`; never
   create parallel-but-differently-named tags for the same concept.

2. **Dedupe before insert.** Existing rows are inconsistent. Always produce a
   read-only dedupe report and let the user review before any writes.

3. **Fill blanks, never overwrite.** When updating an existing org, use
   `COALESCE(existing, new_value)` so admin-curated data is preserved.

4. **Stable payer IDs** — confirm the payer row before linking. Optum Medicaid
   (`67352284-5037-4514-8663-99859ff8b06b`) ≠ Optum Commercial BH
   (`c9a7e516-4498-4e21-8f7c-b359653d2d69`). Other payers: query the `payers`
   table.

## Standard four-migration workflow

Name them `NNN`, `NNNa`, `NNNb`, `NNNc` where `NNN` is the next migration
number under `database-migrations/`:

| File | Purpose | Template |
|---|---|---|
| `NNN-…` | Seed any **new** care types / specialty tags this ingest needs | `086-seed-referral-care-types-and-specialty-tags.sql` |
| `NNNa-…` | **Read-only** dedupe report — joins incoming names against `organizations` | `086a-optum-tooele-dedupe-report.sql` |
| `NNNb-…` | INSERT new orgs (WHERE NOT EXISTS) + UPDATE exact matches (COALESCE) | `086b-insert-optum-tooele-orgs.sql` |
| `NNNc-…` | Link orgs → payer + care types + specialty tags | `086c-link-optum-tooele-relationships.sql` |

All idempotent. Run order: catalog seed → dedupe (user reviews) → org inserts
→ relationship links. Each migration self-documents its source (e.g. "Optum
Tooele County Provider Resource Guide rev 3.26.2026").

## Input-format playbook

- **PDF**: `Read` with `pages: "1-N"`. Quote source title + revision date in
  the migration header.
- **Screenshot / image**: User pastes inline; read with vision. Ask about
  cut-off rows.
- **Plain text / pasted list**: Parse directly. Confirm column meaning with the
  user before writing inserts.
- **Spreadsheet**: Ask for a path or paste — never assume column order.

For every org, try to extract: name, address, city, state, postal code, phone,
fax, email, website, hours, target population, care types / ASAM levels / MAT
meds, intake-process notes, contact person.

## Verification (run after the link migration)

```sql
-- All ingested orgs linked to the payer?
SELECT count(*) FROM organization_accepted_payers
WHERE payer_id = '<payer_id>' AND is_active;

-- Spot-check a care type:
SELECT o.name FROM organizations o
JOIN organization_care_types oct ON oct.organization_id = o.id
JOIN referral_care_types ct ON ct.id = oct.care_type_id
WHERE ct.name = '<care_type_name>' ORDER BY o.name;

-- Spot-check a clinical tag:
SELECT o.name FROM organizations o
JOIN organization_specialties os ON os.organization_id = o.id
JOIN referral_specialty_tags st ON st.id = os.specialty_tag_id
WHERE st.name = '<tag_name>' ORDER BY o.name;
```

## Working with Miriam

She runs each migration herself via the Supabase SQL editor. Copy the file to
clipboard with `pbcopy < database-migrations/NNN-…sql` and paste back the
result. Stage migrations small enough to verify between runs — don't bundle.

## Known data-quality notes (extend as discovered)

- Three rows for VOA-ish entities: `VOA` (SL County RTC), `Volunteers of
  America Utah` (LAI clinic), `VOA Homeless Youth` (shelter at 888 S 400 W).
  Same parent org, three legitimate program rows.
- `Martindale Clinic (Odyssey House)` is one outpatient site; the umbrella
  `Odyssey House` row was added 2026-05-26 for the broader services.
- Generic catalog entries (`case_management`, `intensive_outpatient`,
  `residential`, `substance_use_treatment`) coexist with age- and acuity-specific
  ones (`adult_case_management`, `sud_iop`, etc.). Prefer the specific.
