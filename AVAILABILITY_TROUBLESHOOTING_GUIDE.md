# 🔧 Availability Troubleshooting Guide for Moonlit Scheduler

## Overview

This guide explains how the calendar availability system works and provides step-by-step troubleshooting for the common "No available time slots" issue.

## 🏗️ How Calendar Availability Works

### System Architecture

```
Frontend (CalendarView) 
    ↓ (API calls)
Backend APIs 
    ↓ (data queries)
Supabase Database + IntakeQ Integration
```

### Complete Flow Breakdown

1. **User selects insurance** → System gets `payer_id`
2. **User selects date** → System calls availability API
3. **API checks provider-payer relationships** → Only providers who accept that insurance
4. **API queries availability cache** → Base availability records for those providers  
5. **API checks IntakeQ conflicts** → Remove already-booked slots
6. **Frontend receives slots** → Displays available times

## 📊 API Flow Chart

```
CalendarView component
    ↓
    fetchAvailabilityForDate(date)
    ↓
POST /api/patient-booking/merged-availability
    ↓
1. Get bookable providers for payer
    ↓ Query: v_bookable_provider_payer WHERE payer_id = ?
    ↓
2. Get base availability records  
    ↓ Query: provider_availability_cache WHERE provider_id IN (...)
    ↓
3. Generate time slots from availability windows
    ↓
4. Check IntakeQ conflicts (with rate limiting & caching)
    ↓ IntakeQ API: GET /appointments (filtered by practitioner & date)
    ↓  
5. Return final available slots
    ↓
Frontend: setAvailableSlots(convertedSlots)
```

## 🚨 Common Issues & Solutions

### Issue 1: "No available time slots for this date"

**Symptoms:** Calendar shows loading, then displays "No available time slots" message.

**Root Causes (in order of likelihood):**

#### A. No Provider-Payer Relationships
```bash
# Check if any providers accept this insurance
curl -X POST "http://localhost:3000/api/patient-booking/providers-for-payer" \
  -H "Content-Type: application/json" \
  -d '{"payer_id": "PAYER_ID", "language": "English"}'

# Expected response: {"success": true, "data": {"providers": [...], "total_providers": X}}
# If total_providers = 0: No providers accept this insurance
```

**Fix:** Update `v_bookable_provider_payer` view or underlying tables (`provider_payer_networks`, `supervision_relationships`).

#### B. No Availability Data for Date
```bash  
# Check base availability records
curl -X POST "http://localhost:3000/api/patient-booking/merged-availability" \
  -H "Content-Type: application/json" \
  -d '{"payer_id": "PAYER_ID", "date": "YYYY-MM-DD", "language": "English"}'

# Look for: "Found X base availability records"
```

**Fix:** Populate `provider_availability_cache` table with availability records for the target providers.

#### C. All Slots Blocked by Conflicts
```bash
# Check IntakeQ conflict logs in server output
# Look for: "Provider X: Y/Z slots available (removed N conflicts)"
```

**Fix:** Verify IntakeQ practitioner IDs are correct, or check for scheduling conflicts.

#### D. Frontend Processing Issue
```bash
# Check browser console for JavaScript errors
# Look for data validation or slot conversion errors
```

**Fix:** Check `mapApiSlotToTimeSlot()` function in data validation utilities.

### Issue 2: API Returns Slots but UI Shows None

**Symptoms:** Server logs show "Generated X slots" but frontend displays empty.

**Debugging Steps:**

1. **Check browser console** for JavaScript errors
2. **Check network tab** - verify API response contains `availableSlots` array
3. **Check data validation** - verify `mapApiSlotToTimeSlot()` isn't filtering out slots
4. **Check date filtering** - verify past time slot filtering isn't too aggressive

### Issue 3: IntakeQ Rate Limiting Causing Issues

**Symptoms:** Logs show "429 Rate limit exceeded" and inconsistent availability.

**Current Status:** ✅ **FIXED** - Production-ready rate limiting implemented with:
- Token bucket rate limiter (8 RPM)
- Request caching (5-10 minute TTL)  
- Graceful fallbacks and user-friendly messaging
- Real-time monitoring via `/api/debug/intakeq-status`

## 🛠️ Debugging Tools & Commands

### 1. Quick API Tests
```bash
# Test provider-payer relationships
curl -X POST "http://localhost:3000/api/patient-booking/providers-for-payer" \
  -H "Content-Type: application/json" \
  -d '{"payer_id": "8bd0bedb-226e-4253-bfeb-46ce835ef2a8", "language": "English"}'

# Test availability for specific date  
curl -X POST "http://localhost:3000/api/patient-booking/merged-availability" \
  -H "Content-Type: application/json" \
  -d '{"payer_id": "8bd0bedb-226e-4253-bfeb-46ce835ef2a8", "date": "2025-09-12", "language": "English"}'

# Test comprehensive system health
./test-booking-apis.sh
```

### 2. Debug Endpoints
```bash
# API contract validation
curl "http://localhost:3000/api/debug/validate-api-contracts"

# Integration test
curl "http://localhost:3000/api/debug/test-booking-integration"  

# IntakeQ rate limiting status
curl "http://localhost:3000/api/debug/intakeq-status"

# Bookability analysis (requires provider & payer IDs)
curl "http://localhost:3000/api/debug/bookability?providerId=ID&payerId=ID"
```

### 3. Database Queries
```sql
-- Check provider-payer relationships
SELECT * FROM v_bookable_provider_payer WHERE payer_id = 'PAYER_ID';

-- Check availability records
SELECT * FROM provider_availability_cache 
WHERE provider_id IN (SELECT provider_id FROM v_bookable_provider_payer WHERE payer_id = 'PAYER_ID')
AND date >= CURRENT_DATE;

-- Check provider status
SELECT id, first_name, last_name, is_bookable, list_on_provider_page 
FROM providers WHERE is_active = true;
```

## 📋 Step-by-Step Troubleshooting Checklist

When availability isn't showing:

### Step 1: Verify Payer ID
- [ ] Check URL or browser network tab for correct `payer_id` in API calls
- [ ] Verify payer exists in database: `SELECT * FROM payers WHERE id = 'PAYER_ID'`

### Step 2: Check Provider Relationships  
- [ ] Run providers-for-payer API test (see commands above)
- [ ] If 0 providers: Check `v_bookable_provider_payer` view
- [ ] Verify providers are `is_bookable = true`

### Step 3: Check Base Availability
- [ ] Run merged-availability API test
- [ ] Look for "Found X base availability records" in logs
- [ ] If 0 records: Populate `provider_availability_cache` table

### Step 4: Check IntakeQ Integration
- [ ] Monitor server logs for IntakeQ API calls
- [ ] Check for rate limiting (429 errors)
- [ ] Verify practitioner IDs are correct
- [ ] Check IntakeQ status: `curl "http://localhost:3000/api/debug/intakeq-status"`

### Step 5: Check Frontend Processing
- [ ] Open browser console, look for JavaScript errors
- [ ] Check network tab - verify API responses contain data
- [ ] Check if date filtering is too restrictive (past appointments)

## 🎯 Common Payer IDs for Testing

```javascript
// Known working payer IDs:
const DMBA_UTAH = "8bd0bedb-226e-4253-bfeb-46ce835ef2a8"      // Has 2 providers
const MOLINA_UTAH = "62ab291d-b68e-4c71-a093-2d6e380764c3"    // Has 4 providers (supervised)  
const UTAH_MEDICAID = "a01d69d6-ae70-4917-afef-49b5ef7e5220" // Has 4 providers (direct)
```

## 🔧 Quick Fixes for Common Scenarios

### Scenario A: New Insurance Added, No Providers
```sql
-- Add provider-payer relationship (direct)
INSERT INTO provider_payer_networks (provider_id, payer_id, status_code, effective_date)
VALUES ('PROVIDER_ID', 'PAYER_ID', 'active', CURRENT_DATE);

-- OR add supervision relationship
INSERT INTO supervision_relationships (rendering_provider_id, billing_provider_id, payer_id)
VALUES ('RESIDENT_ID', 'ATTENDING_ID', 'PAYER_ID');
```

### Scenario B: Provider Available but No Slots Showing
```sql
-- Check if provider has availability records
SELECT * FROM provider_availability_cache WHERE provider_id = 'PROVIDER_ID';

-- If none, add basic availability (example: weekdays 9-5)
INSERT INTO provider_availability_cache (provider_id, day_of_week, start_time, end_time, date)
VALUES 
  ('PROVIDER_ID', 1, '09:00:00', '17:00:00', '2025-09-25'),
  ('PROVIDER_ID', 2, '09:00:00', '17:00:00', '2025-09-26'),
  -- ... etc
```

### Scenario C: IntakeQ Integration Issues
```bash
# Check practitioner ID mapping
curl "http://localhost:3000/api/debug/intakeq-status" | grep "recommendations"

# Verify IntakeQ API key
# Check environment variable: INTAKEQ_API_KEY
```

## 🚀 Production Monitoring

### Health Check Commands
```bash
# Quick system health check
./test-booking-apis.sh

# Monitor rate limiting status  
curl "http://localhost:3000/api/debug/intakeq-status"

# Full integration test
curl "http://localhost:3000/api/debug/test-booking-integration"
```

### Key Metrics to Monitor
- **API Response Times**: < 5 seconds for availability calls
- **Rate Limiting**: Token availability and queue length  
- **Cache Hit Rate**: > 40% for good performance
- **Error Rate**: < 5% for API calls
- **Slot Generation**: > 0 slots for most date/payer combinations

## 📞 Emergency Procedures

If availability completely stops working:

1. **Check API health**: Run `./test-booking-apis.sh`
2. **Check database connection**: Verify Supabase connectivity
3. **Check IntakeQ status**: Monitor rate limiting and API health
4. **Restart dev server**: `npm run dev` (clears caches)
5. **Check error logs**: Look for database or API integration errors

## 📚 Key Files for Developers

- **Frontend**: `src/components/booking/views/CalendarView.tsx`
- **API**: `src/app/api/patient-booking/merged-availability/route.ts`
- **Data Validation**: `src/lib/utils/dataValidation.ts`
- **IntakeQ Service**: `src/lib/services/intakeQService.ts` 
- **Rate Limiting**: `src/lib/services/rateLimiter.ts`
- **Testing**: `./test-booking-apis.sh`, `TESTING_DATA_FORMAT_ERRORS.md`

This troubleshooting guide should help future developers quickly identify and fix availability issues!