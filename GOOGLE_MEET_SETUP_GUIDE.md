# Google Meet Link Generation Setup Guide

**Date:** October 27, 2025
**Status:** Ready for Configuration

---

## 🎯 Overview

We've built a system to automatically generate Google Meet links for telehealth appointments. Since IntakeQ's API doesn't expose the Google Meet links they show in their UI, we generate our own using the Google Meet REST API.

---

## 🔧 Setup Instructions

### Step 1: Enable Google Meet REST API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (or create one called "Moonlit PLLC")
3. Go to **APIs & Services → Library**
4. Search for "**Google Meet REST API**"
5. Click **Enable**

### Step 2: Create Service Account

1. In Google Cloud Console, go to **IAM & Admin → Service Accounts**
2. Click **Create Service Account**
3. Name: `moonlit-meet-service`
4. Description: "Service account for generating Google Meet links"
5. Click **Create and Continue**
6. Skip role assignment for now (we'll use domain-wide delegation)
7. Click **Done**

### Step 3: Download Service Account Key

1. Click on your new service account
2. Go to **Keys** tab
3. Click **Add Key → Create New Key**
4. Choose **JSON**
5. Save the file as `service-account-key.json`

### Step 4: Enable Domain-Wide Delegation

1. In [Google Workspace Admin Console](https://admin.google.com)
2. Go to **Security → Access and data control → API controls**
3. Click **Manage Domain Wide Delegation**
4. Click **Add new**
5. Enter the **Client ID** from your service account (find it in the JSON key file)
6. Add these OAuth scopes:
   ```
   https://www.googleapis.com/auth/meetings.space.created
   https://www.googleapis.com/auth/meetings.space.readonly
   ```
7. Click **Authorize**

### Step 5: Configure Environment Variables

1. Convert your service account key to base64:
   ```bash
   base64 -i service-account-key.json | tr -d '\n'
   ```

2. Add to your `.env.local`:
   ```env
   # Google Meet API
   GOOGLE_MEET_SERVICE_ACCOUNT_KEY=<paste-base64-string-here>
   GOOGLE_WORKSPACE_DOMAIN=trymoonlit.com
   GOOGLE_MEET_IMPERSONATE_EMAIL=hello@trymoonlit.com
   ```

---

## 🧪 Testing

### Test 1: Verify Configuration

```bash
curl http://localhost:3000/api/debug/test-google-meet
```

Expected response:
```json
{
  "success": true,
  "message": "Google Meet Service is properly configured",
  "details": {
    "domain": "trymoonlit.com",
    "impersonateEmail": "hello@trymoonlit.com",
    "hasServiceAccount": true
  }
}
```

### Test 2: Generate Test Meeting Link

```bash
curl -X POST http://localhost:3000/api/debug/test-google-meet
```

Expected response:
```json
{
  "success": true,
  "message": "Successfully generated Google Meet link",
  "data": {
    "meetingUrl": "https://meet.google.com/xxx-xxxx-xxx",
    "appointmentId": "test-1234567890",
    "appointmentTime": "2025-10-28T12:00:00.000Z",
    "note": "This is a test meeting space. You can join it to verify it works."
  }
}
```

### Test 3: Sync with Meet Link Generation

1. Log in to partner dashboard
2. Click "Refresh All Appointments"
3. Check the database for generated links:

```sql
-- Check appointments with Google Meet links
SELECT
  a.id,
  a.start_time,
  a.meeting_url,
  a.location_info,
  p.first_name || ' ' || p.last_name as patient_name
FROM appointments a
LEFT JOIN patients p ON a.patient_id = p.id
WHERE a.meeting_url IS NOT NULL
  AND a.meeting_url LIKE 'https://meet.google.com/%'
ORDER BY a.updated_at DESC
LIMIT 10;
```

---

## 🚀 Production Deployment

1. **Set environment variables in Vercel:**
   - `GOOGLE_MEET_SERVICE_ACCOUNT_KEY`
   - `GOOGLE_WORKSPACE_DOMAIN`
   - `GOOGLE_MEET_IMPERSONATE_EMAIL`

2. **Deploy:**
   ```bash
   git push origin main
   ```

3. **Test in production:**
   ```bash
   curl https://booking.trymoonlit.com/api/debug/test-google-meet
   ```

---

## 📊 How It Works

1. **During Sync:** When syncing appointments from IntakeQ
2. **Check Location:** If `PlaceOfService` is `02` or `10` (telehealth codes)
3. **Check Meeting URL:** If no meeting URL exists
4. **Generate Link:** Create a new Google Meet space
5. **Store:** Save the generated link in `appointments.meeting_url`
6. **Display:** Case managers see the link in partner dashboard

---

## ⚠️ Troubleshooting

### Error: "Permission denied (403)"
- Ensure Google Meet REST API is enabled
- Check domain-wide delegation is configured
- Verify OAuth scopes are correct

### Error: "Authentication failed (401)"
- Service account key may be incorrect
- Check base64 encoding was done properly
- Ensure no line breaks in the base64 string

### No meeting links generated
- Verify appointments have PlaceOfService = '02' or '10'
- Check logs during sync for errors
- Ensure GOOGLE_MEET_* environment variables are set

---

## 🔒 Security Notes

- Meeting spaces are created with `TRUSTED` access type (domain users only)
- Each appointment gets a unique meeting space
- Meeting links are persistent (don't expire)
- Consider implementing meeting cleanup for past appointments

---

## 📝 Next Steps

### Phase 2: Provider Migration (Recommended)
1. Create Google Workspace accounts for each provider
2. Update IntakeQ to use those accounts
3. Sync both our generated links AND IntakeQ's links

### Future Enhancements
- Auto-end meeting spaces after appointments
- Add calendar invites with meeting links
- Implement meeting recording integration
- Add participant tracking

---

**Questions?** Contact miriam@trymoonlit.com