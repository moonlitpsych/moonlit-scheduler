/**
 * Monthly Provider Transitions Cron
 *
 * POST /api/cron/monthly-provider-transitions
 *
 * Runs on the 1st of every month at 9:00 AM UTC.
 * - Detects residents whose graduation date falls within the next 4 months
 *   and creates one `provider_transitions` row per resident (idempotent).
 * - Sends a digest email to hello@trymoonlit.com summarizing all currently
 *   open transitions plus any past-effective ones still awaiting action.
 *
 * Configured in vercel.json: schedule "0 9 1 * *"
 *
 * See plan: ~/.claude/plans/starry-spinning-lerdorf.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { emailService } from '@/lib/services/emailService'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DETECTION_WINDOW_MONTHS = 4

interface ResidentRow {
  id: string
  first_name: string | null
  last_name: string | null
  title: string | null
  role: string | null
  residency_org: string | null
  residency_grad_year: number | null
  residency_grad_month: number | null
}

function gradDateFor(p: ResidentRow): Date | null {
  if (!p.residency_grad_year) return null
  const month = p.residency_grad_month ?? 6 // default June if month unset
  // Day-of-month is approximated; the cron only cares about month-precision
  return new Date(p.residency_grad_year, month - 1, 30)
}

function fmtDate(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d
  return dt.toISOString().split('T')[0]
}

function dayDiff(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('🗓️ [Transitions Cron] Starting monthly detection...')

  const now = new Date()
  const windowEnd = new Date(now)
  windowEnd.setMonth(windowEnd.getMonth() + DETECTION_WINDOW_MONTHS)

  const stats = {
    residentsScanned: 0,
    transitionsCreated: 0,
    transitionsAlreadyOpen: 0,
    detectionErrors: [] as Array<{ providerId: string; error: string }>,
  }

  // 1. Pull active residents with a graduation year set
  const { data: residents, error: residentsError } = await supabaseAdmin
    .from('providers')
    .select('id, first_name, last_name, title, role, residency_org, residency_grad_year, residency_grad_month')
    .eq('is_active', true)
    .not('residency_grad_year', 'is', null)

  if (residentsError) {
    console.error('❌ [Transitions Cron] Failed to load providers:', residentsError)
    return NextResponse.json({ error: 'Failed to load providers' }, { status: 500 })
  }

  // Filter to "looks like a resident" — role contains 'resident' OR title contains 'resident'
  const candidateResidents: ResidentRow[] = (residents || []).filter((p: any) => {
    const role = (p.role || '').toLowerCase()
    const title = (p.title || '').toLowerCase()
    return role.includes('resident') || title.includes('resident')
  })

  for (const r of candidateResidents) {
    stats.residentsScanned++
    const grad = gradDateFor(r)
    if (!grad) continue
    if (grad < now || grad > windowEnd) continue // outside the 4-month window

    // Idempotency: skip if an open residency_graduation row already exists
    const { data: existing } = await supabaseAdmin
      .from('provider_transitions')
      .select('id')
      .eq('provider_id', r.id)
      .eq('transition_type', 'residency_graduation')
      .in('status', ['upcoming', 'in_progress', 'bridged', 'deferred'])
      .maybeSingle()

    if (existing) {
      stats.transitionsAlreadyOpen++
      continue
    }

    const { error: insertError } = await supabaseAdmin
      .from('provider_transitions')
      .insert({
        provider_id: r.id,
        transition_type: 'residency_graduation',
        status: 'upcoming',
        effective_date: fmtDate(grad),
        detected_by: 'cron:monthly_provider_transitions',
      })

    if (insertError) {
      stats.detectionErrors.push({ providerId: r.id, error: insertError.message })
      continue
    }
    stats.transitionsCreated++
  }

  // 2. Build digest payload — all currently-open transitions
  const { data: openTransitions } = await supabaseAdmin
    .from('provider_transitions')
    .select(`
      id,
      transition_type,
      status,
      effective_date,
      bridge_until,
      provider:providers!inner(id, first_name, last_name, title, residency_org)
    `)
    .in('status', ['upcoming', 'in_progress', 'bridged', 'deferred'])
    .order('effective_date', { ascending: true })

  // 3. Identify supervision-succession candidates: active attendings (role
  //    excludes 'resident') who are NOT currently the supervisor of anyone.
  const { data: attendings } = await supabaseAdmin
    .from('providers')
    .select('id, first_name, last_name, role, title')
    .eq('is_active', true)

  const attendingPool = (attendings || []).filter((p: any) => {
    const role = (p.role || '').toLowerCase()
    const title = (p.title || '').toLowerCase()
    return !role.includes('resident') && !title.includes('resident')
  })

  let succession: typeof attendingPool = []
  if (attendingPool.length > 0) {
    const ids = attendingPool.map(p => p.id)
    const { data: activeSupervisorRows } = await supabaseAdmin
      .from('supervision_relationships')
      .select('supervisor_provider_id')
      .in('supervisor_provider_id', ids)
      .eq('is_active', true)

    const supervisorIds = new Set((activeSupervisorRows || []).map((r: any) => r.supervisor_provider_id))
    succession = attendingPool.filter(p => !supervisorIds.has(p.id))
  }

  // 4. Compose digest email
  const lines: string[] = []
  lines.push('🗓️ Monthly Provider Transitions Digest')
  lines.push('')
  lines.push(`Detection window: today through ${fmtDate(windowEnd)}`)
  lines.push(`Residents scanned: ${stats.residentsScanned}`)
  lines.push(`New transitions created this run: ${stats.transitionsCreated}`)
  lines.push(`Already-open transitions skipped: ${stats.transitionsAlreadyOpen}`)
  if (stats.detectionErrors.length) {
    lines.push(`⚠️ Detection errors: ${stats.detectionErrors.length}`)
  }
  lines.push('')
  lines.push('OPEN TRANSITIONS')
  lines.push('---')

  if (!openTransitions || openTransitions.length === 0) {
    lines.push('No open transitions.')
  } else {
    for (const t of openTransitions as any[]) {
      const provider = t.provider
      const name = `${provider?.first_name || ''} ${provider?.last_name || ''}`.trim() || 'Unknown'
      const eff = new Date(t.effective_date)
      const days = dayDiff(now, eff)
      const dayLabel = days >= 0 ? `${days} days out` : `${Math.abs(days)} days OVERDUE`
      lines.push(`• [${t.status}] ${name} — ${t.transition_type} on ${t.effective_date} (${dayLabel})`)
      if (t.bridge_until) lines.push(`    bridged through ${t.bridge_until}`)
    }
  }

  lines.push('')
  lines.push('SUPERVISION SUCCESSION CANDIDATES')
  lines.push('(active attendings without an active supervisee)')
  lines.push('---')
  if (succession.length === 0) {
    lines.push('None — every attending is currently supervising someone.')
  } else {
    for (const a of succession) {
      lines.push(`• ${a.first_name || ''} ${a.last_name || ''}`.trim())
    }
  }

  lines.push('')
  lines.push('---')
  lines.push('Open the admin page: https://trymoonlit.com/admin/transitions')

  try {
    await emailService.sendEmail({
      to: 'hello@trymoonlit.com',
      subject: `Provider Transitions Digest — ${fmtDate(now)}`,
      body: lines.join('\n'),
    })
  } catch (err: any) {
    console.error('❌ [Transitions Cron] Digest email failed:', err.message)
  }

  const duration = Date.now() - startTime
  console.log(`✅ [Transitions Cron] Done in ${duration}ms`, stats)

  return NextResponse.json({
    success: true,
    duration_ms: duration,
    stats,
    open_transition_count: openTransitions?.length || 0,
    succession_candidate_count: succession.length,
  })
}
