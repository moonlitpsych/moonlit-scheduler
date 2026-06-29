import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export interface AuditLogEntry {
  actorUserId: string
  action: 'update_payer' | 'upsert_ppn' | 'seed_supervision' | 'delete_ppn' | 'delete_supervision'
  entity: 'payers' | 'provider_payer_networks' | 'supervision_relationships'
  entityId: string
  before: any
  after: any
  note: string
}

export async function logAdminAudit(entry: AuditLogEntry): Promise<void> {
  try {
    console.log('📝 Audit Log:', {
      actor: entry.actorUserId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      note: entry.note,
      timestamp: new Date().toISOString()
    })

    // Persist to admin_audit_log (migration 094). Best-effort: a logging failure
    // must never block or roll back the underlying admin operation, so we record
    // the error but do not throw. If the table is missing (migration not yet run),
    // this no-ops gracefully via the catch below.
    // Cast: admin_audit_log (migration 094) is not yet in the generated Database types.
    const { error } = await (supabase as any)
      .from('admin_audit_log')
      .insert({
        actor_user_id: entry.actorUserId,
        action: entry.action,
        entity: entry.entity,
        entity_id: entry.entityId,
        before_data: entry.before,
        after_data: entry.after,
        note: entry.note,
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('❌ Failed to log audit entry:', error)
    } else {
      console.log('✅ Audit entry logged successfully')
    }
  } catch (error) {
    console.error('❌ Audit logging error:', error)
    // For now, don't throw to avoid blocking operations
    // In production, you might want to throw to ensure audit trail
  }
}

export async function validateAdminUser(userId: string): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from('auth_profiles')
      .select('role')
      .eq('user_id', userId)
      .single()

    return profile?.role === 'admin'
  } catch (error) {
    console.error('❌ Admin validation error:', error)
    return false
  }
}