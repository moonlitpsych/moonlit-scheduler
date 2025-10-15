'use client'

import PractitionerHeader from '@/components/layout/PractitionerHeader'
import { Database } from '@/types/database'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { ToastProvider } from '@/contexts/ToastContext'
import { providerImpersonationManager } from '@/lib/provider-impersonation'
import { isAdminEmail } from '@/lib/admin-auth'
import ProviderSelector from '@/components/admin/ProviderSelector'
import {
  Calendar,
  Home,
  LogOut,
  Menu,
  Network,
  Settings,
  User,
  Users,
  X
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [provider, setProvider] = useState<any>(null)
  const [isAdminViewing, setIsAdminViewing] = useState(false)
  const [loading, setLoading] = useState(true)

  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClientComponentClient<Database>()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  // Get user info on mount and handle impersonation
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)

        if (!user) {
          setLoading(false)
          return
        }

        // Check if user is admin
        const isAdmin = isAdminEmail(user.email || '')

        // Check for impersonation context
        const impersonation = providerImpersonationManager.getImpersonatedProvider()

        if (isAdmin && impersonation) {
          // Admin viewing as another provider
          setIsAdminViewing(true)
          setProvider(impersonation.provider)
          setLoading(false)
        } else if (isAdmin && !impersonation && pathname !== '/dashboard/select-provider') {
          // Admin hasn't selected a provider yet - redirect to selector
          router.replace('/dashboard/select-provider')
          return
        } else {
          // Regular provider viewing their own dashboard
          setIsAdminViewing(false)

          // FIXED: Add is_active filter to only get active provider records
          const { data: providerData } = await supabase
            .from('providers')
            .select('*')
            .eq('auth_user_id', user.id)
            .eq('is_active', true)
            .single()

          setProvider(providerData)
          setLoading(false)
        }
      } catch (error) {
        console.error('Error loading dashboard:', error)
        setLoading(false)
      }
    }
    getUser()
  }, [supabase, pathname, router])

  // No auto-redirect - dashboard home page now exists

  // When admin is viewing as a provider, hide all admin features
  // This ensures they see exactly what the provider sees
  const isAdmin = false // Never show admin features in provider dashboard
  const isPractitioner = provider && ['practitioner', 'psychiatrist', 'psychiatry_resident', 'provider'].includes(provider.role)

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, show: isPractitioner },
    { name: 'Availability', href: '/dashboard/availability', icon: Calendar, show: isPractitioner, beta: true },
    { name: 'Network & Coverage', href: '/dashboard/bookability', icon: Network, show: isPractitioner },
    { name: 'My Profile', href: '/dashboard/profile', icon: User, show: isPractitioner },
  ].filter(item => item.show)

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEF8F1] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#BF9C73] mx-auto"></div>
          <p className="mt-4 text-[#091747] font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#FEF8F1]">
        {/* Practitioner Header with Provider Selector for Admins */}
        <PractitionerHeader>
          {isAdminViewing && (
            <div className="ml-4">
              <ProviderSelector />
            </div>
          )}
        </PractitionerHeader>
        
        {/* Dashboard Content */}
        <div className="h-screen bg-[#FEF8F1] flex pt-16">
          {/* Mobile sidebar backdrop */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <div className={`
            fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}>
            <div className="flex flex-col h-full">
              {/* Logo */}
              <div className="flex items-center justify-between h-20 px-6 border-b border-stone-200">
                <div>
                  <h1 className="text-2xl font-bold text-[#091747] font-['Newsreader']">
                    Moonlit
                  </h1>
                  <p className="text-sm text-[#BF9C73]">Provider Dashboard</p>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden p-2 rounded-md text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* User info */}
              <div className="px-6 py-6 border-b border-stone-200 bg-gradient-to-r from-[#BF9C73]/5 to-[#F6B398]/5">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#BF9C73] to-[#F6B398] rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-lg">
                      {provider ? 
                        `${provider.first_name?.[0] || ''}${provider.last_name?.[0] || ''}` :
                        user?.email?.[0]?.toUpperCase() || 'U'
                      }
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-semibold text-[#091747] truncate font-['Newsreader']">
                      {provider ? 
                        `${provider.first_name} ${provider.last_name}` :
                        'Loading...'
                      }
                    </p>
                    <p className="text-sm text-[#BF9C73] capitalize truncate">
                      {provider?.role?.replace('_', ' ') || 'User'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-4 py-6 space-y-2">
                {navigation.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`
                        flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group
                        ${isActive 
                          ? 'bg-gradient-to-r from-[#BF9C73] to-[#F6B398] text-white shadow-lg' 
                          : 'text-[#091747] hover:bg-gradient-to-r hover:from-[#BF9C73]/10 hover:to-[#F6B398]/10 hover:shadow-md'
                        }
                      `}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon className={`mr-4 h-5 w-5 transition-transform duration-200 ${isActive ? 'text-white' : 'text-[#BF9C73] group-hover:scale-110'}`} />
                      <span className={`font-medium ${isActive ? 'text-white' : 'text-[#091747]'}`}>
                        {item.name}
                      </span>
                      {item.beta && (
                        <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs rounded-full font-medium">
                          Beta
                        </span>
                      )}
                      {isActive && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full opacity-80" />
                      )}
                    </Link>
                  )
                })}
              </nav>

              {/* Bottom section */}
              <div className="px-4 py-6 border-t border-stone-200">
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full px-4 py-3 text-sm font-medium text-stone-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 group"
                >
                  <LogOut className="mr-4 h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>

          {/* Mobile sidebar button */}
          <div className="lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="fixed top-4 left-4 z-30 p-2 bg-white rounded-lg shadow-lg border border-stone-200"
            >
              <Menu className="h-6 w-6 text-[#091747]" />
            </button>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top bar for mobile */}
            <div className="lg:hidden bg-white border-b border-stone-200 px-4 py-3">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold text-[#091747] font-['Newsreader']">
                  Moonlit Dashboard
                </h1>
                {provider && (
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-[#BF9C73] to-[#F6B398] rounded-full flex items-center justify-center">
                      <span className="text-white font-medium text-sm">
                        {`${provider.first_name?.[0] || ''}${provider.last_name?.[0] || ''}`}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-[#091747]">
                      {provider.first_name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Page content */}
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
      </div>
    </ToastProvider>
  )
}