// Clean up test appointments blocking slots
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // Find test appointments (identifiable by test patient names)
    const { data: testAppointments, error: fetchError } = await supabaseAdmin
      .from('appointments')
      .select(`
        id,
        start_time,
        end_time,
        status,
        created_at,
        provider_id,
        patients!inner(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('status', 'scheduled')
      .or('first_name.ilike.%test%,last_name.ilike.%test%,first_name.ilike.%mir%', { referencedTable: 'patients' })

    if (fetchError) throw fetchError

    if (!testAppointments || testAppointments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No test appointments found',
        deleted: 0
      })
    }

    // Delete idempotency requests first (foreign key constraint)
    const appointmentIds = testAppointments.map(a => a.id)
    const { error: idempotencyError } = await supabaseAdmin
      .from('idempotency_requests')
      .delete()
      .in('appointment_id', appointmentIds)

    if (idempotencyError) {
      console.warn('⚠️ Error deleting idempotency requests (non-fatal):', idempotencyError)
    }

    // Now delete the test appointments
    const { error: deleteError } = await supabaseAdmin
      .from('appointments')
      .delete()
      .in('id', appointmentIds)

    if (deleteError) throw deleteError

    return NextResponse.json({
      success: true,
      message: `Deleted ${testAppointments.length} test appointments`,
      deleted: testAppointments.length,
      appointments: testAppointments.map(a => ({
        id: a.id,
        patient: `${a.patients.first_name} ${a.patients.last_name}`,
        email: a.patients.email,
        start_time: a.start_time,
        created_at: a.created_at
      }))
    })

  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 })
  }
}
