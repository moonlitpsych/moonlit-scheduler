# Dual-Role Authentication System

This document explains how the dual-role authentication system works for users who have both Admin and Provider roles.

## Overview

The dual-role system allows a single user account to access both Admin and Provider dashboards with context switching. This is particularly useful for healthcare providers who also perform administrative duties.

## How It Works

### 1. Role Detection

The system detects available roles through:

- **Admin Role**: Checked via email address against `ADMIN_EMAILS` array in `/src/lib/admin-auth.ts`
- **Provider Role**: Checked by querying `providers` table for `auth_user_id` match

### 2. Context Selection

When a user with multiple roles logs in:

1. **Single Role**: Direct redirect to appropriate dashboard
2. **Multiple Roles**: Redirect to `/choose-context` page with role selection options

### 3. Session Management

- **Active Context**: Stored in `sessionStorage` and `localStorage` 
- **Persistence**: Context preference survives browser refreshes and new sessions
- **Switching**: Users can switch contexts via header menu without re-login

## Current Schema Compatibility

Since the database doesn't have a dedicated user-roles junction table, the system uses:

- **Email-based admin detection** (temporary solution)
- **Direct provider linking** via `providers.auth_user_id` foreign key

## Implementation Details

### Core Files

- `/src/lib/auth-context.ts` - Context management and role detection
- `/src/lib/route-guards.ts` - Route access control
- `/src/components/auth/ContextSwitcher.tsx` - UI component for switching contexts
- `/src/app/choose-context/page.tsx` - Role selection interface

### API Endpoints

- `POST /api/admin/setup-rufus-dual-role` - Setup dual roles for Dr. Rufus Sweeney
- `GET /api/admin/setup-rufus-dual-role` - Check dual role status

### Route Protection

Protected routes automatically check:
- User authentication
- Role availability  
- Active context match

## Setting Up Dual Roles

### For Dr. Rufus Sweeney (Current Implementation)

```bash
# Check current status
curl http://localhost:3000/api/admin/setup-rufus-dual-role

# Setup dual roles (idempotent)
curl -X POST http://localhost:3000/api/admin/setup-rufus-dual-role
```

### Manual Setup Process

1. **Ensure provider record exists** with correct `auth_user_id`
2. **Add to admin emails list** in `/src/lib/admin-auth.ts`
3. **Update user metadata** (optional) to include role information

## User Experience

### Login Flow

1. User enters credentials at `/auth/login`
2. System detects available roles
3. **Single role**: Direct redirect to dashboard
4. **Multiple roles**: Context selection at `/choose-context`

### Context Switching

1. Click user menu in header (Admin or Provider dashboard)
2. Select alternate role from dropdown
3. Immediate redirect to other dashboard
4. Context preference saved for future sessions

### Visual Indicators

- **Admin Dashboard**: Dark blue sidebar with admin-specific navigation
- **Provider Dashboard**: Provider-specific header with appointment management
- **Context Switcher**: Shows current role and available alternatives

## Security Considerations

- **Route Guards**: Prevent access to unauthorized areas based on active context
- **Session Isolation**: Each context maintains separate permissions
- **Logout**: Clears all stored context data

## Future Migration Path

For true multi-role support, consider implementing:

```sql
-- User roles junction table
CREATE TABLE user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL CHECK (role_name IN ('admin', 'provider')),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  UNIQUE(auth_user_id, role_name)
);
```

This would enable:
- Dynamic role assignment
- Audit trail of role changes
- Support for additional roles beyond admin/provider
- Fine-grained permission control

## Troubleshooting

### User Not Seeing Context Chooser

1. Check email in `ADMIN_EMAILS` array
2. Verify `providers.auth_user_id` is correctly set
3. Check browser console for role detection logs

### Context Switch Not Working

1. Verify user has access to target role
2. Check session storage for context preference
3. Review route guard logic for target dashboard

### Provider Data Not Loading

1. Confirm `providers.is_active = true`
2. Check `auth_user_id` matches authenticated user
3. Verify database connection and query permissions

## Testing

### Test Scenarios

1. **Single Role User**: Should go directly to their dashboard
2. **Dual Role User**: Should see context chooser
3. **Context Switching**: Should work without re-authentication
4. **Route Protection**: Should enforce context-based access
5. **Logout**: Should clear all context data

### Test Users

- **Admin Only**: `hello@trymoonlit.com`
- **Provider Only**: Most provider emails in system
- **Dual Role**: `rufussweeney@gmail.com` (Dr. C. Rufus Sweeney)

## Configuration

### Environment Variables

No additional environment variables required. Uses existing Supabase configuration.

### Feature Toggles

Context switching is automatically enabled for users with multiple roles. No feature flags needed.