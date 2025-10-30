// src/app/api/debug/check-intakeq-copay/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { intakeQService } from '@/lib/services/intakeQService'

/**
 * Debug endpoint to check if IntakeQ API exposes copay data
 *
 * Usage:
 *   GET /api/debug/check-intakeq-copay?appointment_id=12345
 *   OR GET /api/debug/check-intakeq-copay?client_id=abc123
 *
 * Purpose:
 *   - Fetch full client profile from IntakeQ
 *   - Inspect all fields including CustomFields
 *   - Determine if copay is accessible via API
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const appointmentId = searchParams.get('appointment_id')
    const clientId = searchParams.get('client_id')

    if (!appointmentId && !clientId) {
      return NextResponse.json(
        {
          error: 'Missing appointment_id or client_id parameter',
          usage: 'GET /api/debug/check-intakeq-copay?appointment_id=12345 OR ?client_id=abc123'
        },
        { status: 400 }
      )
    }

    let finalClientId = clientId

    // If appointment_id provided, fetch appointment first to get client_id
    if (appointmentId && !clientId) {
      console.log(`🔍 [Copay Debug] Fetching IntakeQ appointment to get client ID: ${appointmentId}`)

      const appointment = await intakeQService.getAppointment(appointmentId)
      finalClientId = appointment.ClientId

      console.log(`✅ [Copay Debug] Got client ID from appointment: ${finalClientId}`)
    }

    if (!finalClientId) {
      throw new Error('Could not determine client ID')
    }

    console.log(`🔍 [Copay Debug] Fetching IntakeQ client profile for: ${finalClientId}`)

    // Fetch full client profile
    const clientProfile = await intakeQService.getClient(finalClientId)

    console.log('✅ [Copay Debug] Client profile fetched successfully')
    console.log('📋 [Copay Debug] Full response:', JSON.stringify(clientProfile, null, 2))

    // Analyze fields that might contain copay
    const analysis = {
      hasInsuranceSection: !!clientProfile.PrimaryInsuranceName || !!clientProfile.Insurance,
      hasCopayField: !!(clientProfile as any).Copay || !!(clientProfile as any).PrimaryInsuranceCopay,
      hasCustomFields: !!clientProfile.CustomFields,
      customFieldsCount: clientProfile.CustomFields ? Object.keys(clientProfile.CustomFields).length : 0,
      customFields: clientProfile.CustomFields || null,
      insuranceFields: {
        PrimaryInsuranceName: clientProfile.PrimaryInsuranceName || null,
        PrimaryMemberID: clientProfile.PrimaryMemberID || null,
        PrimaryGroupNumber: clientProfile.PrimaryGroupNumber || null,
        PrimaryPolicyHolderName: clientProfile.PrimaryPolicyHolderName || null,
        // Check for any copay-related fields
        copayRelated: Object.keys(clientProfile).filter(key =>
          key.toLowerCase().includes('copay') ||
          key.toLowerCase().includes('co-pay') ||
          key.toLowerCase().includes('copayment')
        )
      }
    }

    return NextResponse.json({
      success: true,
      clientId: finalClientId,
      appointmentId: appointmentId || 'N/A',
      analysis,
      fullProfile: clientProfile,
      message: analysis.hasCopayField
        ? '✅ Copay field found in API response!'
        : '⚠️ No direct copay field found. Check customFields or implement manual entry.'
    })

  } catch (error: any) {
    console.error('❌ [Copay Debug] Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.stack
      },
      { status: 500 }
    )
  }
}
