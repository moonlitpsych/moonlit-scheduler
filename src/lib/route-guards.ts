// Route Guards for Context-based Access Control
// Ensures users can only access routes appropriate to their active context

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'
import { authContextManager, UserContext } from './auth-context'

export interface RouteGuardResult {
  allowed: boolean
  redirectTo?: string
  reason?: string
}

class RouteGuardManager {
  private supabase = createClientComponentClient<Database>()

  /**
   * Check if current user can access admin routes
   */
  async canAccessAdminRoute(): Promise<RouteGuardResult> {
    try {
      const authContext = await authContextManager.getUserAuthContext()
      
      if (!authContext.user) {
        return {
          allowed: false,
          redirectTo: '/auth/login',
          reason: 'Not authenticated'
        }
      }

      // Check if user has admin role
      const hasAdminRole = authContext.availableRoles.some(role => role.role === 'admin')
      if (!hasAdminRole) {
        return {
          allowed: false,
          redirectTo: '/dashboard',
          reason: 'Admin access not available'
        }
      }

      // If user has multiple roles, check active context
      if (authContext.canSwitchContext) {
        const activeContext = authContextManager.getStoredContext()
        if (activeContext !== 'admin') {
          return {
            allowed: false,
            redirectTo: '/choose-context',
            reason: 'Admin context not active'
          }
        }
      }

      return { allowed: true }
    } catch (error) {
      console.error('Error checking admin route access:', error)
      return {
        allowed: false,
        redirectTo: '/auth/login',
        reason: 'Authentication error'
      }
    }
  }

  /**
   * Check if current user can access provider routes
   */
  async canAccessProviderRoute(): Promise<RouteGuardResult> {
    try {
      const authContext = await authContextManager.getUserAuthContext()
      
      if (!authContext.user) {
        return {
          allowed: false,
          redirectTo: '/auth/login',
          reason: 'Not authenticated'
        }
      }

      // Check if user has provider role
      const hasProviderRole = authContext.availableRoles.some(role => role.role === 'provider')
      if (!hasProviderRole) {
        return {
          allowed: false,
          redirectTo: '/admin',
          reason: 'Provider access not available'
        }
      }

      // If user has multiple roles, check active context
      if (authContext.canSwitchContext) {
        const activeContext = authContextManager.getStoredContext()
        if (activeContext !== 'provider') {
          return {
            allowed: false,
            redirectTo: '/choose-context',
            reason: 'Provider context not active'
          }
        }
      }

      return { allowed: true }
    } catch (error) {
      console.error('Error checking provider route access:', error)
      return {
        allowed: false,
        redirectTo: '/auth/login',
        reason: 'Authentication error'
      }
    }
  }

  /**
   * Get the appropriate home route for the current user
   */
  async getHomeRoute(): Promise<string> {
    try {
      const authContext = await authContextManager.getUserAuthContext()
      
      if (!authContext.user) {
        return '/auth/login'
      }

      if (authContext.canSwitchContext) {
        const activeContext = authContextManager.getStoredContext()
        if (activeContext) {
          return authContextManager.getDashboardRoute(activeContext)
        }
        return '/choose-context'
      }

      // Single role user
      if (authContext.availableRoles.length > 0) {
        return authContextManager.getDashboardRoute(authContext.availableRoles[0].role)
      }

      return '/auth/login'
    } catch (error) {
      console.error('Error determining home route:', error)
      return '/auth/login'
    }
  }

  /**
   * Check if user should be redirected based on current route
   */
  async checkRouteAccess(pathname: string): Promise<RouteGuardResult> {
    // Admin routes
    if (pathname.startsWith('/admin')) {
      return await this.canAccessAdminRoute()
    }

    // Provider routes
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/practitioner')) {
      return await this.canAccessProviderRoute()
    }

    // Public routes (always allowed)
    if (pathname.startsWith('/auth') || 
        pathname.startsWith('/choose-context') ||
        pathname === '/' ||
        pathname.startsWith('/book') ||
        pathname.startsWith('/practitioners') ||
        pathname.startsWith('/ways-to-pay')) {
      return { allowed: true }
    }

    // Unknown route - check if user is authenticated
    const authContext = await authContextManager.getUserAuthContext()
    if (!authContext.user) {
      return {
        allowed: false,
        redirectTo: '/auth/login',
        reason: 'Authentication required'
      }
    }

    return { allowed: true }
  }
}

// Export singleton instance
export const routeGuardManager = new RouteGuardManager()
export default routeGuardManager

// React hook for client-side route guarding
export function useRouteGuard() {
  return {
    canAccessAdminRoute: routeGuardManager.canAccessAdminRoute.bind(routeGuardManager),
    canAccessProviderRoute: routeGuardManager.canAccessProviderRoute.bind(routeGuardManager),
    getHomeRoute: routeGuardManager.getHomeRoute.bind(routeGuardManager),
    checkRouteAccess: routeGuardManager.checkRouteAccess.bind(routeGuardManager)
  }
}