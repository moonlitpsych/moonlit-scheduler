// src/app/api/finance/upload/appointments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { parse } from 'csv-parse/sync'
import crypto from 'crypto'

/**
 * POST /api/finance/upload/appointments
 *
 * Handles appointment CSV uploads with idempotency and automatic earnings calculation.
 *
 * CSV Expected Columns:
 * - External_ID (optional): IntakeQ/PracticeQ appointment ID
 * - Date: Appointment date (YYYY-MM-DD)
 * - Service: Service name
 * - Practitioner: Provider full name
 * - Patient_Last: Patient last name
 * - Payer: Payer name
 * - Revenue_Type: Cash / Medicaid / Commercial
 * - Price: Dollar amount (will be converted to cents)
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // 2. Read file content and calculate hash for idempotency
    const fileContent = await file.text()
    const fileHash = crypto.createHash('sha256').update(fileContent).digest('hex')

    // 3. Check if this file was already processed
    const { data: existingIngest, error: checkError } = await supabaseAdmin
      .from('appointment_ingests')
      .select('id, imported_at')
      .eq('source_hash', fileHash)
      .limit(1)
      .single()

    if (existingIngest) {
      return NextResponse.json({
        success: true,
        message: 'File already processed',
        imported_at: existingIngest.imported_at,
        status: 'duplicate'
      })
    }

    // 4. Parse CSV
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: false, // Keep everything as strings initially
    })

    if (records.length === 0) {
      return NextResponse.json(
        { success: false, error: 'CSV file is empty' },
        { status: 400 }
      )
    }

    // 5. Process each row
    const results = {
      total: records.length,
      ingested: 0,
      appointments_created: 0,
      appointments_updated: 0,
      errors: [] as Array<{ row: number; error: string }>,
    }

    for (let rowIndex = 0; rowIndex < records.length; rowIndex++) {
      const row = records[rowIndex]

      try {
        // Parse row data
        const externalId = row.External_ID || row.external_id || row.external_appt_id
        const apptDate = parseDate(row.Date || row.date || row.appt_date)
        const serviceName = row.Service || row.service || row.service_name
        const practitionerName = row.Practitioner || row.practitioner || row.provider
        const patientLastName = row.Patient_Last || row.patient_last || row.last_name
        const payerName = row.Payer || row.payer
        const revenueType = row.Revenue_Type || row.revenue_type || row.rev_type
        const priceStr = row.Price || row.price || row.amount || '0'
        const priceCents = parsePriceToCents(priceStr)

        // Insert into ingests table
        const { error: ingestError } = await supabaseAdmin
          .from('appointment_ingests')
          .insert({
            source_filename: file.name,
            source_hash: fileHash,
            row_index: rowIndex,
            raw: row,
            external_appt_id: externalId,
            appt_date: apptDate,
            service_name: serviceName,
            practitioner_name: practitionerName,
            patient_last_name: patientLastName,
            payer_name: payerName,
            revenue_type: revenueType,
            price_cents: priceCents,
          })

        if (ingestError) throw new Error(`Ingest insert failed: ${ingestError.message}`)

        results.ingested++

        // Attempt to match and upsert appointment
        const upsertResult = await upsertAppointment({
          externalId,
          apptDate,
          serviceName,
          practitionerName,
          patientLastName,
          payerName,
          priceCents,
        })

        if (upsertResult.created) results.appointments_created++
        if (upsertResult.updated) results.appointments_updated++

        // Recompute earnings if appointment was created/updated
        if (upsertResult.appointmentId) {
          await supabaseAdmin.rpc('sp_recompute_provider_earnings', {
            p_appointment_id: upsertResult.appointmentId
          })
        }

      } catch (error: any) {
        results.errors.push({
          row: rowIndex + 1,
          error: error.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.total} rows`,
      file_hash: fileHash,
      results,
    })

  } catch (error: any) {
    console.error('Appointment upload error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Parse date from various formats
 */
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null

  // Try ISO format first (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }

  // Try MM/DD/YYYY
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const [, month, day, year] = match
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  return null
}

/**
 * Convert price string to cents
 */
function parsePriceToCents(priceStr: string): number {
  if (!priceStr) return 0

  // Remove $ and commas
  const cleaned = priceStr.replace(/[$,]/g, '')
  const num = parseFloat(cleaned)

  if (isNaN(num)) return 0

  return Math.round(num * 100)
}

/**
 * Upsert appointment based on external ID or matching criteria
 */
async function upsertAppointment(data: {
  externalId: string | null
  apptDate: string | null
  serviceName: string
  practitionerName: string
  patientLastName: string
  payerName: string | null
  priceCents: number
}): Promise<{ created: boolean; updated: boolean; appointmentId?: string }> {

  if (!data.apptDate) {
    return { created: false, updated: false }
  }

  // Try to find existing appointment by external ID
  if (data.externalId) {
    const { data: existing } = await supabaseAdmin
      .from('appointments')
      .select('id')
      .eq('athena_appointment_id', data.externalId)
      .single()

    if (existing) {
      // Don't overwrite existing appointments for now
      // In future, we could update status or notes
      return { created: false, updated: false, appointmentId: existing.id }
    }
  }

  // Lookup provider by name
  const { data: provider } = await supabaseAdmin
    .from('providers')
    .select('id')
    .ilike('first_name', `%${data.practitionerName.split(' ')[0]}%`)
    .ilike('last_name', `%${data.practitionerName.split(' ').slice(-1)[0]}%`)
    .single()

  if (!provider) {
    throw new Error(`Provider not found: ${data.practitionerName}`)
  }

  // Lookup service by name
  const { data: service } = await supabaseAdmin
    .from('services')
    .select('id')
    .ilike('name', `%${data.serviceName}%`)
    .single()

  if (!service) {
    throw new Error(`Service not found: ${data.serviceName}`)
  }

  // Lookup payer by name (optional)
  let payerId: string | null = null
  if (data.payerName) {
    const { data: payer } = await supabaseAdmin
      .from('payers')
      .select('id')
      .ilike('name', `%${data.payerName}%`)
      .single()

    if (payer) {
      payerId = payer.id
    }
  }

  // Get default service instance
  const { data: serviceInstance } = await supabaseAdmin
    .from('service_instances')
    .select('id')
    .eq('service_id', service.id)
    .limit(1)
    .single()

  if (!serviceInstance) {
    throw new Error(`No service instance found for service: ${data.serviceName}`)
  }

  // Create appointment (minimal data from CSV)
  const startTime = `${data.apptDate}T09:00:00-07:00` // Default to 9 AM Mountain Time
  const endTime = `${data.apptDate}T10:00:00-07:00` // Default 1 hour duration

  const { data: newAppt, error: createError } = await supabaseAdmin
    .from('appointments')
    .insert({
      provider_id: provider.id,
      service_instance_id: serviceInstance.id,
      payer_id: payerId,
      start_time: startTime,
      end_time: endTime,
      status: 'completed', // Assume completed since importing historical
      appointment_type: 'new_patient',
      booking_source: 'csv_import',
      athena_appointment_id: data.externalId,
      patient_info: {
        lastName: data.patientLastName,
        firstName: 'Unknown', // Not in CSV
        phone: '',
        email: '',
        dateOfBirth: '',
      },
      insurance_info: {
        memberId: '',
        groupNumber: '',
      },
      notes: `Imported from CSV: ${data.serviceName}`,
    })
    .select('id')
    .single()

  if (createError) {
    throw new Error(`Failed to create appointment: ${createError.message}`)
  }

  return {
    created: true,
    updated: false,
    appointmentId: newAppt?.id
  }
}
