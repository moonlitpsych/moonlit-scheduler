// Partner Dashboard Layout - Left sidebar navigation
'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'
import { Building2, Users, Calendar, Home, LogOut, Menu, X, Settings } from 'lucide-react'
import Link from 'next/link'
import { AccountSettingsModal } from '@/components/shared/AccountSettingsModal'

export default function PartnerDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [partnerUser, setPartnerUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false)

  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClientComponentClient<Database>()

  // Get user and partner info on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)

        if (!user) {
          setLoading(false)
          return
        }

        // Fetch partner user info
        const response = await fetch('/api/partner/me')
        const result = await response.json()

        if (result.success) {
          setPartnerUser(result.data)
        }

        setLoading(false)
      } catch (error) {
        console.error('Error loading partner user:', error)
        setLoading(false)
      }
    }
    loadUser()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/partner-auth/login')
  }

  const getInitials = (fullName?: string) => {
    if (!fullName) return 'PU'
    const parts = fullName.trim().split(' ')
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
    }
    return fullName.substring(0, 2).toUpperCase()
  }

  const navigation = [
    { name: 'Dashboard', href: '/partner-dashboard', icon: Home },
    { name: 'Patients', href: '/partner-dashboard/patients', icon: Users },
    { name: 'Calendar', href: '/partner-dashboard/calendar', icon: Calendar },
  ]

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-moonlit-cream flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-moonlit-brown mx-auto"></div>
          <p className="mt-4 text-moonlit-navy font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-moonlit-cream flex">
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
          <div className="flex items-center justify-between h-20 px-6 border-b border-gray-200">
            <div>
              <h1 className="text-2xl font-bold text-moonlit-navy font-['Newsreader']">
                Moonlit
              </h1>
              <p className="text-sm text-moonlit-brown">Partner Portal</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* User info */}
          <div className="px-6 py-6 border-b border-gray-200 bg-gradient-to-r from-moonlit-brown/5 to-moonlit-peach/5">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-moonlit-brown to-moonlit-peach rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-lg">
                  {getInitials(partnerUser?.full_name)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-semibold text-moonlit-navy truncate font-['Newsreader']">
                  {partnerUser?.full_name || 'Loading...'}
                </p>
                <p className="text-sm text-moonlit-brown capitalize truncate">
                  {partnerUser?.role?.replace('partner_', '').replace('_', ' ') || 'User'}
                </p>
                {partnerUser?.organization?.name && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {partnerUser.organization.name}
                  </p>
                )}
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
                      ? 'bg-gradient-to-r from-moonlit-brown to-moonlit-peach text-white shadow-lg'
                      : 'text-moonlit-navy hover:bg-gradient-to-r hover:from-moonlit-brown/10 hover:to-moonlit-peach/10 hover:shadow-md'
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className={`mr-4 h-5 w-5 transition-transform duration-200 ${isActive ? 'text-white' : 'text-moonlit-brown group-hover:scale-110'}`} />
                  <span className={`font-medium ${isActive ? 'text-white' : 'text-moonlit-navy'}`}>
                    {item.name}
                  </span>
                  {isActive && (
                    <div className="ml-auto w-2 h-2 bg-white rounded-full opacity-80" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Bottom section - Settings & Logout */}
          <div className="px-4 py-6 border-t border-gray-200 space-y-2">
            <button
              onClick={() => setIsAccountSettingsOpen(true)}
              className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-600 hover:text-moonlit-brown hover:bg-moonlit-brown/5 rounded-xl transition-all duration-200 group"
            >
              <Settings className="mr-4 h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
              <span>Account Settings</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 group"
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
          className="fixed top-4 left-4 z-30 p-2 bg-white rounded-lg shadow-lg border border-gray-200"
        >
          <Menu className="h-6 w-6 text-moonlit-navy" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar for mobile */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-moonlit-navy font-['Newsreader']">
              Partner Dashboard
            </h1>
            {partnerUser && (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-moonlit-brown to-moonlit-peach rounded-full flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    {getInitials(partnerUser.full_name)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Account Settings Modal */}
      <AccountSettingsModal
        isOpen={isAccountSettingsOpen}
        onClose={() => setIsAccountSettingsOpen(false)}
        userEmail={user?.email}
      />
    </div>
  )
}
