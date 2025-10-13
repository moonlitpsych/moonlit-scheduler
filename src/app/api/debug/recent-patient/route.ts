import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: patient, error } = await supabaseAdmin
      .from('patients')
      .select('id, first_name, last_name, email, phone, date_of_birth, intakeq_client_id, primary_payer_id, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      patient,
      hasPhone: !!patient?.phone,
      hasDOB: !!patient?.date_of_birth,
      hasIntakeQId: !!patient?.intakeq_client_id,
      hasPrimaryPayer: !!patient?.primary_payer_id
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
