// src/components/dashboard/DashboardShell.tsx
'use client'

import { AuthUser } from '@/lib/auth'
import { Database } from '@/types/database'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
    Calendar,
    Home,
    LogOut,
    Menu,
    Settings,
    User,
    Users,
    X
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

interface DashboardShellProps {
  user: AuthUser
  children: React.ReactNode
}

export default function DashboardShell({ user, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClientComponentClient<Database>()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const isAdmin = user.provider?.role_name === 'admin'
  const isPractitioner = user.provider && ['practitioner', 'psychiatrist', 'psychiatry_resident'].includes(user.provider.role_name)

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, show: true },
    { name: 'My Profile', href: '/dashboard/profile', icon: User, show: isPractitioner },
    { name: 'Availability', href: '/dashboard/availability', icon: Calendar, show: isPractitioner },
    { name: 'Manage Providers', href: '/dashboard/admin/providers', icon: Users, show: isAdmin },
    { name: 'System Settings', href: '/dashboard/admin/settings', icon: Settings, show: isAdmin },
  ].filter(item => item.show)

  return (
    <div className="h-screen bg-[#FEF8F1] flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-stone-200">
            <h1 className="text-xl font-bold text-[#091747] font-['Newsreader']">
              Moonlit Dashboard
            </h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 rounded-md text-stone-400 hover:text-stone-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* User info */}
          <div className="px-6 py-4 border-b border-stone-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#BF9C73] rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">
                  {user.provider ? 
                    `${user.provider.first_name?.[0] || ''}${user.provider.last_name?.[0] || ''}` :
                    user.email[0].toUpperCase()
                  }
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#091747] truncate">
                  {user.provider ? 
                    `${user.provider.first_name} ${user.provider.last_name}` :
                    user.email
                  }
                </p>
                <p className="text-xs text-stone-500 truncate">
                  {user.provider?.role_name || 'User'}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-[#BF9C73] text-white' 
                      : 'text-[#091747] hover:bg-[#BF9C73]/10'
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Sign out */}
          <div className="px-4 pb-4">
            <button
              onClick={handleSignOut}
              className="flex items-center w-full px-3 py-2 text-sm font-medium text-stone-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white shadow-sm border-b border-stone-200 lg:hidden">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md text-stone-400 hover:text-stone-600"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold text-[#091747] font-['Newsreader']">
              Moonlit Dashboard
            </h1>
            <div className="w-9" /> {/* Spacer for centering */}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}