'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Settings, UserCheck, LogOut, RefreshCcw, Key, Building2 } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'
import { authContextManager, UserContext, AuthContextData } from '@/lib/auth-context'
import { providerImpersonationManager } from '@/lib/provider-impersonation'
import { partnerImpersonationManager } from '@/lib/partner-impersonation'
import { isAdminEmail } from '@/lib/admin-auth'
import { AccountSettingsModal } from '@/components/shared/AccountSettingsModal'

export default function ContextSwitcher() {
  const [authContext, setAuthContext] = useState<AuthContextData | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    loadAuthContext()
  }, [])

  const loadAuthContext = async () => {
    try {
      const context = await authContextManager.getUserAuthContext()
      setAuthContext(context)
    } catch (error) {
      console.error('Error loading auth context:', error)
    }
  }

  const switchContext = async (newContext: UserContext) => {
    if (!authContext || newContext === authContext.activeContext) return

    setSwitching(true)
    setIsOpen(false)

    try {
      authContextManager.setActiveContext(newContext)

      // If switching to provider dashboard and user is admin, route to provider selector
      if (newContext === 'provider' && authContext.user && isAdminEmail(authContext.user.email || '')) {
        // Clear any existing impersonation
        providerImpersonationManager.clearImpersonation()
        partnerImpersonationManager.clearImpersonation()
        router.push('/dashboard/select-provider')
      } else if (newContext === 'partner' && authContext.user && isAdminEmail(authContext.user.email || '')) {
        // If switching to partner dashboard and user is admin, route to partner selector
        providerImpersonationManager.clearImpersonation()
        partnerImpersonationManager.clearImpersonation()
        router.push('/partner-dashboard/select-partner')
      } else if (newContext === 'admin') {
        // Clear impersonation when switching back to admin
        providerImpersonationManager.clearImpersonation()
        partnerImpersonationManager.clearImpersonation()
        const route = authContextManager.getDashboardRoute(newContext)
        router.push(route)
      } else {
        const route = authContextManager.getDashboardRoute(newContext)
        router.push(route)
      }
    } catch (error) {
      console.error('Error switching context:', error)
      setSwitching(false)
    }
  }

  const handleLogout = async () => {
    setIsOpen(false)
    try {
      authContextManager.clearStoredContext()
      await supabase.auth.signOut()
      router.push('/auth/login')
    } catch (error) {
      console.error('Error during logout:', error)
    }
  }

  if (!authContext || !authContext.canSwitchContext) {
    // Single role user or not loaded - show simple user menu
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-white">
              {authContext?.user?.email?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-white" />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-stone-200 py-2 z-20">
              <button
                onClick={() => {
                  setIsAccountSettingsOpen(true)
                  setIsOpen(false)
                }}
                className="w-full flex items-center px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <Key className="w-4 h-4 mr-3" />
                Account Settings
              </button>
              <div className="border-t border-stone-100 my-1" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-3" />
                Sign Out
              </button>
            </div>
          </>
        )}

        {/* Account Settings Modal */}
        <AccountSettingsModal
          isOpen={isAccountSettingsOpen}
          onClose={() => setIsAccountSettingsOpen(false)}
          userEmail={authContext?.user?.email}
        />
      </div>
    )
  }

  const currentRole = authContext.availableRoles.find(role => role.role === authContext.activeContext)
  const otherRoles = authContext.availableRoles.filter(role => role.role !== authContext.activeContext)

  const getRoleIcon = (role: UserContext) => {
    switch (role) {
      case 'admin':
        return <Settings className="w-4 h-4" />
      case 'provider':
        return <UserCheck className="w-4 h-4" />
      case 'partner':
        return <Building2 className="w-4 h-4" />
      default:
        return null
    }
  }

  const getRoleLabel = (role: UserContext) => {
    switch (role) {
      case 'admin':
        return 'Admin Dashboard'
      case 'provider':
        return 'Provider Dashboard'
      case 'partner':
        return 'Partner Dashboard'
      default:
        return role
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
      >
        <div className="flex items-center space-x-2">
          {currentRole && getRoleIcon(currentRole.role)}
          <div className="text-left">
            <p className="text-sm font-medium text-white">
              {currentRole ? getRoleLabel(currentRole.role) : 'Select Role'}
            </p>
            <p className="text-xs text-white/70">
              {authContext.user?.email?.split('@')[0]}
            </p>
          </div>
        </div>
        {switching ? (
          <RefreshCcw className="w-4 h-4 text-white animate-spin" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white" />
        )}
      </button>

      {isOpen && !switching && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-stone-200 py-2 z-20">
            {/* Current Context */}
            <div className="px-4 py-2 border-b border-stone-100">
              <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mb-1">
                Current View
              </p>
              <div className="flex items-center space-x-2 text-sm text-stone-900">
                {currentRole && getRoleIcon(currentRole.role)}
                <span className="font-medium">{currentRole ? getRoleLabel(currentRole.role) : 'Unknown'}</span>
              </div>
            </div>

            {/* Other Contexts */}
            {otherRoles.length > 0 && (
              <>
                <div className="px-4 py-2">
                  <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mb-2">
                    Switch To
                  </p>
                  {otherRoles.map((role) => (
                    <button
                      key={role.role}
                      onClick={() => switchContext(role.role)}
                      className="w-full flex items-center px-2 py-2 text-sm text-stone-700 hover:bg-stone-50 rounded transition-colors"
                    >
                      {getRoleIcon(role.role)}
                      <span className="ml-3">{getRoleLabel(role.role)}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-stone-100" />
              </>
            )}

            {/* Account Settings */}
            <button
              onClick={() => {
                setIsAccountSettingsOpen(true)
                setIsOpen(false)
              }}
              className="w-full flex items-center px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <Key className="w-4 h-4 mr-3" />
              Account Settings
            </button>
            <div className="border-t border-stone-100" />

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Sign Out
            </button>
          </div>
        </>
      )}

      {/* Account Settings Modal */}
      <AccountSettingsModal
        isOpen={isAccountSettingsOpen}
        onClose={() => setIsAccountSettingsOpen(false)}
        userEmail={authContext?.user?.email}
      />
    </div>
  )
}