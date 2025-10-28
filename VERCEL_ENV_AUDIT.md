# Vercel Environment Variables Audit

## ⚠️ CRITICAL - Must Be Set in Vercel

These are **required** for production booking to work:

### 1. Core Infrastructure
```bash
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_KEY=<your-service-role-key>
```

### 2. IntakeQ Integration (CRITICAL for questionnaire sending)
```bash
INTAKEQ_API_KEY=<your-40-char-api-key>
```
**⚠️ WARNING:** Next.js 15.5.4 has a bug that concatenates this with the next line. Ensure this is on its own line with nothing after it!

### 3. Email Service (Resend)
```bash
RESEND_API_KEY=<your-resend-key>
FROM_EMAIL=hello@trymoonlit.com
```

### 4. Feature Flags (V2.0 Booking System)
```bash
# NEWLY ADDED - MUST SET:
INTAKE_HIDE_NON_INTAKE_PROVIDERS=true

# Existing flags:
PRACTICEQ_ENRICH_ENABLED=true
PRACTICEQ_SEND_QUESTIONNAIRE_ON_CREATE=true
PRACTICEQ_ALIAS_EMAILS_FOR_DUPLICATES=true
BOOKING_AUTO_REFRESH_ENABLED=false
PRACTICEQ_DUPLICATE_ALERTS_ENABLED=false
```

### 5. Google Meet Integration (for telehealth appointments)
```bash
GOOGLE_MEET_SERVICE_ACCOUNT_KEY=<your-json-service-account-key>
GOOGLE_MEET_IMPERSONATE_EMAIL=hello@trymoonlit.com
GOOGLE_WORKSPACE_DOMAIN=trymoonlit.com
```
**⚠️ IMPORTANT:** The service account key is a JSON object. In Vercel, paste the entire JSON as a single line.

### 6. Public URLs
```bash
NEXT_PUBLIC_APP_URL=https://booking.trymoonlit.com
NEXT_PUBLIC_BASE_URL=https://booking.trymoonlit.com
NEXT_PUBLIC_BOOK_NAV_PATH=/book
```

### 7. Eligibility Checker (Optional)
```bash
NEXT_PUBLIC_ELIGIBILITY_CHECKER=https://eligibility.trymoonlit.com
```

---

## 🟡 OPTIONAL - Advanced Features

### Athena Integration (if using)
```bash
ATHENA_BASE_URL=<athena-api-url>
ATHENA_CLIENT_ID=<client-id>
ATHENA_CLIENT_SECRET=<secret>
ATHENA_ENVIRONMENT=production
ATHENA_PRACTICE_ID=<practice-id>
ATHENA_TOKEN_URL=<token-url>
ATHENA_WEBHOOK_SECRET=<webhook-secret>
ATHENA_MAX_RETRIES=3
ATHENA_REQUESTS_PER_SECOND=10
```

### UHIN Integration (if using)
```bash
UHIN_USERNAME=<username>
UHIN_PASSWORD=<password>
```

### Development/Debug
```bash
INTEGRATIONS_DEBUG_HTTP=false  # Set to true only for debugging
NODE_ENV=production  # Vercel sets this automatically
```

---

## 🔍 Variables NOT Found in .env.local But Used in Code

These are referenced in code but missing from your local env file:

1. **GOOGLE_MEET_SERVICE_ACCOUNT_KEY** - Used in `googleMeetService.ts`
2. **GOOGLE_MEET_IMPERSONATE_EMAIL** - Used in `googleMeetService.ts`
3. **GOOGLE_WORKSPACE_DOMAIN** - Used in `googleMeetService.ts`
4. **CALENDAR_TOKEN_SECRET** - Used somewhere in codebase
5. **CRON_SECRET** - Used for scheduled jobs
6. **TZ** - Timezone setting

**Action Required:** Check if these are set in Vercel!

---

## 🚨 Common Deployment Issues

### Issue 1: INTAKEQ_API_KEY Corruption
**Problem:** Next.js 15.5.4 bug concatenates API key with next line in env file
**Solution:**
- Ensure INTAKEQ_API_KEY is exactly 40 characters
- In Vercel, paste as single line with no trailing spaces
- Code has workaround to extract correct 40-char key

### Issue 2: Google Meet Service Account JSON
**Problem:** Multi-line JSON breaks in Vercel environment variables
**Solution:**
- Minify the JSON (remove all newlines)
- Paste as single line in Vercel
- Or use Vercel's file upload feature for secrets

### Issue 3: Feature Flags Default to FALSE
**Problem:** Feature flags not set → defaults to false → features disabled
**Solution:**
- Explicitly set ALL feature flags in Vercel
- Don't rely on defaults

### Issue 4: Public Variables Not Prefixed
**Problem:** Non-NEXT_PUBLIC_ vars won't be available in browser
**Solution:**
- Client-side code can only access NEXT_PUBLIC_* vars
- Server-side code can access all vars

### Issue 5: Environment-Specific URLs
**Problem:** Hardcoded localhost URLs in code
**Solution:**
- Always use `process.env.NEXT_PUBLIC_APP_URL`
- Set different values for Preview vs Production in Vercel

---

## ✅ Verification Checklist

After setting environment variables in Vercel:

- [ ] Redeploy the application (variables only apply on new deployments)
- [ ] Check `/api/debug/check-hmhi-bhn-providers` returns 3 providers (not 5)
- [ ] Test booking flow - ensure questionnaire is sent
- [ ] Test booking at 6 PM - verify appointment created at 6 PM (not noon)
- [ ] Check Google Meet link is generated for telehealth appointments
- [ ] Verify provider list shows only those accepting new patients
- [ ] Check Resend dashboard for sent emails

---

## 🔧 Quick Debugging Commands

### Check feature flags in deployed environment:
Create a debug endpoint:
```typescript
// /api/debug/feature-flags/route.ts
export async function GET() {
  return Response.json({
    INTAKE_HIDE_NON_INTAKE_PROVIDERS: process.env.INTAKE_HIDE_NON_INTAKE_PROVIDERS,
    PRACTICEQ_ENRICH_ENABLED: process.env.PRACTICEQ_ENRICH_ENABLED,
    // ... other flags
  })
}
```

### Check INTAKEQ_API_KEY length:
```bash
curl https://booking.trymoonlit.com/api/debug/intakeq-status
```

---

## 📝 Recommended Vercel Setup

### Environment Groups:
1. **All Environments** (Production + Preview + Development):
   - NEXT_PUBLIC_* variables
   - Feature flags

2. **Production Only**:
   - API keys (INTAKEQ_API_KEY, RESEND_API_KEY)
   - Secrets (SUPABASE_SERVICE_KEY)
   - Production URLs

3. **Preview Only**:
   - Test/staging API keys
   - Preview URLs
   - Debug flags (INTEGRATIONS_DEBUG_HTTP=true)

### Security Best Practices:
- ✅ Use Vercel's encrypted environment variables
- ✅ Rotate API keys regularly
- ✅ Use different keys for preview vs production
- ✅ Never commit secrets to git
- ✅ Use Vercel's secret masking in logs
