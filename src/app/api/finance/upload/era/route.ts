// src/app/api/finance/upload/era/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { parse } from 'csv-parse/sync'
import crypto from 'crypto'

/**
 * POST /api/finance/upload/era
 *
 * Handles ERA (835 Electronic Remittance Advice) CSV uploads
 *
 * CSV Expected Columns:
 * - Claim_Control_Number: Unique claim identifier
 * - Member_ID: Patient insurance member ID
 * - DOS: Date of service (YYYY-MM-DD or MM/DD/YYYY)
 * - Provider_NPI: Rendering provider NPI
 * - Payment_Amount: Dollar amount paid (converted to cents)
 * - Adjustment_Amount: Dollar amount adjusted (optional)
 * - Remark_Codes: Comma-separated codes (optional)
 * - Check_Number: Check or EFT number (optional)
 * - Payment_Date: Date payment received (optional)
 * - Payer_Name: Payer name for matching (optional)
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

    // 2. Read file content and calculate hash
    const fileContent = await file.text()
    const fileHash = crypto.createHash('sha256').update(fileContent).digest('hex')

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
      claims_matched: 0,
      claims_created: 0,
      remittances_created: 0,
      appointments_recalculated: 0,
      errors: [] as Array<{ row: number; error: string }>,
    }

    for (let rowIndex = 0; rowIndex < records.length; rowIndex++) {
      const row = records[rowIndex]

      try {
        // Parse row data
        const claimControlNumber = row.Claim_Control_Number || row.claim_control_number || row.ccn
        const memberId = row.Member_ID || row.member_id
        const dosStr = row.DOS || row.dos || row.date_of_service
        const dos = parseDate(dosStr)
        const providerNpi = row.Provider_NPI || row.provider_npi || row.npi
        const paymentStr = row.Payment_Amount || row.payment_amount || row.payment || '0'
        const paymentCents = parsePriceToCents(paymentStr)
        const adjustmentStr = row.Adjustment_Amount || row.adjustment_amount || row.adjustment || '0'
        const adjustmentCents = parsePriceToCents(adjustmentStr)
        const remarkCodesStr = row.Remark_Codes || row.remark_codes || ''
        const remarkCodes = remarkCodesStr ? remarkCodesStr.split(',').map((c: string) => c.trim()) : []
        const checkNumber = row.Check_Number || row.check_number
        const paymentDateStr = row.Payment_Date || row.payment_date
        const paymentDate = paymentDateStr ? parseDate(paymentDateStr) : null
        const payerName = row.Payer_Name || row.payer_name || row.payer

        if (!claimControlNumber) {
          throw new Error('Missing claim control number')
        }

        // Find or create claim
        let claimId: string | null = null
        let appointmentId: string | null = null

        // Try to find existing claim by control number
        const { data: existingClaim } = await supabaseAdmin
          .from('finance_claims')
          .select('id, appointment_id')
          .eq('claim_control_number', claimControlNumber)
          .single()

        if (existingClaim) {
          claimId = existingClaim.id
          appointmentId = existingClaim.appointment_id
          results.claims_matched++
        } else {
          // Try to match appointment by member ID, DOS, NPI
          const { data: matchedAppointment } = await supabaseAdmin
            .from('appointments')
            .select(`
              id,
              provider_id,
              payer_id,
              providers!inner(npi)
            `)
            .eq('providers.npi', providerNpi)
            .gte('start_time', `${dos}T00:00:00`)
            .lt('start_time', `${dos}T23:59:59`)
            .single()

          if (matchedAppointment) {
            appointmentId = matchedAppointment.id

            // Create claim
            const { data: newClaim, error: claimError } = await supabaseAdmin
              .from('finance_claims')
              .insert({
                appointment_id: appointmentId,
                claim_control_number: claimControlNumber,
                member_id: memberId,
                dos,
                provider_npi: providerNpi,
                status: paymentCents > 0 ? 'paid' : 'pending',
              })
              .select('id')
              .single()

            if (claimError) throw new Error(`Failed to create claim: ${claimError.message}`)

            claimId = newClaim!.id
            results.claims_created++
          } else {
            throw new Error(`No appointment found for NPI=${providerNpi}, DOS=${dos}`)
          }
        }

        // Lookup payer by name if provided
        let payerId: string | null = null
        if (payerName) {
          const { data: payer } = await supabaseAdmin
            .from('payers')
            .select('id')
            .ilike('name', `%${payerName}%`)
            .single()

          if (payer) {
            payerId = payer.id
          }
        }

        // Create remittance
        const { error: remitError } = await supabaseAdmin
          .from('finance_remittances')
          .insert({
            claim_id: claimId,
            payment_cents: paymentCents,
            adjustment_cents: adjustmentCents,
            remark_codes: remarkCodes,
            check_number: checkNumber,
            payment_date: paymentDate,
            payer_id: payerId,
          })

        if (remitError) throw new Error(`Failed to create remittance: ${remitError.message}`)

        results.remittances_created++

        // Recompute earnings for affected appointment
        if (appointmentId) {
          await supabaseAdmin.rpc('sp_recompute_provider_earnings', {
            p_appointment_id: appointmentId
          })
          results.appointments_recalculated++
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
      message: `Processed ${results.total} ERA records`,
      file_hash: fileHash,
      results,
    })

  } catch (error: any) {
    console.error('ERA upload error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// ============================================================
// Helper Functions
// ============================================================

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

function parsePriceToCents(priceStr: string): number {
  if (!priceStr) return 0

  const cleaned = priceStr.replace(/[$,]/g, '')
  const num = parseFloat(cleaned)

  if (isNaN(num)) return 0

  return Math.round(num * 100)
}
