// Partner Impersonation Manager
// Allows admins to view partner dashboards as specific partners for support purposes

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'

export interface ImpersonatedPartner {
  id: string
  auth_user_id: string | null
  organization_id: string
  full_name: string
  email: string
  phone: string | null
  role: string
  is_active: boolean
  organization?: {
    id: string
    name: string
  }
}

export interface PartnerImpersonationContext {
  partner: ImpersonatedPartner
  impersonatedBy: string // Admin email
  impersonatedAt: string // ISO timestamp
}

class PartnerImpersonationManager {
  private storageKey = 'moonlit_impersonated_partner'

  /**
   * Lazy initialization of Supabase client to avoid SSR issues
   */
  private getSupabase() {
    return createClientComponentClient<Database>()
  }

  /**
   * Set the partner to impersonate
   */
  setImpersonatedPartner(partner: ImpersonatedPartner, adminEmail: string): void {
    if (typeof window === 'undefined') return

    const context: PartnerImpersonationContext = {
      partner,
      impersonatedBy: adminEmail,
      impersonatedAt: new Date().toISOString()
    }

    sessionStorage.setItem(this.storageKey, JSON.stringify(context))
  }

  /**
   * Get the currently impersonated partner
   */
  getImpersonatedPartner(): PartnerImpersonationContext | null {
    if (typeof window === 'undefined') return null

    const stored = sessionStorage.getItem(this.storageKey)
    if (!stored) return null

    try {
      return JSON.parse(stored) as PartnerImpersonationContext
    } catch (error) {
      console.error('Error parsing partner impersonation context:', error)
      return null
    }
  }

  /**
   * Clear impersonation (exit partner view)
   */
  clearImpersonation(): void {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem(this.storageKey)
  }

  /**
   * Check if currently impersonating
   */
  isImpersonating(): boolean {
    return this.getImpersonatedPartner() !== null
  }

  /**
   * Get all partners for selection (including inactive)
   */
  async getAllPartners(): Promise<ImpersonatedPartner[]> {
    try {
      const response = await fetch('/api/admin/partner-users')
      const result = await response.json()

      if (!result.success) {
        console.error('Error fetching partners:', result.error)
        return []
      }

      return result.data as ImpersonatedPartner[]
    } catch (error) {
      console.error('Error fetching partners:', error)
      return []
    }
  }

  /**
   * Get partner by ID
   */
  async getPartnerById(partnerId: string): Promise<ImpersonatedPartner | null> {
    const supabase = this.getSupabase()
    const { data, error } = await supabase
      .from('partner_users')
      .select(`
        id,
        auth_user_id,
        organization_id,
        full_name,
        email,
        phone,
        role,
        is_active,
        organization:organizations(
          id,
          name
        )
      `)
      .eq('id', partnerId)
      .single()

    if (error) {
      console.error('Error fetching partner:', error)
      return null
    }

    return data as ImpersonatedPartner
  }

  /**
   * Create audit log entry for admin action on behalf of partner
   */
  async logAdminAction(action: {
    partnerId: string
    actionType: string
    description: string
    tableName?: string
    recordId?: string
    changes?: any
  }): Promise<void> {
    const impersonation = this.getImpersonatedPartner()
    if (!impersonation) return

    try {
      const supabase = this.getSupabase()
      const { error } = await supabase
        .from('admin_action_logs')
        .insert({
          admin_email: impersonation.impersonatedBy,
          provider_id: null, // Not a provider action
          action_type: action.actionType,
          description: action.description,
          table_name: action.tableName,
          record_id: action.recordId,
          changes: action.changes,
          created_at: new Date().toISOString()
        })

      if (error) {
        console.error('Error logging admin action:', error)
        // Don't throw - logging failure shouldn't break functionality
      }
    } catch (error) {
      console.error('Error in logAdminAction:', error)
    }
  }
}

// Export singleton instance
export const partnerImpersonationManager = new PartnerImpersonationManager()
export default partnerImpersonationManager
