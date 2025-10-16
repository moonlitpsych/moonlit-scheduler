# Partner Authentication Setup Guide

## Overview

Partner authentication system for Moonlit Scheduler V3.0 MVP, supporting:
- **Magic Link** authentication (passwordless)
- **Password** authentication (backwards compatible)
- **Persistent sessions** (configurable up to 365 days)
- **Role-based access** (partner_admin, partner_case_manager, partner_referrer)

## Authentication Flow

### Magic Link Flow (Recommended)

1. Partner user visits `/partner-auth/login`
2. Switches to "Magic Link" tab
3. Enters their organization email
4. Clicks "Send Magic Link"
5. API checks if user exists and is active
6. Supabase sends magic link email
7. User clicks link → redirected to `/api/partner-auth/callback`
8. Callback validates user → redirects to `/partner-dashboard`

### Password Flow (Legacy)

1. Partner user visits `/partner-auth/login`
2. Uses "Password" tab (default)
3. Enters email and password
4. System authenticates via Supabase Auth
5. Checks partner_users table for active record
6. Redirects to `/partner-dashboard`

## API Endpoints

### `POST /api/partner-auth/magic-link`
Send magic link to partner user email.

**Request:**
```json
{
  "email": "beth@firststephouse.org",
  "organization_slug": "first-step-house" // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Check your email for a magic link...",
  "data": {
    "email": "beth@firststephouse.org",
    "organization": "First Step House"
  }
}
```

### `GET /api/partner-auth/callback?code={code}`
Handles magic link callback after user clicks email link.

- Exchanges code for session
- Validates partner user record
- Updates last_login_at
- Logs audit entry
- Redirects to dashboard

### `POST /api/partner-auth/login`
Legacy password authentication endpoint (still supported).

### `GET /api/partner-auth/login`
Check current login status and get session info.

## Session Configuration

### Supabase Auth Settings

To enable persistent sessions lasting >90 days:

1. Go to Supabase Dashboard → **Authentication** → **Settings**
2. Update **JWT Expiry**:
   - Default: 3600 seconds (1 hour)
   - Recommended: 31536000 seconds (365 days)
3. Update **Refresh Token Lifetime**:
   - Default: 604800 seconds (7 days)
   - Recommended: 31536000 seconds (365 days)
4. Click **Save**

### Environment Variables

Required in `.env.local`:

```bash
# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL=https://alavxdxxttlfprkiwtrq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# App URL (for magic link callback)
NEXT_PUBLIC_APP_URL=https://www.trymoonlit.com
```

### Supabase Auth Email Templates

Customize magic link email in Supabase Dashboard → **Authentication** → **Email Templates** → **Magic Link**:

```html
<h2>Sign in to Moonlit Partner Portal</h2>
<p>Click the link below to sign in to your partner account:</p>
<p><a href="{{ .ConfirmationURL }}">Sign In</a></p>
<p>This link expires in 60 minutes.</p>
<p>If you didn't request this, you can safely ignore this email.</p>
```

## Database Schema

### partner_users table (relevant auth fields)

```sql
CREATE TABLE partner_users (
  id uuid PRIMARY KEY,
  auth_user_id uuid NOT NULL, -- Links to Supabase auth.users
  organization_id uuid NOT NULL REFERENCES organizations(id),
  email text NOT NULL,
  full_name text,
  role text NOT NULL, -- partner_admin | partner_case_manager | partner_referrer
  is_active boolean DEFAULT true,
  last_login_at timestamptz,
  email_verified boolean DEFAULT false,
  invitation_token text,
  invitation_expires timestamptz,
  invited_by uuid REFERENCES partner_users(id),
  notification_preferences jsonb,
  timezone text DEFAULT 'America/Denver',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## Security Features

### ROI (Release of Information) Access Control

Partners can only access patients with:
- Active affiliation (`patient_organization_affiliations.status = 'active'`)
- Valid ROI consent (`consent_on_file = true`)
- Non-expired consent (`consent_expires_on IS NULL OR > NOW()`)

See `checkPatientAccess()` in `/src/lib/partner-auth.ts`.

### Audit Logging

All partner logins are logged to `scheduler_audit_logs`:

```typescript
{
  user_identifier: partner_user_id,
  action: 'partner_login',
  resource_type: 'partner_user',
  details: {
    organization_id,
    organization_name,
    role,
    login_method: 'magic_link' | 'email_password'
  }
}
```

### Organization Status Checks

- User must be `is_active = true`
- Organization must be `status = 'active'`
- Both checked on every login

## Files Created/Updated

### New Files:
- `/src/app/api/partner-auth/magic-link/route.ts` - Magic link endpoint
- `/src/app/api/partner-auth/callback/route.ts` - Magic link callback handler
- `/PARTNER_AUTH_SETUP.md` - This documentation

### Updated Files:
- `/src/app/api/partner-auth/login/route.ts` - Fixed schema refs (is_active, full_name)
- `/src/app/partner-auth/login/page.tsx` - Added magic link UI toggle
- `/src/lib/partner-auth.ts` - Updated ROI consent checking
- `/src/types/partner-types.ts` - Updated PartnerUser interface

## Testing

### Test Magic Link (Local Dev)

1. Start dev server: `npm run dev`
2. Visit `http://localhost:3000/partner-auth/login`
3. Switch to "Magic Link" tab
4. Enter test partner email
5. Check terminal for magic link URL (if Resend not configured)
6. Copy URL and paste in browser
7. Should redirect to partner dashboard

### Test Partner User

Use Beth Whipey (First Step House) for testing:
- Email: Check `contacts` table for Beth's email
- Organization ID: `c621d896-de55-4ea7-84c2-a01502249e82`

## Next Steps

1. **Invitation Flow** - Build invite system for adding new partner users
2. **Patient Roster** - Build dashboard to view assigned patients
3. **ROI Management** - Build UI for uploading/managing ROI consent forms

## Support

Questions? Email hello@trymoonlit.com
