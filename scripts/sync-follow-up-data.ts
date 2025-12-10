/**
 * Background Follow-Up Data Sync Script
 *
 * Fetches follow-up information from IntakeQ clinical notes and caches
 * it in the patients table for fast roster loading.
 *
 * Run with: npx tsx scripts/sync-follow-up-data.ts
 *
 * Options:
 *   --limit=N     Process only first N patients (default: all)
 *   --delay=MS    Delay between IntakeQ API calls (default: 2000ms)
 *   --force       Re-sync all patients even if recently synced
 *
 * Note: IntakeQ has rate limiting, so this script uses configurable delays
 * between API calls. Default 2 seconds keeps us well under the rate limit.
 */

import { createClient } from '@supabase/supabase-js'
import { parseFollowUpFromNote } from '../src/lib/utils/followUpParser'

// Load environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const INTAKEQ_API_KEY = process.env.INTAKEQ_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables')
  process.exit(1)
}

if (!INTAKEQ_API_KEY) {
  console.error('❌ Missing INTAKEQ_API_KEY environment variable')
  process.exit(1)
}

// Clean up IntakeQ API key if it has the Next.js .env concatenation bug
function getCleanApiKey(key: string): string {
  if (key.length > 40) {
    // Extract the first 40 characters (valid API key length)
    return key.substring(0, 40)
  }
  return key
}

const cleanApiKey = getCleanApiKey(INTAKEQ_API_KEY)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Parse command line args
const args = process.argv.slice(2)
const limitArg = args.find(a => a.startsWith('--limit='))
const delayArg = args.find(a => a.startsWith('--delay='))
const forceSync = args.includes('--force')

const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined
const delayMs = delayArg ? parseInt(delayArg.split('=')[1]) : 2000

console.log('🔄 Follow-Up Data Sync Script')
console.log(`   Limit: ${limit || 'all'}`)
console.log(`   Delay: ${delayMs}ms between API calls`)
console.log(`   Force: ${forceSync}`)
console.log('')

interface Patient {
  id: string
  first_name: string
  last_name: string
  practiceq_client_id: string
  last_follow_up_synced_at: string | null
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchLatestLockedNote(clientId: string): Promise<any | null> {
  try {
    // First get intake forms for this client to find notes
    const response = await fetch(
      `https://intakeq.com/api/v1/forms?ClientId=${clientId}&Type=Notes`,
      {
        headers: {
          'X-Auth-Key': cleanApiKey,
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`   ⚠️ Rate limited, waiting 60 seconds...`)
        await sleep(60000)
        return fetchLatestLockedNote(clientId) // Retry
      }
      throw new Error(`IntakeQ API error: ${response.status}`)
    }

    const notes = await response.json()

    if (!notes || notes.length === 0) {
      return null
    }

    // Find most recent locked note
    const sortedNotes = notes
      .filter((n: any) => n.Status === 'Locked')
      .sort((a: any, b: any) => {
        const dateA = new Date(a.DateCreated || a.CreatedDate || 0)
        const dateB = new Date(b.DateCreated || b.CreatedDate || 0)
        return dateB.getTime() - dateA.getTime()
      })

    if (sortedNotes.length === 0) {
      return null
    }

    // Get full note details for the most recent locked note
    const latestNote = sortedNotes[0]
    const noteResponse = await fetch(
      `https://intakeq.com/api/v1/forms/${latestNote.Id}`,
      {
        headers: {
          'X-Auth-Key': cleanApiKey,
          'Accept': 'application/json'
        }
      }
    )

    if (!noteResponse.ok) {
      throw new Error(`IntakeQ note fetch error: ${noteResponse.status}`)
    }

    return await noteResponse.json()
  } catch (error: any) {
    console.error(`   ❌ Error fetching note for client ${clientId}: ${error.message}`)
    return null
  }
}

async function syncPatient(patient: Patient): Promise<boolean> {
  console.log(`   Processing: ${patient.first_name} ${patient.last_name} (${patient.practiceq_client_id})`)

  try {
    // Fetch latest locked note from IntakeQ
    const note = await fetchLatestLockedNote(patient.practiceq_client_id)

    if (!note) {
      console.log(`   → No locked notes found`)
      // Update sync timestamp even if no note found
      await supabase
        .from('patients')
        .update({ last_follow_up_synced_at: new Date().toISOString() })
        .eq('id', patient.id)
      return true
    }

    // Parse follow-up from note
    const parsed = parseFollowUpFromNote(note)

    // Update patient record
    const updateData: any = {
      last_follow_up_synced_at: new Date().toISOString()
    }

    if (parsed.text) {
      updateData.last_follow_up_text = parsed.text
      updateData.last_follow_up_note_date = parsed.noteDate
      console.log(`   → Found: "${parsed.text.substring(0, 50)}${parsed.text.length > 50 ? '...' : ''}"`)
    } else {
      // Clear any stale data
      updateData.last_follow_up_text = null
      updateData.last_follow_up_note_date = null
      console.log(`   → No follow-up text found in note`)
    }

    const { error } = await supabase
      .from('patients')
      .update(updateData)
      .eq('id', patient.id)

    if (error) {
      console.error(`   ❌ Database update error: ${error.message}`)
      return false
    }

    return true
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`)
    return false
  }
}

async function main() {
  console.log('📋 Fetching patients with IntakeQ client IDs...\n')

  // Get patients that need syncing
  let query = supabase
    .from('patients')
    .select('id, first_name, last_name, practiceq_client_id, last_follow_up_synced_at')
    .not('practiceq_client_id', 'is', null)

  // Skip recently synced patients unless force flag is set
  if (!forceSync) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    query = query.or(`last_follow_up_synced_at.is.null,last_follow_up_synced_at.lt.${oneDayAgo}`)
  }

  if (limit) {
    query = query.limit(limit)
  }

  const { data: patients, error } = await query

  if (error) {
    console.error('❌ Error fetching patients:', error.message)
    process.exit(1)
  }

  if (!patients || patients.length === 0) {
    console.log('✅ No patients need syncing')
    process.exit(0)
  }

  console.log(`Found ${patients.length} patients to sync\n`)

  let success = 0
  let failed = 0

  for (let i = 0; i < patients.length; i++) {
    const patient = patients[i] as Patient
    console.log(`[${i + 1}/${patients.length}]`)

    const result = await syncPatient(patient)
    if (result) {
      success++
    } else {
      failed++
    }

    // Delay between API calls to respect rate limits
    if (i < patients.length - 1) {
      await sleep(delayMs)
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('📊 Sync Complete')
  console.log(`   ✅ Success: ${success}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log(`   📊 Total: ${patients.length}`)
}

main().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})
