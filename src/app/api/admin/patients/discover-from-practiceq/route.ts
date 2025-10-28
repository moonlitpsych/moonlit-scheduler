import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { intakeQService } from '@/lib/services/intakeQService'
import { practiceQSyncService } from '@/lib/services/practiceQSyncService'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

/**
 * Discover NEW patients from PracticeQ (IntakeQ) that don't exist in database yet
 *
 * POST /api/admin/patients/discover-from-practiceq
 *
 * This endpoint:
 * 1. Fetches ALL clients from IntakeQ
 * 2. Creates patient records for any that don't exist in our database
 * 3. Syncs their appointments
 *
 * Body (optional):
 * {
 *   "dateRange": {
 *     "startDate": "2025-01-01",  // Default: 90 days ago
 *     "endDate": "2025-12-31"      // Default: 90 days from now
 *   },
 *   "syncAppointments": true  // Default: true
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { dateRange, syncAppointments = true } = body

    console.log('🔍 Starting PracticeQ patient discovery...')

    // Calculate date range for fetching clients with appointments
    const defaultStartDate = new Date()
    defaultStartDate.setDate(defaultStartDate.getDate() - 90)
    const defaultEndDate = new Date()
    defaultEndDate.setDate(defaultEndDate.getDate() + 90)

    const startDate = dateRange?.startDate || defaultStartDate.toISOString().split('T')[0]
    const endDate = dateRange?.endDate || defaultEndDate.toISOString().split('T')[0]

    console.log(`📅 Fetching IntakeQ appointments from ${startDate} to ${endDate}`)

    // Fetch ALL appointments from IntakeQ in the date range
    // We'll extract unique clients from the appointments
    const intakeqAppointments = await intakeQService.makeRequest<any[]>(
      `/appointments?startDate=${startDate}&endDate=${endDate}`
    )

    if (!intakeqAppointments || intakeqAppointments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No appointments found in IntakeQ for the specified date range',
        stats: {
          intakeq_clients: 0,
          new_patients_created: 0,
          existing_patients: 0,
          patients_synced: 0,
          errors: []
        }
      })
    }

    console.log(`📥 Found ${intakeqAppointments.length} appointments in IntakeQ`)

    // Extract unique clients from appointments
    const clientsMap = new Map<string, any>()
    for (const appt of intakeqAppointments) {
      if (appt.ClientEmail && !clientsMap.has(appt.ClientEmail.toLowerCase())) {
        clientsMap.set(appt.ClientEmail.toLowerCase(), {
          id: appt.ClientId,
          email: appt.ClientEmail,
          name: appt.ClientName,
          phone: appt.ClientPhone,
          dateOfBirth: appt.ClientDateOfBirth
        })
      }
    }

    const uniqueClients = Array.from(clientsMap.values())
    console.log(`👥 Found ${uniqueClients.length} unique clients in IntakeQ`)

    // Check which clients already exist in our database
    const existingEmails = new Set<string>()
    const { data: existingPatients } = await supabaseAdmin
      .from('patients')
      .select('email')
      .in('email', uniqueClients.map(c => c.email))

    if (existingPatients) {
      existingPatients.forEach(p => {
        if (p.email) existingEmails.add(p.email.toLowerCase())
      })
    }

    console.log(`📋 ${existingEmails.size} clients already exist in database`)

    // Filter to only NEW clients
    const newClients = uniqueClients.filter(c => !existingEmails.has(c.email.toLowerCase()))
    console.log(`🆕 Found ${newClients.length} NEW clients to import`)

    const stats = {
      intakeq_clients: uniqueClients.length,
      new_patients_created: 0,
      existing_patients: existingEmails.size,
      patients_synced: 0,
      errors: [] as Array<{ email: string; error: string }>
    }

    const createdPatients: Array<{
      id: string
      name: string
      email: string
      syncResult?: any
    }> = []

    // Create new patient records
    for (const client of newClients) {
      try {
        // Parse name (IntakeQ returns "First Last")
        const nameParts = (client.name || '').trim().split(' ')
        const firstName = nameParts[0] || 'Unknown'
        const lastName = nameParts.slice(1).join(' ') || 'Unknown'

        // Create patient record
        const { data: newPatient, error: createError } = await supabaseAdmin
          .from('patients')
          .insert({
            first_name: firstName,
            last_name: lastName,
            email: client.email,
            phone: client.phone || null,
            date_of_birth: client.dateOfBirth || null,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('id, first_name, last_name, email')
          .single()

        if (createError) {
          console.error(`❌ Failed to create patient for ${client.email}:`, createError.message)
          stats.errors.push({
            email: client.email,
            error: createError.message
          })
          continue
        }

        console.log(`✅ Created patient: ${newPatient.first_name} ${newPatient.last_name} (${newPatient.email})`)
        stats.new_patients_created++

        createdPatients.push({
          id: newPatient.id,
          name: `${newPatient.first_name} ${newPatient.last_name}`,
          email: newPatient.email
        })

        // Sync appointments for this new patient if requested
        if (syncAppointments) {
          try {
            const syncResult = await practiceQSyncService.syncPatientAppointments(
              newPatient.id,
              null, // organizationId = null (admin sync)
              { startDate, endDate }
            )

            createdPatients[createdPatients.length - 1].syncResult = {
              new: syncResult.summary.new,
              updated: syncResult.summary.updated,
              errors: syncResult.summary.errors
            }

            stats.patients_synced++
            console.log(`  ↳ Synced appointments: ${syncResult.summary.new} new, ${syncResult.summary.updated} updated`)

            // Assign primary provider based on appointment history
            await practiceQSyncService.assignPrimaryProvider(newPatient.id)
          } catch (syncError: any) {
            console.error(`  ⚠️ Failed to sync appointments for ${newPatient.email}:`, syncError.message)
            stats.errors.push({
              email: newPatient.email,
              error: `Appointment sync failed: ${syncError.message}`
            })
          }
        }

      } catch (error: any) {
        console.error(`❌ Error processing client ${client.email}:`, error.message)
        stats.errors.push({
          email: client.email,
          error: error.message
        })
      }
    }

    console.log(`\n🎉 Discovery complete!`)
    console.log(`   - ${stats.new_patients_created} new patients created`)
    console.log(`   - ${stats.patients_synced} patients synced`)
    console.log(`   - ${stats.errors.length} errors`)

    return NextResponse.json({
      success: true,
      message: `Discovered ${stats.new_patients_created} new patients from PracticeQ`,
      stats,
      created_patients: createdPatients
    })

  } catch (error: any) {
    console.error('❌ PracticeQ discovery failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Patient discovery failed',
      details: error.message
    }, { status: 500 })
  }
}
