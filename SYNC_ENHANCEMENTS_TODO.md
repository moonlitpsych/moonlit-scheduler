# Sync System Enhancement - Remaining Work

## ✅ Completed (Nov 3, 2025)

1. **practiceQSyncService.ts** - Auto-saves IntakeQ client IDs during appointment syncs
   - Committed in: `9cb0ed8`
   - Location: `src/lib/services/practiceQSyncService.ts:186-222`

2. **discover-from-practiceq endpoint** - Saves client IDs when creating new patients
   - Location: `src/app/api/admin/patients/discover-from-practiceq/route.ts:136`

## ⏳ Remaining Work: Enhance 3AM Cron Job

**File:** `src/app/api/cron/sync-practiceq-appointments/route.ts`

### Current Behavior:
```
1. Loop through organizations
2. Sync appointments for org-affiliated patients only
3. Update sync log
```

### Desired Behavior (Option A - Full Auto-Discovery):
```
1. Discover new patients from IntakeQ (creates records with client IDs)
2. Loop through organizations → Sync org-affiliated patients
3. Sync unaffiliated patients (so they stay up-to-date)
4. Update sync log
```

### What Needs to Change:

#### 1. Add Import
```typescript
import { intakeQService } from '@/lib/services/intakeQService'
```

#### 2. Update Stats Interface
```typescript
interface SyncStats {
  totalPatients: number
  newPatientsDiscovered: number  // ADD
  unaffiliatedPatientsSynced: number  // ADD
  patientsProcessed: number
  patientsFailed: number
  totalAppointments: { ... }
  duration: number
  errors: Array<...>
}
```

#### 3. Add Phase 3: Patient Discovery
**Insert after line 175 (after org loop completes):**

```typescript
// Phase 3: Discover new patients from IntakeQ
console.log('\n🔍 [Cron Sync] Phase 3: Discovering new patients from IntakeQ...')

const discoveryStartDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
const discoveryEndDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

try {
  const intakeqAppointments = await intakeQService.makeRequest<any[]>(
    `/appointments?startDate=${discoveryStartDate}&endDate=${discoveryEndDate}`
  )

  if (intakeqAppointments && intakeqAppointments.length > 0) {
    // Extract unique clients
    const clientsMap = new Map<string, any>()
    for (const appt of intakeqAppointments) {
      if (appt.ClientEmail && !clientsMap.has(appt.ClientEmail.toLowerCase())) {
        clientsMap.set(appt.ClientEmail.toLowerCase(), {
          id: appt.ClientId || appt.ClientNumber,
          email: appt.ClientEmail,
          name: appt.ClientName,
          phone: appt.ClientPhone,
          dateOfBirth: appt.ClientDateOfBirth
        })
      }
    }

    const uniqueClients = Array.from(clientsMap.values())

    // Check which already exist
    const { data: existingPatients } = await supabaseAdmin
      .from('patients')
      .select('email')
      .in('email', uniqueClients.map(c => c.email))

    const existingEmails = new Set<string>()
    if (existingPatients) {
      existingPatients.forEach(p => {
        if (p.email) existingEmails.add(p.email.toLowerCase())
      })
    }

    const newClients = uniqueClients.filter(c => !existingEmails.has(c.email.toLowerCase()))
    console.log(`🆕 Found ${newClients.length} NEW clients to import`)

    // Create new patient records
    for (const client of newClients) {
      try {
        const nameParts = (client.name || '').trim().split(' ')
        const firstName = nameParts[0] || 'Unknown'
        const lastName = nameParts.slice(1).join(' ') || 'Unknown'

        const { data: newPatient, error: createError } = await supabaseAdmin
          .from('patients')
          .insert({
            first_name: firstName,
            last_name: lastName,
            email: client.email,
            phone: client.phone || null,
            date_of_birth: client.dateOfBirth || null,
            intakeq_client_id: client.id || null,  // Save client ID
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('id, first_name, last_name, email')
          .single()

        if (!createError && newPatient) {
          stats.newPatientsDiscovered++
          console.log(`✅ Created: ${newPatient.first_name} ${newPatient.last_name}`)
        }

        await new Promise(resolve => setTimeout(resolve, 50))
      } catch (error: any) {
        console.error(`❌ Error creating patient for ${client.email}:`, error.message)
      }
    }
  }
} catch (error: any) {
  console.error('⚠️ Patient discovery failed:', error.message)
}

console.log(`✅ Phase 3 Complete: ${stats.newPatientsDiscovered} new patients discovered`)
```

#### 4. Add Phase 4: Sync Unaffiliated Patients
**Insert after Phase 3:**

```typescript
// Phase 4: Sync unaffiliated patients (those without org assignments)
console.log('\n🔄 [Cron Sync] Phase 4: Syncing unaffiliated patients...')

const { data: unaffiliatedPatients } = await supabaseAdmin
  .from('patients')
  .select('id, first_name, last_name, email')
  .eq('status', 'active')
  .not('email', 'is', null)
  .order('created_at', { ascending: false })

if (unaffiliatedPatients) {
  for (const patient of unaffiliatedPatients) {
    // Check if patient has org affiliation
    const { data: affiliation } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('id')
      .eq('patient_id', patient.id)
      .eq('status', 'active')
      .single()

    if (!affiliation) {
      // No org affiliation - sync them
      try {
        console.log(`    🔄 Syncing unaffiliated: ${patient.first_name} ${patient.last_name}`)

        const result = await practiceQSyncService.syncPatientAppointments(
          patient.id,
          null,
          {
            startDate: discoveryStartDate,
            endDate: discoveryEndDate
          }
        )

        stats.unaffiliatedPatientsSynced++
        stats.totalAppointments.new += result.summary.new
        stats.totalAppointments.updated += result.summary.updated
        stats.totalAppointments.unchanged += result.summary.unchanged

        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error: any) {
        console.error(`    ❌ Failed: ${error.message}`)
      }
    }
  }
}

console.log(`✅ Phase 4 Complete: ${stats.unaffiliatedPatientsSynced} unaffiliated patients synced`)
```

#### 5. Update Logging
**Around line 203, update the completion log:**

```typescript
console.log('\n✅ [Cron Sync] Automated sync completed!')
console.log(`   🆕 New patients discovered: ${stats.newPatientsDiscovered}`)
console.log(`   👥 Unaffiliated patients synced: ${stats.unaffiliatedPatientsSynced}`)
console.log(`   📊 Affiliated patients synced: ${stats.patientsProcessed}/${stats.totalPatients}`)
console.log(`   ✨ Appointments: ${stats.totalAppointments.new} new, ${stats.totalAppointments.updated} updated, ${stats.totalAppointments.unchanged} unchanged`)
console.log(`   ⏱️  Duration: ${(stats.duration / 1000).toFixed(1)}s`)
```

#### 6. Update Sync Log Metadata
**Around line 196, add new stats to metadata:**

```typescript
metadata: {
  totalPatients: stats.totalPatients,
  newPatientsDiscovered: stats.newPatientsDiscovered,
  unaffiliatedPatientsSynced: stats.unaffiliatedPatientsSynced,
  duration_ms: stats.duration,
  organizations_processed: organizations.length,
  errors: stats.errors.slice(0, 10)
}
```

## 🎯 Expected Results After Implementation

**Daily 3AM Sync Will:**
1. ✅ Discover any new patients from IntakeQ (with client IDs)
2. ✅ Sync appointments for org-affiliated patients
3. ✅ Sync appointments for unaffiliated patients (discovered patients)
4. ✅ Backfill missing client IDs during all syncs (already implemented)

**Benefits:**
- Fully automated patient discovery
- All patients stay up-to-date (org-affiliated or not)
- Medication reports work for everyone
- Providers see newly discovered patients in their dashboards
- Admins can manually assign orgs later

## 📊 Monitoring After Implementation

```sql
-- Check sync results
SELECT
  sync_type,
  metadata->>'newPatientsDiscovered' as new_patients,
  metadata->>'unaffiliatedPatientsSynced' as unaffiliated,
  patients_processed as affiliated,
  appointments_new,
  completed_at
FROM sync_logs
WHERE sync_type = 'automated_daily'
ORDER BY completed_at DESC
LIMIT 5;

-- Check client ID coverage
SELECT
  COUNT(*) FILTER (WHERE intakeq_client_id IS NOT NULL) as with_id,
  COUNT(*) FILTER (WHERE intakeq_client_id IS NULL) as missing_id,
  ROUND(100.0 * COUNT(*) FILTER (WHERE intakeq_client_id IS NOT NULL) / COUNT(*), 1) as coverage_pct
FROM patients
WHERE status = 'active';
```

## Alternative: Manual Discovery Only

If you prefer to keep patient discovery manual:

**Option B - No Auto-Discovery:**
- Skip Phase 3 (patient discovery)
- Keep Phase 4 (unaffiliated sync) - so manually discovered patients stay updated
- Admin runs discover endpoint when needed
- Simpler, more controlled workflow

Let me know which approach you prefer!
