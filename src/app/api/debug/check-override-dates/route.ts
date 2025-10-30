// Debug endpoint to check which appointments have overrides
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get all overrides with appointment details
    const { data, error } = await supabaseAdmin
      .from('manual_overrides')
      .select('record_id, column_name, value, changed_at')
      .eq('scope', 'appointment')
      .in('column_name', ['provider_paid_cents', 'provider_paid_date', 'reimbursement_cents', 'claim_status'])
      .order('changed_at', { ascending: false })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Get appointment dates for these record_ids
    const appointmentIds = [...new Set(data.map(o => o.record_id))]

    const { data: appointments, error: apptError } = await supabaseAdmin
      .from('appointments')
      .select('id, start_time, patient_info')
      .in('id', appointmentIds)

    if (apptError) {
      return NextResponse.json({ success: false, error: apptError.message }, { status: 500 })
    }

    // Merge data
    const result = data.map(override => {
      const appt = appointments.find(a => a.id === override.record_id)
      return {
        appointment_id: override.record_id,
        appointment_date: appt?.start_time?.split('T')[0],
        patient_last_name: appt?.patient_info?.lastName || 'unknown',
        column_name: override.column_name,
        value: override.value,
        changed_at: override.changed_at
      }
    })

    // Group by date
    const byDate: Record<string, number> = {}
    result.forEach(r => {
      if (r.appointment_date) {
        byDate[r.appointment_date] = (byDate[r.appointment_date] || 0) + 1
      }
    })

    return NextResponse.json({
      success: true,
      total_overrides: data.length,
      overrides_by_date: Object.entries(byDate)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 30),
      sample_overrides: result.slice(0, 20)
    })

  } catch (error: any) {
    console.error('Check override dates error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
