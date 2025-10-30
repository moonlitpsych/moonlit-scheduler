// src/app/api/finance/upload/provider-pay/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { parse } from 'csv-parse/sync'

/**
 * POST /api/finance/upload/provider-pay
 *
 * Uploads provider pay data from a CSV file and matches to existing appointments
 *
 * CSV Expected Columns:
 * - Date: Appointment date (YYYY-MM-DD or MM/DD/YYYY)
 * - Practitioner: Provider full name (e.g., "Rufus Sweeney" or "Dr. Rufus Sweeney")
 * - Patient_Last: Patient last name
 * - Provider_Paid: Amount paid to provider (dollar amount, will be converted to cents)
 * - Provider_Paid_Date: Date paid (optional, YYYY-MM-DD or MM/DD/YYYY)
 * - Reimbursement: Insurance reimbursement amount (optional, dollar amount)
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

    // 2. Read file content
    const fileContent = await file.text()

    // 3. Parse CSV
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: false,
    })

    if (records.length === 0) {
      return NextResponse.json(
        { success: false, error: 'CSV file is empty' },
        { status: 400 }
      )
    }

    // 4. Process each row
    const results = {
      total: records.length,
      matched: 0,
      updated: 0,
      notFound: 0,
      errors: [] as Array<{ row: number; error: string; data?: any }>,
    }

    for (let rowIndex = 0; rowIndex < records.length; rowIndex++) {
      const row = records[rowIndex]

      try {
        // Normalize date format
        const dateStr = row.Date || row.date || row.DATE
        const practitionerStr = row.Practitioner || row.practitioner || row.PRACTITIONER
        const patientLast = row.Patient_Last || row.patient_last || row.PATIENT_LAST
        const providerPaid = row.Provider_Paid || row.provider_paid || row.PROVIDER_PAID
        const providerPaidDate = row.Provider_Paid_Date || row.provider_paid_date || row.PROVIDER_PAID_DATE
        const reimbursement = row.Reimbursement || row.reimbursement || row.REIMBURSEMENT

        if (!dateStr || !practitionerStr || !patientLast) {
          results.errors.push({
            row: rowIndex + 1,
            error: 'Missing required fields (Date, Practitioner, Patient_Last)',
            data: row
          })
          continue
        }

        // Parse date to YYYY-MM-DD format
        let appointmentDate: string
        if (dateStr.includes('/')) {
          // MM/DD/YYYY format
          const parts = dateStr.split('/')
          if (parts.length === 3) {
            const [month, day, year] = parts
            appointmentDate = `${year.padStart(4, '20')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
          } else {
            throw new Error(`Invalid date format: ${dateStr}`)
          }
        } else {
          // Assume YYYY-MM-DD
          appointmentDate = dateStr
        }

        // Clean up practitioner name (remove "Dr." prefix if present)
        const cleanPractitioner = practitionerStr
          .replace(/^Dr\.?\s*/i, '')
          .replace(/,?\s*MD\.?$/i, '')
          .trim()

        // Find matching appointment
        const { data: appointments, error: searchError } = await supabaseAdmin
          .from('v_appointments_grid')
          .select('appointment_id, practitioner, last_name, appt_date')
          .eq('appt_date', appointmentDate)
          .ilike('last_name', patientLast)

        if (searchError) {
          throw searchError
        }

        // Fuzzy match practitioner name
        const matchedAppt = appointments?.find(appt => {
          const apptPractitioner = appt.practitioner
            .replace(/^Dr\.?\s*/i, '')
            .replace(/,?\s*MD\.?$/i, '')
            .trim()
            .toLowerCase()
          return apptPractitioner.includes(cleanPractitioner.toLowerCase()) ||
                 cleanPractitioner.toLowerCase().includes(apptPractitioner.toLowerCase())
        })

        if (!matchedAppt) {
          results.notFound++
          results.errors.push({
            row: rowIndex + 1,
            error: `No matching appointment found for ${practitionerStr} / ${patientLast} on ${appointmentDate}`,
            data: { date: appointmentDate, practitioner: practitionerStr, patient: patientLast }
          })
          continue
        }

        results.matched++

        // Update provider paid data using override API
        const updates: Array<{ column: string; value: any }> = []

        if (providerPaid && parseFloat(providerPaid) > 0) {
          updates.push({
            column: 'provider_paid_cents',
            value: Math.round(parseFloat(providerPaid) * 100)
          })
        }

        if (providerPaidDate) {
          // Parse provider paid date
          let paidDate: string
          if (providerPaidDate.includes('/')) {
            const parts = providerPaidDate.split('/')
            if (parts.length === 3) {
              const [month, day, year] = parts
              paidDate = `${year.padStart(4, '20')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
            } else {
              paidDate = providerPaidDate
            }
          } else {
            paidDate = providerPaidDate
          }

          updates.push({
            column: 'provider_paid_date',
            value: paidDate
          })
        }

        if (reimbursement && parseFloat(reimbursement) > 0) {
          updates.push({
            column: 'reimbursement_cents',
            value: Math.round(parseFloat(reimbursement) * 100)
          })
        }

        // Apply each update
        for (const update of updates) {
          const { error: updateError } = await supabaseAdmin
            .from('manual_overrides')
            .upsert({
              scope: 'appointment',
              record_id: matchedAppt.appointment_id,
              column_name: update.column,
              value: { v: update.value },
              reason: `CSV upload by admin: ${file.name}`,
              changed_by: null, // TODO: Get from auth context
              changed_at: new Date().toISOString(),
            }, {
              onConflict: 'scope,record_id,column_name'
            })

          if (updateError) {
            throw updateError
          }
        }

        results.updated++

      } catch (error: any) {
        results.errors.push({
          row: rowIndex + 1,
          error: error.message,
          data: row
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Provider pay data uploaded: ${results.updated} appointments updated, ${results.notFound} not found`,
      results
    })

  } catch (error: any) {
    console.error('Provider pay upload error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
