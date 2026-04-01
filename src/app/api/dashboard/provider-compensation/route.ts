import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { Database } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get provider record for this user
    const { data: provider } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!provider) {
      return NextResponse.json({ success: false, error: 'Provider not found' }, { status: 404 })
    }

    // Parse filters
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all'
    const search = searchParams.get('search')?.toLowerCase()

    // Query provider_earnings — the authoritative source for all provider compensation
    // This includes ALL appointments (PracticeQ-synced, scheduler-booked, etc.)
    const { data: earnings, error: earningsError } = await supabaseAdmin
      .from('provider_earnings')
      .select('appointment_id, amount_cents')
      .eq('provider_id', provider.id)

    if (earningsError) throw earningsError

    if (!earnings || earnings.length === 0) {
      return NextResponse.json({
        success: true,
        provider: { id: provider.id, name: `${provider.first_name} ${provider.last_name}` },
        items: [],
        summary: emptySummary(),
      })
    }

    // Sum earnings per appointment (may have multiple service lines)
    const earningsMap = new Map<string, number>()
    for (const e of earnings) {
      earningsMap.set(e.appointment_id, (earningsMap.get(e.appointment_id) || 0) + (e.amount_cents || 0))
    }
    const appointmentIds = [...earningsMap.keys()]

    // Parallel fetch: appointments (with patients), pay run lines, claims, financials
    const [appointmentsResult, payRunsResult, claimsResult, financialsResult] = await Promise.all([
      supabaseAdmin
        .from('appointments')
        .select('id, start_time, status, pq_appointment_id, patients(last_name), service_instances(services(name))')
        .in('id', appointmentIds),
      supabaseAdmin
        .from('provider_pay_run_lines')
        .select('appointment_id, amount_cents, created_at')
        .eq('provider_id', provider.id),
      supabaseAdmin
        .from('claims')
        .select('intakeq_appointment_id, status')
        .not('intakeq_appointment_id', 'is', null),
      supabaseAdmin
        .from('rcm_appointment_financials')
        .select('appointment_id, insurer_paid')
        .in('appointment_id', appointmentIds),
    ])

    // Build lookups
    const appointmentMap = new Map(
      (appointmentsResult.data || []).map((a: any) => [a.id, a])
    )

    // Pay run lines: sum per appointment (in case multiple pay runs)
    const paidMap = new Map<string, { totalCents: number; latestDate: string }>()
    for (const pr of payRunsResult.data || []) {
      const existing = paidMap.get(pr.appointment_id) ?? { totalCents: 0, latestDate: '' }
      existing.totalCents += pr.amount_cents || 0
      const date = pr.created_at?.split('T')[0] || ''
      if (date > existing.latestDate) existing.latestDate = date
      paidMap.set(pr.appointment_id, existing)
    }

    // Claims: lookup by pq_appointment_id
    const claimStatusMap = new Map<string, string>()
    for (const c of claimsResult.data || []) {
      const existing = claimStatusMap.get(c.intakeq_appointment_id!)
      const priority: Record<string, number> = { draft: 0, validated: 1, submitted: 2, rejected: 2, accepted: 3, denied: 3, paid: 4 }
      if (!existing || (priority[c.status] ?? 0) > (priority[existing] ?? 0)) {
        claimStatusMap.set(c.intakeq_appointment_id!, c.status)
      }
    }

    // Financials: insurer_paid per appointment
    const insurerPaidMap = new Map(
      (financialsResult.data || []).map((f: any) => [f.appointment_id, f.insurer_paid || 0])
    )

    // Build items — one row per unique appointment
    let items: any[] = []

    for (const apptId of appointmentIds) {
      const appt = appointmentMap.get(apptId) as any
      if (!appt) continue

      // Skip cancelled/no-show
      if (appt.status === 'cancelled' || appt.status === 'no_show') continue

      const patient = appt.patients as any
      const lastName = patient?.last_name || 'Unknown'

      // Skip test patients
      if (lastName.toLowerCase().includes('test')) continue

      const serviceInstance = appt.service_instances as any
      const service = serviceInstance?.services?.name || ''

      const earnedCents = earningsMap.get(apptId) || 0
      const paid = paidMap.get(apptId)
      const paidCents = paid?.totalCents || 0
      const paidDate = paid?.latestDate || null
      const insurerPaid = insurerPaidMap.get(apptId) || 0

      // Claim status via pq_appointment_id
      let claimStatus = appt.pq_appointment_id
        ? claimStatusMap.get(appt.pq_appointment_id) || null
        : null
      // Upgrade to 'paid' if insurer has paid
      if (claimStatus === 'accepted' && insurerPaid > 0) claimStatus = 'paid'
      if (!claimStatus && insurerPaid > 0) claimStatus = 'paid'

      const isProviderPaid = paidCents > 0
      const isReimbursed = insurerPaid > 0

      let status: 'paid' | 'unpaid' | 'ready'
      if (isProviderPaid) {
        status = 'paid'
      } else if (isReimbursed) {
        status = 'ready'
      } else {
        status = 'unpaid'
      }

      const date = appt.start_time?.split('T')[0] || ''

      items.push({
        appointmentId: apptId,
        date,
        patientLastName: lastName,
        service,
        claimStatus,
        earnedCents,
        paidCents,
        paidDate,
        reimbursedCents: Math.round(insurerPaid * 100),
        status,
      })
    }

    // Sort by date descending
    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

    // Calculate summary from ALL items (before filtering)
    const totalEarnedCents = items.reduce((s, i) => s + i.earnedCents, 0)
    const totalPaidCents = items.reduce((s, i) => s + i.paidCents, 0)
    const totalOwedCents = totalEarnedCents - totalPaidCents
    const paidCount = items.filter(i => i.status === 'paid').length
    const readyCount = items.filter(i => i.status === 'ready').length
    const totalAppointments = items.length

    // Apply search filter
    if (search) {
      items = items.filter(i =>
        i.patientLastName.toLowerCase().includes(search) ||
        i.service.toLowerCase().includes(search)
      )
    }

    // Apply status filter
    if (filter === 'paid') items = items.filter(i => i.status === 'paid')
    else if (filter === 'unpaid') items = items.filter(i => i.status === 'unpaid')
    else if (filter === 'ready') items = items.filter(i => i.status === 'ready')

    return NextResponse.json({
      success: true,
      provider: { id: provider.id, name: `${provider.first_name} ${provider.last_name}` },
      items,
      summary: {
        totalAppointments,
        totalEarnedCents,
        totalPaidCents,
        totalOwedCents,
        paidCount,
        unpaidCount: totalAppointments - paidCount,
        readyCount,
      },
    })
  } catch (error: any) {
    console.error('Provider compensation error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

function emptySummary() {
  return {
    totalAppointments: 0,
    totalEarnedCents: 0,
    totalPaidCents: 0,
    totalOwedCents: 0,
    paidCount: 0,
    unpaidCount: 0,
    readyCount: 0,
  }
}
