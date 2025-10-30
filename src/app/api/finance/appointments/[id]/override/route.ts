// src/app/api/finance/appointments/[id]/override/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * PATCH /api/finance/appointments/[id]/override
 *
 * Update manual override for an appointment field
 *
 * Body:
 * - column_name: Field to override (patient_paid, patient_paid_date, discount_reason, etc.)
 * - value: New value
 * - reason: Optional reason for override
 * - changed_by: User ID making the change
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appointmentId } = await params
    const body = await request.json()
    const { column_name, value, reason, changed_by } = body

    if (!column_name || value === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing column_name or value' },
        { status: 400 }
      )
    }

    // Validate column name
    const allowedColumns = [
      'patient_paid',
      'patient_paid_date',
      'provider_paid_cents',
      'provider_paid_date',
      'discount_reason',
      'claim_needed',
      'claim_status',
      'appt_status',
      'notes',
      'reimbursement_cents',
      'is_test_data'
    ]

    if (!allowedColumns.includes(column_name)) {
      return NextResponse.json(
        { success: false, error: `Column ${column_name} cannot be overridden` },
        { status: 400 }
      )
    }

    // Verify appointment exists
    const { data: appointment, error: apptError } = await supabaseAdmin
      .from('appointments')
      .select('id')
      .eq('id', appointmentId)
      .single()

    if (apptError || !appointment) {
      return NextResponse.json(
        { success: false, error: 'Appointment not found' },
        { status: 404 }
      )
    }

    // Upsert override
    const { data, error } = await supabaseAdmin
      .from('manual_overrides')
      .upsert({
        scope: 'appointment',
        record_id: appointmentId,
        column_name,
        value: { v: value }, // Wrap in {v: } for consistency
        reason: reason || null,
        changed_by: changed_by || null,
        changed_at: new Date().toISOString(),
      }, {
        onConflict: 'scope,record_id,column_name'
      })
      .select()
      .single()

    if (error) {
      console.error('Override upsert error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Override saved',
      data
    })

  } catch (error: any) {
    console.error('Override error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/finance/appointments/[id]/override
 *
 * Remove manual override
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appointmentId } = await params
    const { searchParams } = new URL(request.url)
    const columnName = searchParams.get('column_name')

    if (!columnName) {
      return NextResponse.json(
        { success: false, error: 'Missing column_name parameter' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('manual_overrides')
      .delete()
      .eq('scope', 'appointment')
      .eq('record_id', appointmentId)
      .eq('column_name', columnName)

    if (error) {
      console.error('Override delete error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Override removed'
    })

  } catch (error: any) {
    console.error('Override delete error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
