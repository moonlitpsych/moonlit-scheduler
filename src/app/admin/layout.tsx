'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { checkAdminAuth } from '@/lib/admin-auth'
import { Building2, Users, BarChart3, Settings, LogOut } from 'lucide-react'
import Link from 'next/link'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    const verifyAdmin = async () => {
      const { isAuthenticated, isAdmin, user: adminUser } = await checkAdminAuth()
      
      if (!isAuthenticated) {
        router.replace('/auth/login')
        return
      }
      
      if (!isAdmin) {
        // Redirect non-admin users to their appropriate dashboard
        router.replace('/dashboard')
        return
      }
      
      setUser(adminUser)
      setLoading(false)
    }

    verifyAdmin()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/auth/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEF8F1] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#BF9C73]"></div>
          <p className="mt-4 text-[#091747]/70">Verifying admin access...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FEF8F1] flex">
      {/* Admin Sidebar */}
      <div className="w-64 bg-white shadow-lg">
        {/* Admin Header */}
        <div className="p-6 border-b border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#BF9C73] rounded-lg">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-[#091747] font-['Newsreader']">Admin Dashboard</h1>
              <p className="text-sm text-[#091747]/60">Moonlit Scheduler</p>
            </div>
          </div>
        </div>

        {/* Admin Navigation */}
        <nav className="p-4 space-y-2">
          <Link
            href="/admin/partners"
            className="flex items-center space-x-3 px-3 py-2 rounded-lg text-[#091747]/70 hover:bg-[#BF9C73]/10 hover:text-[#BF9C73] transition-colors"
          >
            <Building2 className="h-4 w-4" />
            <span>Partner CRM</span>
          </Link>
          
          <Link
            href="/admin/organizations"
            className="flex items-center space-x-3 px-3 py-2 rounded-lg text-[#091747]/70 hover:bg-[#BF9C73]/10 hover:text-[#BF9C73] transition-colors"
          >
            <Users className="h-4 w-4" />
            <span>Organizations</span>
          </Link>
          
          <Link
            href="/admin/analytics"
            className="flex items-center space-x-3 px-3 py-2 rounded-lg text-[#091747]/70 hover:bg-[#BF9C73]/10 hover:text-[#BF9C73] transition-colors"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Analytics</span>
          </Link>
        </nav>

        {/* Admin User Info & Logout */}
        <div className="absolute bottom-0 left-0 w-64 p-4 border-t border-stone-200 bg-white">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-8 h-8 bg-[#BF9C73] rounded-full flex items-center justify-center text-white text-sm font-semibold">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#091747] truncate">
                Admin User
              </p>
              <p className="text-xs text-[#091747]/60 truncate">
                {user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-[#091747]/70 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}