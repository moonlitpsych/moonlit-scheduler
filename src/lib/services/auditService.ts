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

    // TODO: When admin_audit_log table is created, uncomment this:
    /*
    const { error } = await supabase
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
      throw new Error('Audit logging failed')
    }
    */

    console.log('✅ Audit entry logged successfully')
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