'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, UserCheck, ArrowRight } from 'lucide-react'
import { authContextManager, UserContext, AuthContextData } from '@/lib/auth-context'

export default function ChooseContextPage() {
  const [authContext, setAuthContext] = useState<AuthContextData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadAuthContext()
  }, [])

  const loadAuthContext = async () => {
    try {
      const context = await authContextManager.getUserAuthContext()
      
      if (!context.user) {
        router.replace('/auth/login')
        return
      }

      if (!context.canSwitchContext) {
        // Single role - redirect directly
        const singleRole = context.availableRoles[0]
        if (singleRole) {
          const route = authContextManager.getDashboardRoute(singleRole.role)
          router.replace(route)
          return
        }
      }

      setAuthContext(context)
    } catch (error) {
      console.error('Error loading auth context:', error)
      router.replace('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  const selectContext = async (context: UserContext) => {
    setSelecting(true)
    
    try {
      authContextManager.setActiveContext(context)
      const route = authContextManager.getDashboardRoute(context)
      router.replace(route)
    } catch (error) {
      console.error('Error setting context:', error)
      setSelecting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/30 to-[#FEF8F1] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
            <h1 className="text-2xl font-bold text-[#091747] mb-2 font-['Newsreader']">
              Loading...
            </h1>
            <p className="text-[#091747]/70 font-['Newsreader'] font-light">
              Checking your access permissions
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!authContext) {
    return null
  }

  const adminRole = authContext.availableRoles.find(role => role.role === 'admin')
  const providerRole = authContext.availableRoles.find(role => role.role === 'provider')

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/30 to-[#FEF8F1] flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#091747] mb-2 font-['Newsreader']">
            Welcome back, {authContext.user.user_metadata?.first_name || authContext.user.email?.split('@')[0]}!
          </h1>
          <p className="text-[#091747]/70 font-['Newsreader'] font-light">
            Which view do you want to use right now?
          </p>
        </div>

        {/* Context Options */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Admin Option */}
          {adminRole && (
            <button
              onClick={() => selectContext('admin')}
              disabled={selecting}
              className="group bg-white rounded-2xl shadow-lg p-8 text-left hover:shadow-xl transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed border-2 border-transparent hover:border-[#BF9C73]/20"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-16 h-16 bg-[#091747] rounded-2xl flex items-center justify-center group-hover:bg-[#091747]/90 transition-colors">
                  <Settings className="w-8 h-8 text-white" />
                </div>
                <ArrowRight className="w-6 h-6 text-[#BF9C73] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              
              <h3 className="text-xl font-semibold text-[#091747] mb-2 font-['Newsreader']">
                Admin Dashboard
              </h3>
              <p className="text-[#091747]/70 text-sm font-['Newsreader'] font-light mb-4">
                Manage the practice, view all providers, partners, bookings, and system settings.
              </p>
              
              <div className="flex items-center text-[#BF9C73] text-sm font-medium font-['Newsreader']">
                <span>Go to Admin View</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </div>
            </button>
          )}

          {/* Provider Option */}
          {providerRole && (
            <button
              onClick={() => selectContext('provider')}
              disabled={selecting}
              className="group bg-white rounded-2xl shadow-lg p-8 text-left hover:shadow-xl transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed border-2 border-transparent hover:border-[#BF9C73]/20"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-16 h-16 bg-[#BF9C73] rounded-2xl flex items-center justify-center group-hover:bg-[#BF9C73]/90 transition-colors">
                  <UserCheck className="w-8 h-8 text-white" />
                </div>
                <ArrowRight className="w-6 h-6 text-[#BF9C73] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              
              <h3 className="text-xl font-semibold text-[#091747] mb-2 font-['Newsreader']">
                Provider Dashboard
              </h3>
              <p className="text-[#091747]/70 text-sm font-['Newsreader'] font-light mb-4">
                Manage your availability, view appointments, and handle patient interactions.
              </p>
              
              {/* Provider Info */}
              {providerRole.data && (
                <div className="mb-4 p-3 bg-[#FEF8F1]/50 rounded-lg border border-[#BF9C73]/10">
                  <p className="text-xs text-[#091747]/60 font-['Newsreader'] font-light mb-1">
                    Provider Account:
                  </p>
                  <p className="text-sm font-medium text-[#091747] font-['Newsreader']">
                    Dr. {providerRole.data.first_name} {providerRole.data.last_name}
                  </p>
                </div>
              )}
              
              <div className="flex items-center text-[#BF9C73] text-sm font-medium font-['Newsreader']">
                <span>Go to Provider View</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </div>
            </button>
          )}
        </div>

        {/* Loading State */}
        {selecting && (
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 bg-white rounded-lg shadow-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#BF9C73] mr-2"></div>
              <span className="text-sm text-[#091747] font-['Newsreader']">Loading dashboard...</span>
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="text-center">
          <p className="text-xs text-[#091747]/50 font-['Newsreader'] font-light">
            You can switch between these views anytime using the menu in the top-right corner.
          </p>
        </div>
      </div>
    </div>
  )
}