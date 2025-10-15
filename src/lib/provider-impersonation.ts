// Provider Impersonation Manager
// Allows admins to view provider dashboards as specific providers for support purposes

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'

export interface ImpersonatedProvider {
  id: string
  first_name: string
  last_name: string
  email: string
  title: string
  role: string
  auth_user_id: string | null
  is_active: boolean
}

export interface ImpersonationContext {
  provider: ImpersonatedProvider
  impersonatedBy: string // Admin email
  impersonatedAt: string // ISO timestamp
}

class ProviderImpersonationManager {
  private supabase = createClientComponentClient<Database>()
  private storageKey = 'moonlit_impersonated_provider'

  /**
   * Set the provider to impersonate
   */
  setImpersonatedProvider(provider: ImpersonatedProvider, adminEmail: string): void {
    if (typeof window === 'undefined') return

    const context: ImpersonationContext = {
      provider,
      impersonatedBy: adminEmail,
      impersonatedAt: new Date().toISOString()
    }

    sessionStorage.setItem(this.storageKey, JSON.stringify(context))
  }

  /**
   * Get the currently impersonated provider
   */
  getImpersonatedProvider(): ImpersonationContext | null {
    if (typeof window === 'undefined') return null

    const stored = sessionStorage.getItem(this.storageKey)
    if (!stored) return null

    try {
      return JSON.parse(stored) as ImpersonationContext
    } catch (error) {
      console.error('Error parsing impersonation context:', error)
      return null
    }
  }

  /**
   * Clear impersonation (exit provider view)
   */
  clearImpersonation(): void {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem(this.storageKey)
  }

  /**
   * Check if currently impersonating
   */
  isImpersonating(): boolean {
    return this.getImpersonatedProvider() !== null
  }

  /**
   * Get all providers for selection (including inactive)
   */
  async getAllProviders(): Promise<ImpersonatedProvider[]> {
    const { data, error } = await this.supabase
      .from('providers')
      .select('id, first_name, last_name, email, title, role, auth_user_id, is_active')
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true })

    if (error) {
      console.error('Error fetching providers:', error)
      return []
    }

    return data as ImpersonatedProvider[]
  }

  /**
   * Get provider by ID
   */
  async getProviderById(providerId: string): Promise<ImpersonatedProvider | null> {
    const { data, error } = await this.supabase
      .from('providers')
      .select('id, first_name, last_name, email, title, role, auth_user_id, is_active')
      .eq('id', providerId)
      .single()

    if (error) {
      console.error('Error fetching provider:', error)
      return null
    }

    return data as ImpersonatedProvider
  }

  /**
   * Create audit log entry for admin action on behalf of provider
   */
  async logAdminAction(action: {
    providerId: string
    actionType: string
    description: string
    tableName?: string
    recordId?: string
    changes?: any
  }): Promise<void> {
    const impersonation = this.getImpersonatedProvider()
    if (!impersonation) return

    try {
      const { error } = await this.supabase
        .from('admin_action_logs')
        .insert({
          admin_email: impersonation.impersonatedBy,
          provider_id: action.providerId,
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
export const providerImpersonationManager = new ProviderImpersonationManager()
export default providerImpersonationManager
