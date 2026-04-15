/**
 * Admin Provider Transitions API
 *
 * GET  /api/admin/transitions  — list all open transitions enriched with
 *                                provider + downstream-effect info
 * POST /api/admin/transitions  — admin creates a transition manually
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'
import type { ProviderTransitionType, ProviderTransitionEnriched } from '@/types/provider-transitions'

export const dynamic = 'force-dynamic'

async function verifyAdminAccess() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user || !(await isAdminEmail(user.email || ''))) {
    return { authorized: false, user: null, email: null }
  }
  return { authorized: true, user, email: user.email }
}

export async function GET(request: NextRequest) {
  const { authorized } = await verifyAdminAccess()
  if (!authorized) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const includeClosed = searchParams.get('includeClosed') === 'true'

  let query = supabaseAdmin
    .from('provider_transitions')
    .select(`
      *,
      provider:providers!inner(id, first_name, last_name, title, role, residency_org, residency_grad_year, residency_grad_month)
    `)
    .order('effective_date', { ascending: true })

  if (!includeClosed) {
    query = query.in('status', ['upcoming', 'in_progress', 'bridged', 'deferred'])
  }

  const { data: transitions, error: txError } = await query
  if (txError) {
    console.error('Failed to load transitions:', txError)
    return NextResponse.json({ success: false, error: txError.message }, { status: 500 })
  }

  // Enrich each transition with active supervisions + future appointment count
  const enriched: ProviderTransitionEnriched[] = []
  const now = new Date()

  for (const t of (transitions || []) as any[]) {
    // Active supervisions where this provider is the supervisee
    const { data: sups } = await supabaseAdmin
      .from('supervision_relationships')
      .select(`
        id,
        supervisor_provider_id,
        payer_id,
        end_date,
        supervisor:providers!supervision_relationships_supervisor_provider_id_fkey(first_name, last_name),
        payer:payers(name)
      `)
      .eq('supervisee_provider_id', t.provider_id)
      .eq('is_active', true)

    const activeSupervisions = (sups || []).map((s: any) => ({
      id: s.id,
      supervisor_provider_id: s.supervisor_provider_id,
      supervisor_name: `${s.supervisor?.first_name || ''} ${s.supervisor?.last_name || ''}`.trim() || 'Unknown',
      payer_id: s.payer_id,
      payer_name: s.payer?.name || 'Unknown',
      end_date: s.end_date,
    }))

    // Future appointment count for this provider
    const { count: futureCount } = await supabaseAdmin
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('provider_id', t.provider_id)
      .gte('start_time', new Date().toISOString())
      .not('status', 'in', '(cancelled,no_show)')

    const eff = new Date(t.effective_date)
    const days = Math.round((eff.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    enriched.push({
      ...t,
      active_supervisions: activeSupervisions,
      future_appointment_count: futureCount || 0,
      days_until_effective: days,
    })
  }

  // Supervision-succession candidates: active attendings with no active
  // supervisee. "Attending" = anyone who is NOT a current resident (no
  // residency_grad_year, or grad date already in the past).
  const { data: attendings } = await supabaseAdmin
    .from('providers')
    .select('id, first_name, last_name, role, title, residency_grad_year, residency_grad_month')
    .eq('is_active', true)

  const todayMs = Date.now()
  const attendingPool = (attendings || []).filter((p: any) => {
    if (!p.residency_grad_year) return true // never a resident on file
    const month = p.residency_grad_month ?? 6
    const gradMs = new Date(p.residency_grad_year, month - 1, 30).getTime()
    return gradMs < todayMs // graduated already → attending
  })

  let succession: any[] = []
  if (attendingPool.length > 0) {
    const ids = attendingPool.map((p: any) => p.id)
    const { data: activeSupervisorRows } = await supabaseAdmin
      .from('supervision_relationships')
      .select('supervisor_provider_id')
      .in('supervisor_provider_id', ids)
      .eq('is_active', true)

    const supervisorIds = new Set((activeSupervisorRows || []).map((r: any) => r.supervisor_provider_id))
    succession = attendingPool.filter((p: any) => !supervisorIds.has(p.id))
  }

  return NextResponse.json({
    success: true,
    transitions: enriched,
    succession_candidates: succession,
  })
}

export async function POST(request: NextRequest) {
  const { authorized, email } = await verifyAdminAccess()
  if (!authorized || !email) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
  }

  const body = await request.json() as {
    provider_id: string
    transition_type: ProviderTransitionType
    effective_date: string
    notes?: string
  }

  if (!body.provider_id || !body.transition_type || !body.effective_date) {
    return NextResponse.json(
      { success: false, error: 'provider_id, transition_type, and effective_date are required' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('provider_transitions')
    .insert({
      provider_id: body.provider_id,
      transition_type: body.transition_type,
      status: 'upcoming',
      effective_date: body.effective_date,
      detected_by: email,
      notes: body.notes || null,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  // Audit
  await supabaseAdmin.from('admin_action_logs').insert({
    admin_email: email,
    provider_id: body.provider_id,
    action_type: 'transition_created',
    description: `Created ${body.transition_type} transition effective ${body.effective_date}`,
    table_name: 'provider_transitions',
    record_id: data.id,
    changes: { transition_type: body.transition_type, effective_date: body.effective_date },
  })

  return NextResponse.json({ success: true, transition: data })
}
