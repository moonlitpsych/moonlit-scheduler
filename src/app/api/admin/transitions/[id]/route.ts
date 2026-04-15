/**
 * Per-transition actions
 *
 * PATCH /api/admin/transitions/[id]
 *   body: { action: 'bridge'|'promote'|'defer'|'cancel'|'mark_complete', ...args }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

async function verifyAdminAccess() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user || !(await isAdminEmail(user.email || ''))) {
    return { authorized: false, user: null, email: null }
  }
  return { authorized: true, user, email: user.email }
}

async function loadTransition(id: string) {
  const { data, error } = await supabaseAdmin
    .from('provider_transitions')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data
}

async function audit(adminEmail: string, providerId: string, actionType: string, description: string, recordId: string, changes: any) {
  await supabaseAdmin.from('admin_action_logs').insert({
    admin_email: adminEmail,
    provider_id: providerId,
    action_type: actionType,
    description,
    table_name: 'provider_transitions',
    record_id: recordId,
    changes,
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, email } = await verifyAdminAccess()
  if (!authorized || !email) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json() as {
    action: 'bridge' | 'promote' | 'defer' | 'cancel' | 'mark_complete'
    bridge_until?: string
    new_effective_date?: string
    notes?: string
    will_continue_at_moonlit?: boolean
    interested_in_supervising?: boolean
  }

  const transition = await loadTransition(id)
  if (!transition) {
    return NextResponse.json({ success: false, error: 'Transition not found' }, { status: 404 })
  }

  switch (body.action) {
    // ----- Bridge: extend supervision past the effective date -----
    case 'bridge': {
      if (!body.bridge_until) {
        return NextResponse.json({ success: false, error: 'bridge_until required' }, { status: 400 })
      }

      // Update active supervision rows where this provider is the supervisee
      const { error: supError } = await supabaseAdmin
        .from('supervision_relationships')
        .update({ end_date: body.bridge_until })
        .eq('supervisee_provider_id', transition.provider_id)
        .eq('is_active', true)

      if (supError) {
        return NextResponse.json({ success: false, error: supError.message }, { status: 500 })
      }

      const { data: updated, error } = await supabaseAdmin
        .from('provider_transitions')
        .update({
          status: 'bridged',
          bridge_until: body.bridge_until,
          notes: body.notes ?? transition.notes,
        })
        .eq('id', id)
        .select('*')
        .single()

      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

      await audit(email, transition.provider_id, 'transition_bridge',
        `Bridged supervision through ${body.bridge_until}`,
        id, { from_status: transition.status, bridge_until: body.bridge_until })

      return NextResponse.json({ success: true, transition: updated })
    }

    // ----- Promote (graduations): flip role, end-date supervisions, queue credentialing -----
    case 'promote': {
      if (transition.transition_type !== 'residency_graduation') {
        return NextResponse.json({ success: false, error: 'Promote only applies to residency_graduation' }, { status: 400 })
      }

      // Promote is only valid during the standard residency-graduation
      // window (June or July). Outside of that window, use Bridge or Defer.
      const month = new Date().getUTCMonth() + 1
      if (month !== 6 && month !== 7) {
        return NextResponse.json(
          { success: false, error: 'Promote is only available in June or July (residency graduation window). Use Bridge or Defer instead.' },
          { status: 400 }
        )
      }

      // 1. Flip role on the providers row
      const { error: roleErr } = await supabaseAdmin
        .from('providers')
        .update({ role: 'psychiatrist' })
        .eq('id', transition.provider_id)
      if (roleErr) return NextResponse.json({ success: false, error: roleErr.message }, { status: 500 })

      // 2. Find supervision rows that need to be ended — capture payer ids before update
      const { data: openSups } = await supabaseAdmin
        .from('supervision_relationships')
        .select('id, payer_id')
        .eq('supervisee_provider_id', transition.provider_id)
        .eq('is_active', true)

      const payerIds = (openSups || []).map((s: any) => s.payer_id)

      // 3. End-date them at the transition's effective_date
      if (openSups && openSups.length > 0) {
        const { error: endErr } = await supabaseAdmin
          .from('supervision_relationships')
          .update({ end_date: transition.effective_date, is_active: false })
          .in('id', openSups.map((s: any) => s.id))
        if (endErr) return NextResponse.json({ success: false, error: endErr.message }, { status: 500 })
      }

      // 4. Create per-payer credentialing tasks for direct contracts
      if (payerIds.length > 0) {
        const dueDate = new Date(transition.effective_date)
        dueDate.setDate(dueDate.getDate() + 90)
        const dueIso = dueDate.toISOString().split('T')[0]

        const taskRows = payerIds.map((payerId: string) => ({
          provider_id: transition.provider_id,
          payer_id: payerId,
          task_type: 'direct_contract_application',
          title: 'Apply for direct contract (post-graduation)',
          description: 'Resident graduated; needs own credentialing with this payer.',
          task_status: 'pending',
          due_date: dueIso,
          created_by: email,
        }))

        const { error: taskErr } = await supabaseAdmin
          .from('provider_credentialing_tasks')
          .insert(taskRows)
        if (taskErr) {
          console.warn('Promote: credentialing task insert failed (continuing):', taskErr.message)
        }
      }

      // 5. Mark transition completed
      const { data: updated, error } = await supabaseAdmin
        .from('provider_transitions')
        .update({
          status: 'completed',
          resolved_at: new Date().toISOString(),
          resolved_by: email,
          will_continue_at_moonlit: body.will_continue_at_moonlit ?? transition.will_continue_at_moonlit,
          interested_in_supervising: body.interested_in_supervising ?? transition.interested_in_supervising,
          notes: body.notes ?? transition.notes,
        })
        .eq('id', id)
        .select('*')
        .single()
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

      await audit(email, transition.provider_id, 'transition_promote',
        `Promoted to attending; ended ${openSups?.length || 0} supervisions; queued ${payerIds.length} credentialing tasks`,
        id, {
          previous_role: 'psychiatry_resident',
          new_role: 'psychiatrist',
          ended_supervision_ids: (openSups || []).map((s: any) => s.id),
          credentialing_tasks_created: payerIds.length,
        })

      return NextResponse.json({ success: true, transition: updated })
    }

    // ----- Defer: push effective_date out -----
    case 'defer': {
      if (!body.new_effective_date) {
        return NextResponse.json({ success: false, error: 'new_effective_date required' }, { status: 400 })
      }
      const { data: updated, error } = await supabaseAdmin
        .from('provider_transitions')
        .update({
          status: 'upcoming',
          effective_date: body.new_effective_date,
          notes: body.notes ?? transition.notes,
        })
        .eq('id', id)
        .select('*')
        .single()
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

      await audit(email, transition.provider_id, 'transition_defer',
        `Deferred to ${body.new_effective_date}`,
        id, { from_date: transition.effective_date, to_date: body.new_effective_date })

      return NextResponse.json({ success: true, transition: updated })
    }

    // ----- Cancel -----
    case 'cancel': {
      const { data: updated, error } = await supabaseAdmin
        .from('provider_transitions')
        .update({
          status: 'cancelled',
          resolved_at: new Date().toISOString(),
          resolved_by: email,
          notes: body.notes ?? transition.notes,
        })
        .eq('id', id)
        .select('*')
        .single()
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

      await audit(email, transition.provider_id, 'transition_cancel',
        'Transition cancelled',
        id, { from_status: transition.status })

      return NextResponse.json({ success: true, transition: updated })
    }

    // ----- Mark complete (for non-graduation types) -----
    case 'mark_complete': {
      // For attending_departure / termination / leave, end-date their active supervisions too
      if (['attending_departure', 'attending_termination', 'leave_of_absence'].includes(transition.transition_type)) {
        await supabaseAdmin
          .from('supervision_relationships')
          .update({ end_date: transition.effective_date, is_active: false })
          .or(`supervisee_provider_id.eq.${transition.provider_id},supervisor_provider_id.eq.${transition.provider_id}`)
          .eq('is_active', true)
      }

      const { data: updated, error } = await supabaseAdmin
        .from('provider_transitions')
        .update({
          status: 'completed',
          resolved_at: new Date().toISOString(),
          resolved_by: email,
          notes: body.notes ?? transition.notes,
        })
        .eq('id', id)
        .select('*')
        .single()
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

      await audit(email, transition.provider_id, 'transition_mark_complete',
        `Transition marked complete (${transition.transition_type})`,
        id, { from_status: transition.status })

      return NextResponse.json({ success: true, transition: updated })
    }

    default:
      return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
  }
}
