🛠️ Claude Debug + Test Playbook

This file contains debug commands, SQL snippets, and test checklists for Moonlit Scheduler.
Reference this file for troubleshooting, monitoring, and validation.

🔍 Logs & Monitoring
# Booking success/failure
grep "✅ Appointment created successfully" logs

# Double-booking prevention
grep "409" logs | grep "Time slot no longer available"

# IntakeQ API errors
grep "IntakeQ" logs | grep "❌"

# Email notifications
grep "📧" logs

🗄️ Database Checks
Appointment Volume
SELECT DATE(created_at), COUNT(*)
FROM appointments
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at);

Provider Availability
SELECT provider_id, COUNT(*) AS availability_records
FROM provider_availability_cache
WHERE date >= CURRENT_DATE
GROUP BY provider_id;

Contract Relationships
SELECT *
FROM v_bookable_provider_payer
WHERE provider_id = '...';

🚨 Common Fixes

Buttons not clickable

rm -rf .next && rm -rf node_modules/.cache
npm run dev


Missing provider availability

Check provider_availability_cache

Validate IntakeQ IDs in providers table

Appointments not showing in IntakeQ

Confirm API key and practitioner ID mapping

Verify authorization flow

Emails not sending

Check RESEND_API_KEY

Confirm FROM_EMAIL set correctly

Fallback: check server console logs

🧪 Testing Checklist

Booking flow works end-to-end (insurance → ROI → summary → confirmation).

Double-booking prevented (409 returned if slot already taken).

Appointment shows up in IntakeQ dashboard.

Admin email sent/logged on new booking.

Provider dashboard loads schedule correctly (via /api/providers/availability).

Dual-role context switch works (admin ↔ provider).

Partner login works separately from provider/admin.

📊 Debug Endpoints

/api/debug/bookability — explains why provider is/isn’t bookable.

/api/debug/availability-audit — slot + exception breakdown.

/api/debug/provider-network-analysis — shows payer contracts.

/api/debug/check-partner-tables — confirms correct CRM data source.

🕒 Date/Timezone Validation

Use safe formatting (no JS new Date() parsing):

import { formatDateSafe } from '@/lib/utils/dateFormatting'
// Ensures DB dates (YYYY-MM-DD) render correctly w/o TZ shift

✅ Quick References

Canonical view: v_bookable_provider_payer (source of truth for networks).

Provider visibility: list_on_provider_page + is_bookable.

Supervision model: residents bookable via attending billing providers.


Schedule API: all reads/writes go through /api/providers/availability (RLS bypass).
