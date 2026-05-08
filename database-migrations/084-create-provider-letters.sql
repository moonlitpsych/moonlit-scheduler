-- Migration 084: Provider letters
--
-- Adds a table to log every letter a provider generates from the provider
-- dashboard (proof of care, proof of care + diagnosis, coordination of care,
-- work-leave consideration). The PDF itself lives in the `provider-letters`
-- Supabase Storage bucket.
--
-- One-time setup (run separately in Supabase Studio if not already created):
--   storage bucket: `provider-letters` (private)

create table if not exists provider_letters (
  id                       uuid primary key default gen_random_uuid(),
  provider_id              uuid not null references providers(id),
  patient_id               uuid not null references patients(id),
  generated_by_user_id     uuid,                              -- auth.users.id (the admin if impersonating)
  letter_type              text not null check (letter_type in (
                              'proof_of_care',
                              'proof_of_care_with_dx',
                              'coordination_of_care',
                              'work_leave'
                            )),
  recipient_name           text,
  recipient_email          text,
  diagnosis_codes          text[] not null default '{}',     -- ICD-10 codes/labels as the provider entered them
  body_text                text not null,                    -- final edited body that was rendered into the PDF
  storage_path             text not null,                    -- key inside the `provider-letters` bucket
  emailed_at               timestamptz,
  emailed_to               text,
  created_at               timestamptz not null default now()
);

create index if not exists provider_letters_provider_idx
  on provider_letters (provider_id, created_at desc);

create index if not exists provider_letters_patient_idx
  on provider_letters (patient_id, created_at desc);
