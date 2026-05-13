# Prompt for Next Claude Instance

## How to Start Your Session

Begin with: "I'll review the V2.0 handoff document and continue where we left off."

Then run these commands:
```bash
# Check current branch
git branch --show-current

# Review recent commits
git log --oneline -10

# Check V2.0 status
cat CLAUDE_V2_HANDOFF.md

# Check for any uncommitted changes
git status
```

## Context

You're continuing work on the V2.0 booking system for Moonlit Scheduler. The previous Claude instance just fixed a critical issue where insurance fields weren't syncing to IntakeQ. This is now working correctly.

## Current State

✅ **WORKING:**
- Insurance fields sync to IntakeQ (just fixed!)
- Phone numbers sync
- Email aliasing prevents duplicates
- Idempotency prevents double-bookings
- Non-blocking IntakeQ sync

❌ **KNOWN LIMITATIONS:**
- DOB cannot be set via API (patients enter in intake form)
- GET /clients/${id} returns 404 (use search instead)

## Your Primary Tasks

1. **Monitor First Production Bookings**
   - Watch logs for any sync failures
   - Verify insurance appears in IntakeQ
   - Check that intake questionnaires send

2. **Clean Up When Stable**
   - Remove debug endpoints after testing complete
   - Clean up test data from IntakeQ
   - Archive debug documentation

3. **Optimize & Document**
   - Review error handling
   - Create troubleshooting guide
   - Document for ops team

## Key Files to Know

- `CLAUDE_V2_HANDOFF.md` - Complete status and context
- `src/lib/services/intakeqClientUpsert.ts` - Just fixed (insurance field names)
- `src/app/api/patient-booking/book/route.ts` - Main booking endpoint
- `.env.local` - Feature flags configuration

## Testing Commands

```bash
# Test booking flow
npm run dev
# Navigate to http://localhost:3000/book-dev

# Check insurance mappings
curl http://localhost:3000/api/debug/check-insurance-mappings

# View IntakeQ client
curl "http://localhost:3000/api/debug/test-intakeq-client?clientId=116"
```

## Important Rules

1. **NO MOCK DATA** - This is a production healthcare app
2. **Preserve the insurance field fix** - Use correct IntakeQ field names
3. **Keep non-blocking sync pattern** - Don't let IntakeQ failures block DB saves
4. **Test on scheduler-v-2-0 branch** - Don't push to main directly

## Success Criteria

V2.0 is complete when:
- Several real patients have booked successfully
- Insurance info consistently appears in IntakeQ
- No double-bookings occur
- Team is comfortable with the system

Good luck! The system is working well - just needs monitoring and minor cleanup. 🚀