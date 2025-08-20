# 🚨 CLAUDE CODE: PRIORITY MISSION - Moonlit Scheduler Integration

## CRITICAL CONTEXT
You are working on Moonlit Scheduler, a Next.js/TypeScript healthcare booking platform. The app has a booking widget that should show merged provider availability, but it's currently broken due to a Supabase connection issue. Additionally, we need to integrate Athena Health's EMR API.

## 🔴 PRIORITY 1: Fix Supabase Database Connection (URGENT)

### The Problem
When users select a payer/insurance in the booking flow, the calendar shows no availability even though the data EXISTS in Supabase. The service layer is not properly fetching from the database.

### Your Mission
1. **Diagnose the connection issue** between the app and Supabase
2. **Fix the data fetching** so real provider availability shows on the calendar
3. **Test the booking flow** end-to-end

### Investigation Steps

#### Step 1: Check Supabase Connection
```typescript
// Check these files first:
// src/lib/supabase.ts or src/lib/supabaseClient.ts
// Look for connection initialization

// The connection should look like:
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

#### Step 2: Find & Fix the Availability Service
Look for files that handle availability fetching. Common locations:
- `src/lib/services/availabilityService.ts`
- `src/app/api/availability/route.ts`
- `src/lib/services/payerStatus.ts`
- `src/lib/services/eligibilityService.ts`

The service SHOULD be doing something like:
```typescript
// This is what SHOULD be happening
async function getProviderAvailability(payerId: string, date: Date) {
  const { data, error } = await supabase
    .from('provider_availability_cache')
    .select(`
      *,
      providers!inner(
        id,
        firstname,
        lastname,
        provider_payers!inner(
          payer_id
        )
      )
    `)
    .eq('providers.provider_payers.payer_id', payerId)
    .gte('date', date.toISOString())
    .order('date', { ascending: true })

  if (error) {
    console.error('Supabase error:', error)
    return []
  }
  
  return data
}
```

#### Step 3: Check the API Routes
Navigate to `src/app/api/` and check:
1. **`/api/eligibility`** - Should return eligible providers for a payer
2. **`/api/availability`** - Should return merged availability slots

These endpoints MUST:
- Have proper error handling
- Log errors to console
- Actually query the Supabase database
- Return real data, not mock data

#### Step 4: Verify Database Schema
The Supabase tables you need to work with:
```sql
-- Key tables that must exist and have data:
-- providers: id, firstname, lastname, npi, specialty
-- payers: id, name, payer_type, state
-- provider_payers: provider_id, payer_id, effective_date
-- provider_availability_cache: provider_id, date, available_slots (JSONB)
-- appointments: id, provider_id, start_time, end_time, patient_info
```

#### Step 5: Debug Checklist
Run these checks in order:
```bash
# 1. Check environment variables are set
grep SUPABASE .env.local

# 2. Test Supabase connection directly
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
supabase.from('providers').select('*').limit(1).then(console.log);
"

# 3. Check if the API routes are working
curl http://localhost:3000/api/eligibility -X POST \
  -H "Content-Type: application/json" \
  -d '{"payerId": "test-payer-id"}'

# 4. Check browser console for errors
# Open Developer Tools > Console while using the booking widget
```

### The Fix You Need to Implement

1. **Find where availability is fetched** (likely in a service or API route)
2. **Replace any mock data returns with actual Supabase queries**
3. **Ensure proper joins** between tables (providers ↔ provider_payers ↔ payers)
4. **Add comprehensive error logging**
5. **Test with a real payer ID from the database**

### Success Criteria
✅ When a user selects a payer, the calendar shows available time slots
✅ The slots come from the `provider_availability_cache` table
✅ Only providers who accept that payer are shown
✅ Console shows successful database queries, not errors

---

## 🔵 PRIORITY 2: Integrate Athena Health API

### Athena Credentials (From Email)
```javascript
// Add these to .env.local
ATHENA_CLIENT_ID=0oayjgww1d3d5l12l297
ATHENA_CLIENT_SECRET=[YOU NEED TO GET THIS FROM USER]
ATHENA_BASE_URL=https://api.athenahealth.com/v1/3409601
ATHENA_TOKEN_URL=https://api.athenahealth.com/oauth2/v1/token
ATHENA_PRACTICE_ID=3409601
ATHENA_PREVIEW_ID=3409601
ATHENA_SERVICE_ID=PROJ-294665
```

### Integration Tasks

#### Task 1: Set Up Athena Service
Create or update `src/lib/services/athenaService.ts`:
```typescript
class AthenaService {
  private token: string | null = null
  private tokenExpiry: Date | null = null

  async getToken() {
    // Implement OAuth2 flow
    // Use ATHENA_CLIENT_ID and ATHENA_CLIENT_SECRET
    // Cache token until expiry
  }

  async syncProviders() {
    // Fetch providers from Athena
    // Update Supabase providers table
  }

  async createAppointment(data: AppointmentData) {
    // Create appointment in Athena
    // Store Athena ID in Supabase
  }

  async syncAvailability(providerId: string) {
    // Get open slots from Athena
    // Update provider_availability_cache
  }
}
```

#### Task 2: Create Sync Scripts
Add these npm scripts to `package.json`:
```json
{
  "scripts": {
    "athena:sync": "tsx scripts/sync-athena-data.ts",
    "athena:test": "tsx scripts/test-athena-connection.ts"
  }
}
```

#### Task 3: Implement Webhook Handler
Create `src/app/api/webhooks/athena/route.ts`:
```typescript
export async function POST(request: Request) {
  // Verify webhook signature
  // Process Athena events (appointment updates, etc.)
  // Update local database accordingly
}
```

#### Task 4: Connect to Booking Flow
Update the booking service to:
1. Create patient in Athena when booking
2. Create appointment in Athena
3. Store Athena IDs in Supabase
4. Handle cancellations in both systems

---

## 📋 File Structure Reference

```
moonlit-scheduler/
├── src/
│   ├── lib/
│   │   ├── supabase.ts              ← CHECK THIS FIRST
│   │   ├── services/
│   │   │   ├── availabilityService.ts ← FIX THIS
│   │   │   ├── eligibilityService.ts  ← FIX THIS
│   │   │   ├── bookingService.ts      ← UPDATE THIS
│   │   │   ├── athenaService.ts       ← CREATE THIS
│   │   │   └── payerStatus.ts
│   │   └── utils/
│   ├── app/
│   │   ├── api/
│   │   │   ├── availability/route.ts  ← FIX THIS
│   │   │   ├── eligibility/route.ts   ← FIX THIS
│   │   │   ├── appointments/route.ts  ← UPDATE THIS
│   │   │   └── webhooks/
│   │   │       └── athena/route.ts    ← CREATE THIS
│   │   └── widget/                    ← Test here
│   └── components/
│       └── booking/                    ← UI components
├── scripts/
│   ├── test-athena-connection.ts      ← CREATE THIS
│   └── sync-athena-data.ts           ← CREATE THIS
├── .env.local                         ← UPDATE THIS
└── supabase/
    └── migrations/                     ← Check schema
```

---

## 🎯 Definition of Done

### Phase 1: Supabase Fix (DO THIS FIRST!)
- [ ] Calendar shows real availability when payer is selected
- [ ] No errors in browser console
- [ ] API routes return real data from Supabase
- [ ] Can complete a test booking end-to-end

### Phase 2: Athena Integration
- [ ] Can authenticate with Athena API
- [ ] Can fetch providers from Athena
- [ ] Can create appointments in Athena
- [ ] Webhook handler processes Athena events

---

## 🚨 IMPORTANT NOTES

1. **Database is already populated** - The Supabase database HAS data. Don't create mock data, FIX the connection.

2. **The user is NOT a developer** - Provide clear terminal commands and explain where files are located.

3. **Test everything** - After each fix, test the booking widget in the browser.

4. **Athena is sandbox** - Using Preview ID 3409601, expires in 6 months.

5. **Focus order**:
   - FIRST: Fix Supabase connection (Priority 1)
   - THEN: Integrate Athena (Priority 2)

---

## 🔧 Quick Debug Commands

```bash
# Test Supabase connection
npm run dev
# Open http://localhost:3000/widget
# Open DevTools Console (F12)
# Try selecting a payer and watch for errors

# Check Supabase data
npx supabase db dump --data-only | grep provider_availability_cache

# Test API endpoints
curl http://localhost:3000/api/availability

# Check environment variables
cat .env.local | grep SUPABASE

# View recent logs
npm run dev 2>&1 | tee debug.log
```

---

## 💬 Communication Style
- Explain issues in non-technical terms
- Provide exact file paths and line numbers
- Show before/after code examples
- Give clear terminal commands
- Test and confirm each fix works

START WITH PRIORITY 1: Fix the Supabase connection so the calendar shows availability!