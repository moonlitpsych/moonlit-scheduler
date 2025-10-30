// src/app/api/debug/check-appointments-schema/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

/**
 * Debug endpoint to inspect appointments table schema
 *
 * Usage:
 *   GET /api/debug/check-appointments-schema
 *
 * Purpose:
 *   - Fetch one appointment and show all available fields
 *   - Identify IntakeQ-related field names
 */
export async function GET() {
  try {
    console.log('🔍 [Schema Debug] Fetching sample appointment to inspect fields...')

    // Get one recent appointment
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    if (!appointments || appointments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No appointments found in database',
        fields: []
      })
    }

    const sampleAppointment = appointments[0]
    const allFields = Object.keys(sampleAppointment)

    // Find IntakeQ-related fields
    const intakeqFields = allFields.filter(field =>
      field.toLowerCase().includes('intakeq') ||
      field.toLowerCase().includes('practiceq') ||
      field.toLowerCase().includes('pq_') ||
      field.toLowerCase().includes('client')
    )

    console.log(`✅ [Schema Debug] Found ${allFields.length} fields, ${intakeqFields.length} IntakeQ-related`)

    return NextResponse.json({
      success: true,
      totalFields: allFields.length,
      allFields: allFields.sort(),
      intakeqRelatedFields: intakeqFields,
      sampleAppointment: {
        id: sampleAppointment.id,
        created_at: sampleAppointment.created_at,
        ...intakeqFields.reduce((acc, field) => {
          acc[field] = sampleAppointment[field]
          return acc
        }, {} as any)
      }
    })

  } catch (error: any) {
    console.error('❌ [Schema Debug] Error:', error)

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
