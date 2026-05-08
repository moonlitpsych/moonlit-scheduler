/**
 * GET /api/provider-dashboard/patients/search?q=...&providerId=...
 *
 * Returns patients the requesting provider has at least one appointment with.
 * Admins (or admins impersonating a provider) pass `providerId` explicitly and
 * skip the provider-of-record gate when no providerId is supplied.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()
    const providerIdParam = searchParams.get('providerId')

    if (q.length < 2) {
      return NextResponse.json({ success: true, data: [] })
    }

    const isAdmin = await isAdminEmail(session.user.email || '')

    // Resolve which provider's roster to scope to.
    let providerId: string | null = providerIdParam
    if (!providerId) {
      // Fall back to the logged-in user's own provider record.
      const { data: ownProvider } = await supabaseAdmin
        .from('providers')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .eq('is_active', true)
        .maybeSingle()
      providerId = ownProvider?.id || null
    }

    if (!providerId && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'No provider context found for this account' },
        { status: 403 },
      )
    }

    // Search patients by name/email.
    const like = `%${q}%`
    const { data: patients, error: patientErr } = await supabaseAdmin
      .from('patients')
      .select('id, first_name, last_name, email, date_of_birth, default_diagnosis_codes')
      .or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true })
      .limit(40)

    if (patientErr) {
      return NextResponse.json({ success: false, error: patientErr.message }, { status: 500 })
    }

    if (!patients || patients.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    // If we have a provider context, scope to patients with at least one
    // appointment with that provider; admins without an impersonated provider
    // see the unscoped result.
    let allowedPatientIds: Set<string> | null = null
    if (providerId) {
      const { data: appts } = await supabaseAdmin
        .from('appointments')
        .select('patient_id, start_time')
        .eq('provider_id', providerId)
        .in(
          'patient_id',
          patients.map((p) => p.id),
        )
      allowedPatientIds = new Set((appts || []).map((a) => a.patient_id as string))
    }

    // Compute first appointment date per patient (for "established since" line).
    const filtered = allowedPatientIds
      ? patients.filter((p) => allowedPatientIds!.has(p.id))
      : patients

    // Look up first appointment dates for the surviving set.
    let firstApptByPatient: Record<string, string> = {}
    if (providerId && filtered.length > 0) {
      const { data: appts } = await supabaseAdmin
        .from('appointments')
        .select('patient_id, start_time')
        .eq('provider_id', providerId)
        .in(
          'patient_id',
          filtered.map((p) => p.id),
        )
        .order('start_time', { ascending: true })
      for (const a of appts || []) {
        const pid = a.patient_id as string
        if (!firstApptByPatient[pid]) firstApptByPatient[pid] = a.start_time as string
      }
    }

    const results = filtered.map((p) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      date_of_birth: p.date_of_birth,
      default_diagnosis_codes: (p as any).default_diagnosis_codes || [],
      first_appointment_date: firstApptByPatient[p.id] || null,
    }))

    return NextResponse.json({ success: true, data: results })
  } catch (error: any) {
    console.error('❌ provider-dashboard/patients/search error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
