// Authentication Context and Role Management
// Handles multi-role users (admin + provider + partner) with session-based context switching

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'
import { isAdminEmail } from './admin-auth'

export type UserContext = 'admin' | 'provider' | 'partner'

export interface UserRole {
  role: 'admin' | 'provider' | 'partner'
  hasAccess: boolean
  data?: any // Provider data for provider role, partner data for partner role
}

export interface AuthContextData {
  user: any
  availableRoles: UserRole[]
  activeContext: UserContext | null
  canSwitchContext: boolean
}

class AuthContextManager {
  private storageKey = 'moonlit_active_context'

  /**
   * Lazy initialization of Supabase client to avoid SSR issues
   */
  private getSupabase() {
    return createClientComponentClient<Database>()
  }

  /**
   * Get the user's available roles and current context
   */
  async getUserAuthContext(): Promise<AuthContextData> {
    const supabase = this.getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return {
        user: null,
        availableRoles: [],
        activeContext: null,
        canSwitchContext: false
      }
    }

    const availableRoles: UserRole[] = []
    const userIsAdmin = isAdminEmail(user.email || '')

    // Check admin role
    if (userIsAdmin) {
      availableRoles.push({
        role: 'admin',
        hasAccess: true
      })
    }

    // Check provider role
    try {
      const { data: providerData, error} = await supabase
        .from('providers')
        .select('*')
        .eq('auth_user_id', user.id)
        .eq('is_active', true)
        .single()

      if (!error && providerData) {
        availableRoles.push({
          role: 'provider',
          hasAccess: true,
          data: providerData
        })
      } else if (userIsAdmin) {
        // Admins can always access provider dashboard (via impersonation)
        availableRoles.push({
          role: 'provider',
          hasAccess: true,
          data: null
        })
      }
    } catch (providerError) {
      // Provider role not available for this user
      console.log('Provider role not found for user:', user.email)

      // Admins can still access provider dashboard (via impersonation)
      if (userIsAdmin) {
        availableRoles.push({
          role: 'provider',
          hasAccess: true,
          data: null
        })
      }
    }

    // Check partner role
    try {
      const { data: partnerData, error } = await supabase
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
        .eq('auth_user_id', user.id)
        .eq('is_active', true)
        .single()

      if (!error && partnerData) {
        availableRoles.push({
          role: 'partner',
          hasAccess: true,
          data: partnerData
        })
      } else if (userIsAdmin) {
        // Admins can always access partner dashboard (via impersonation)
        availableRoles.push({
          role: 'partner',
          hasAccess: true,
          data: null
        })
      }
    } catch (partnerError) {
      // Partner role not available for this user
      console.log('Partner role not found for user:', user.email)

      // Admins can still access partner dashboard (via impersonation)
      if (userIsAdmin) {
        availableRoles.push({
          role: 'partner',
          hasAccess: true,
          data: null
        })
      }
    }

    const canSwitchContext = availableRoles.length > 1
    const activeContext = this.getStoredContext()

    // Validate stored context is available
    const validContext = availableRoles.find(role => role.role === activeContext)
    const finalContext = validContext ? activeContext : (availableRoles[0]?.role || null)

    return {
      user,
      availableRoles,
      activeContext: finalContext,
      canSwitchContext
    }
  }

  /**
   * Set the active context for the current session
   */
  setActiveContext(context: UserContext): void {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(this.storageKey, context)
      // Also store in localStorage for persistence across sessions
      localStorage.setItem(this.storageKey, context)
    }
  }

  /**
   * Get the stored context preference
   */
  getStoredContext(): UserContext | null {
    if (typeof window === 'undefined') return null

    // Try sessionStorage first (current session), then localStorage (persistent)
    const sessionContext = sessionStorage.getItem(this.storageKey) as UserContext
    const localContext = localStorage.getItem(this.storageKey) as UserContext
    
    return sessionContext || localContext
  }

  /**
   * Clear stored context (for logout)
   */
  clearStoredContext(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(this.storageKey)
      localStorage.removeItem(this.storageKey)
    }
  }

  /**
   * Get the appropriate dashboard route for a context
   */
  getDashboardRoute(context: UserContext): string {
    switch (context) {
      case 'admin':
        return '/admin'
      case 'provider':
        return '/dashboard'
      case 'partner':
        return '/partner-dashboard'
      default:
        return '/auth/login'
    }
  }

  /**
   * Check if current user has access to a specific context
   */
  async hasContextAccess(context: UserContext): Promise<boolean> {
    const authContext = await this.getUserAuthContext()
    return authContext.availableRoles.some(role => role.role === context && role.hasAccess)
  }

  /**
   * Get provider data for provider context
   */
  async getProviderData(): Promise<any | null> {
    const authContext = await this.getUserAuthContext()
    const providerRole = authContext.availableRoles.find(role => role.role === 'provider')
    return providerRole?.data || null
  }
}

// Export singleton instance
export const authContextManager = new AuthContextManager()
export default authContextManager