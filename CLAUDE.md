
CLAUDE CODE: Moonlit Scheduler
🚨 Critical Development Policy

No mock data without explicit permission.

Never insert fake IntakeQ IDs, providers, or placeholder database rows.

Data integrity is critical — this is a healthcare application.

🌟 Project Status

Moonlit Scheduler = production-ready healthcare website + booking platform

Fully functional booking system (dual intent: Book Now vs See Availability).

Provider directory with real data and filtering.

Double-booking prevention + IntakeQ EMR integration.

Provider auth with admin/provider dual roles.

RLS-compliant schedule management API.

🏗️ System Architecture

Frontend: Next.js + TypeScript + Tailwind
Backend: Next.js API routes + Supabase Postgres
Auth: Supabase Auth (admin vs provider vs partner separation)
EHRs: IntakeQ + Athena integrations
Email: Resend API (logs to console if unset)

✅ Current Functionality

Website routes:

/ homepage

/book booking flow (?intent=book|explore)

/practitioners searchable provider directory

/ways-to-pay insurance directory

Booking flow: Welcome → Insurance → Calendar → ROI → Summary → Confirmation

APIs: availability, create appointment, providers-for-payer, ways-to-pay.

Features: real-time conflict checking, language selection, clinical supervision model, exception handling, dual-role login, partner authentication.

Status: All tested and working in production (as of Sept 12, 2025).

👨‍⚕️ Provider/Auth Rules

Dual-role support: e.g. Dr. C. Rufus Sweeney can switch between admin and provider dashboards.

Provider visibility: controlled by list_on_provider_page + is_bookable.

Supervision model: Residents bookable if supervised by attending (billing) provider.

RLS compliance: All provider schedule reads/writes go through admin-privileged API endpoints.

🔧 Development Setup
# Install dependencies
npm install

# Env vars (.env.local)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
INTAKEQ_API_KEY=...
RESEND_API_KEY=...

# Run locally
npm run dev


Always test locally before pushing (main auto-deploys).

Verify booking flow end-to-end on desktop + mobile.

🛠️ Common Tasks

Add EMR: create src/lib/services/[emr]Service.ts, update booking routes.

Emails: edit src/lib/services/emailService.ts.

Booking flow: modify src/components/booking/BookingFlow.tsx.

Admin/provider auth: see auth_profiles + app_users tables.

🔍 Troubleshooting

Welcome page buttons unclickable → clear .next + node_modules/.cache.

No availability → check provider_availability_cache, providers, payers.

Double-booking → validate IntakeQ IDs + conflict logic.

Appointments missing in IntakeQ → confirm API key + practitioner mapping.

Email not sending → check RESEND_API_KEY, otherwise see console logs.

📊 Monitoring

Audit API logs for 409 conflicts (double-booking prevention).

Track appointment creation rate in appointments table.

Use debug endpoints (/api/debug/...) for provider-payer relationships, availability, and bookability explanations.

📝 For Future Developers

Use canonical view v_bookable_provider_payer for provider-payer relationships.

Avoid direct Supabase client calls from frontend for protected tables → always use API endpoints.

Keep role separation clear: admin, provider, partner each have distinct routes and dashboards.

All production data must be real; confirm with Miriam before seeding.

Last updated: Sept 12, 2025
