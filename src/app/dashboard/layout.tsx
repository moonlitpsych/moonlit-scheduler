'use client'

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
import { useEffect, useState } from 'react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [provider, setProvider] = useState<any>(null)
  
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClientComponentClient<Database>()

  // Get user info on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        // Get provider info
        const { data: providerData } = await supabase
          .from('providers')
          .select(`*, roles (name)`)
          .eq('auth_user_id', user.id)
          .single()
        
        setProvider(providerData)
      }
    }
    getUser()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const isAdmin = provider?.roles?.name === 'admin'
  const isPractitioner = provider?.roles?.name && ['practitioner', 'psychiatrist', 'psychiatry_resident'].includes(provider.roles.name)

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
              <p className="text-sm text-[#BF9C73]">Dashboard</p>
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
                  {provider?.roles?.name?.replace('_', ' ') || 'User'}
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
                  <item.icon className={`mr-4 h-5 w-5 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
                  <span className="font-['Newsreader']">{item.name}</span>
                  {isActive && (
                    <div className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Footer with logout */}
          <div className="px-4 pb-6">
            <div className="pt-4 border-t border-stone-200">
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-3 text-sm font-medium text-stone-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 group"
              >
                <LogOut className="mr-4 h-5 w-5 group-hover:scale-105 transition-transform duration-200" />
                <span className="font-['Newsreader']">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="bg-white shadow-sm border-b border-stone-200 lg:hidden h-16">
          <div className="flex items-center justify-between h-full px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md text-stone-400 hover:text-stone-600 hover:bg-stone-100"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-bold text-[#091747] font-['Newsreader']">
              Moonlit Dashboard
            </h1>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-[#FEF8F1]">
          <div className="p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
