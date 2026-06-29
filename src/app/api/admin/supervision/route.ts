/**
 * Admin Supervision Management API
 *
 * GET  /api/admin/supervision  — all supervision relationships enriched with
 *      provider + payer names, plus the provider/payer lists the UI needs for
 *      filters, reassignment, and the phase-out macro.
 *
 * POST /api/admin/supervision  — bulk, NON-destructive edits over a set of rows
 *      (selected by explicit ids OR a filter). Actions: end_date, deactivate,
 *      reactivate, reassign. Hard delete is intentionally NOT exposed here — per
 *      product decision, deletes are SQL/admin-only. Every change is written to
 *      admin_audit_log (before/after).
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const today = () => new Date().toISOString().split('T')[0]

export async function GET() {
  try {
    const { data: rels, error } = await supabaseAdmin
      .from('supervision_relationships')
      .select('id, supervisor_provider_id, supervisee_provider_id, payer_id, start_date, end_date, is_active, supervision_type, supervision_level')
      .order('start_date', { ascending: true })

    if (error) {
      console.error('❌ Error loading supervision relationships:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const { data: providers } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, provider_type, role, is_active')
    const { data: payers } = await supabaseAdmin
      .from('payers')
      .select('id, name, allows_supervised')
      .order('name')

    const provName = new Map((providers || []).map(p => [p.id, `${p.first_name} ${p.last_name}`]))
    const payerName = new Map((payers || []).map(p => [p.id, p.name]))

    const relationships = (rels || []).map(r => ({
      id: r.id,
      supervisor_provider_id: r.supervisor_provider_id,
      supervisor_name: provName.get(r.supervisor_provider_id) || 'Unknown',
      supervisee_provider_id: r.supervisee_provider_id,
      supervisee_name: provName.get(r.supervisee_provider_id) || 'Unknown',
      payer_id: r.payer_id,
      payer_name: payerName.get(r.payer_id) || 'Unknown',
      start_date: r.start_date,
      end_date: r.end_date,
      is_active: r.is_active,
      supervision_type: r.supervision_type,
      supervision_level: r.supervision_level,
    }))

    return NextResponse.json({
      success: true,
      relationships,
      providers: (providers || []).map(p => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`,
        provider_type: p.provider_type,
        role: p.role,
        is_active: p.is_active,
      })),
      payers: payers || [],
    })
  } catch (err: any) {
    console.error('❌ Supervision GET error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

type BulkAction = 'end_date' | 'deactivate' | 'reactivate' | 'reassign' | 'create'

interface BulkBody {
  action: BulkAction
  ids?: string[]
  // Server-side selection for the phase-out macro. Supervision is keyed by
  // (payer, supervisor, supervisee), so the macro is scoped by supervisor and
  // optionally a single payer.
  filter?: { supervisor_provider_id?: string; payer_id?: string; only_active?: boolean }
  params?: {
    end_date?: string | null
    supervisor_provider_id?: string
    start_date?: string
    // create-only
    payer_id?: string
    supervisee_ids?: string[]
    supervision_level?: string | null
  }
  auditNote?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BulkBody
    const { action, ids, filter, params = {}, auditNote } = body

    // ---- CREATE (bulk phase-in): supervisor + payer + N supervisees ----
    if (action === 'create') {
      const { supervisor_provider_id, payer_id, supervisee_ids, start_date, end_date, supervision_level } = params
      if (!supervisor_provider_id || !payer_id || !supervisee_ids?.length || !start_date) {
        return NextResponse.json(
          { success: false, error: 'create requires params: supervisor_provider_id, payer_id, supervisee_ids[], start_date' },
          { status: 400 }
        )
      }
      if (supervisee_ids.includes(supervisor_provider_id)) {
        return NextResponse.json({ success: false, error: 'A supervisor cannot supervise themselves.' }, { status: 400 })
      }
      // Eligibility: supervisor must hold an in-network contract for this payer.
      const { data: contract } = await supabaseAdmin
        .from('provider_payer_networks')
        .select('id')
        .eq('provider_id', supervisor_provider_id)
        .eq('payer_id', payer_id)
        .eq('status', 'in_network')
        .maybeSingle()
      if (!contract) {
        return NextResponse.json(
          { success: false, error: 'Supervisor has no in-network contract for this payer — add the contract first.' },
          { status: 400 }
        )
      }
      // Skip supervisees who already have a row under this supervisor+payer.
      const { data: existing } = await supabaseAdmin
        .from('supervision_relationships')
        .select('supervisee_provider_id')
        .eq('supervisor_provider_id', supervisor_provider_id)
        .eq('payer_id', payer_id)
      const have = new Set((existing || []).map(r => r.supervisee_provider_id))
      const toInsert = supervisee_ids
        .filter(id => !have.has(id))
        .map(id => ({
          supervisor_provider_id,
          supervisee_provider_id: id,
          payer_id,
          supervision_type: 'general',
          supervision_level: supervision_level || 'sign_off_only',
          start_date,
          end_date: end_date || null,
          is_active: true,
          notes: `Created via bulk phase-in${auditNote ? ': ' + auditNote : ''}`,
        }))
      if (toInsert.length === 0) {
        return NextResponse.json({ success: true, affected: 0, skipped: supervisee_ids.length, message: 'All selected supervisees already have a relationship with this supervisor for this payer.' })
      }
      const { data: created, error: insErr } = await supabaseAdmin
        .from('supervision_relationships')
        .insert(toInsert)
        .select('*')
      if (insErr) {
        console.error('❌ Bulk create failed:', insErr)
        return NextResponse.json({ success: false, error: insErr.message }, { status: 500 })
      }
      const auditRows = (created || []).map(r => ({
        actor_user_id: 'admin',
        action: 'create_supervision',
        entity: 'supervision_relationships',
        entity_id: r.id,
        before_data: null,
        after_data: r,
        note: auditNote || 'Bulk phase-in create',
        created_at: new Date().toISOString(),
      }))
      const { error: auditErr } = await (supabaseAdmin as any).from('admin_audit_log').insert(auditRows)
      if (auditErr) console.error('⚠️ Audit log insert failed (non-blocking):', auditErr.message)
      return NextResponse.json({ success: true, affected: created?.length || 0, skipped: supervisee_ids.length - (created?.length || 0) })
    }

    // Resolve the target rows: explicit ids win; otherwise apply the filter.
    let targets: any[] = []
    if (ids && ids.length > 0) {
      const { data } = await supabaseAdmin.from('supervision_relationships').select('*').in('id', ids)
      targets = data || []
    } else if (filter && filter.supervisor_provider_id) {
      let q = supabaseAdmin.from('supervision_relationships').select('*')
        .eq('supervisor_provider_id', filter.supervisor_provider_id)
      if (filter.payer_id) q = q.eq('payer_id', filter.payer_id)
      if (filter.only_active !== false) q = q.eq('is_active', true)
      const { data } = await q
      targets = data || []
    } else {
      return NextResponse.json(
        { success: false, error: 'Provide ids or a filter with supervisor_provider_id' },
        { status: 400 }
      )
    }

    if (targets.length === 0) {
      return NextResponse.json({ success: true, affected: 0, message: 'No matching rows' })
    }

    // Build the patch for the chosen action.
    const buildPatch = (): Record<string, any> => {
      const now = new Date().toISOString()
      switch (action) {
        case 'end_date':
          return { end_date: params.end_date ?? today(), updated_at: now }
        case 'deactivate':
          return { is_active: false, end_date: params.end_date ?? today(), updated_at: now }
        case 'reactivate':
          return { is_active: true, end_date: null, updated_at: now }
        case 'reassign':
          if (!params.supervisor_provider_id) throw new Error('reassign requires params.supervisor_provider_id')
          return {
            supervisor_provider_id: params.supervisor_provider_id,
            ...(params.start_date ? { start_date: params.start_date } : {}),
            updated_at: now,
          }
        default:
          throw new Error(`Unknown action: ${action}`)
      }
    }

    let patch: Record<string, any>
    try { patch = buildPatch() } catch (e: any) {
      return NextResponse.json({ success: false, error: e.message }, { status: 400 })
    }

    // reassign guard: don't let a supervisor supervise themselves.
    if (action === 'reassign') {
      const selfSup = targets.find(t => t.supervisee_provider_id === params.supervisor_provider_id)
      if (selfSup) {
        return NextResponse.json(
          { success: false, error: 'Cannot reassign: the new supervisor is one of the selected supervisees (self-supervision).' },
          { status: 400 }
        )
      }
    }

    const targetIds = targets.map(t => t.id)
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('supervision_relationships')
      .update(patch)
      .in('id', targetIds)
      .select('*')

    if (updErr) {
      console.error('❌ Bulk supervision update failed:', updErr)
      return NextResponse.json({ success: false, error: updErr.message }, { status: 500 })
    }

    // Audit each row (best-effort).
    const note = auditNote || `Bulk supervision ${action}`
    const afterById = new Map((updated || []).map(r => [r.id, r]))
    const auditRows = targets.map(before => ({
      actor_user_id: 'admin',
      action: action === 'reassign' ? 'reassign_supervision' : `${action}_supervision`,
      entity: 'supervision_relationships',
      entity_id: before.id,
      before_data: before,
      after_data: afterById.get(before.id) || null,
      note,
      created_at: new Date().toISOString(),
    }))
    const { error: auditErr } = await (supabaseAdmin as any).from('admin_audit_log').insert(auditRows)
    if (auditErr) console.error('⚠️ Audit log insert failed (non-blocking):', auditErr.message)

    return NextResponse.json({ success: true, affected: updated?.length || 0 })
  } catch (err: any) {
    console.error('❌ Supervision bulk POST error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
