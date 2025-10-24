'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { routeGuardManager } from '@/lib/route-guards'
import { Building2, Users, BarChart3, Settings, LogOut, Shield, Network, Activity, GitBranch } from 'lucide-react'
import Link from 'next/link'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'
import ContextSwitcher from '@/components/auth/ContextSwitcher'

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
      try {
        const routeAccess = await routeGuardManager.canAccessAdminRoute()
        
        console.log('Admin route access check:', routeAccess)
        
        if (!routeAccess.allowed) {
          if (routeAccess.redirectTo) {
            console.log(`Redirecting to: ${routeAccess.redirectTo}`)
            router.replace(routeAccess.redirectTo)
          } else {
            console.log('Access denied:', routeAccess.reason)
            setUser(null)
            setLoading(false)
          }
          return
        }
        
        // Get user info for display
        const { data: { user: authUser } } = await supabase.auth.getUser()
        console.log('Admin access granted for:', authUser?.email)
        setUser(authUser)
        setLoading(false)
      } catch (error) {
        console.error('Admin verification error:', error)
        setLoading(false)
      }
    }

    verifyAdmin()
  }, [router, supabase.auth])

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

  // Access denied screen for non-admin users
  if (!user) {
    return (
      <div className="min-h-screen bg-[#FEF8F1] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="p-4 bg-red-100 rounded-full w-16 h-16 mx-auto mb-6 flex items-center justify-center">
            <Settings className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-[#091747] mb-4">Admin Access Required</h1>
          <p className="text-[#091747]/70 mb-6">
            This area is restricted to Moonlit administrators only. 
            Contact hello@trymoonlit.com if you need access.
          </p>
          <button
            onClick={() => router.replace('/auth/login')}
            className="bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white px-6 py-2 rounded-lg transition-colors mr-4"
          >
            Return to Login
          </button>
          <button
            onClick={() => router.replace('/')}
            className="border border-[#BF9C73] text-[#BF9C73] hover:bg-[#BF9C73]/10 px-6 py-2 rounded-lg transition-colors"
          >
            Go to Homepage
          </button>
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
            href="/admin/patients"
            className="flex items-center space-x-3 px-3 py-2 rounded-lg text-[#091747]/70 hover:bg-[#BF9C73]/10 hover:text-[#BF9C73] transition-colors"
          >
            <Users className="h-4 w-4" />
            <span>All Patients</span>
          </Link>

          <Link
            href="/admin/partners"
            className="flex items-center space-x-3 px-3 py-2 rounded-lg text-[#091747]/70 hover:bg-[#BF9C73]/10 hover:text-[#BF9C73] transition-colors"
          >
            <Building2 className="h-4 w-4" />
            <span>Partner CRM</span>
            <span className="ml-auto px-1.5 py-0.5 text-xs font-medium bg-blue-600 text-white rounded-full">Beta</span>
          </Link>

          <Link
            href="/admin/organizations"
            className="flex items-center space-x-3 px-3 py-2 rounded-lg text-[#091747]/70 hover:bg-[#BF9C73]/10 hover:text-[#BF9C73] transition-colors"
          >
            <Building2 className="h-4 w-4" />
            <span>Organizations</span>
            <span className="ml-auto px-1.5 py-0.5 text-xs font-medium bg-blue-600 text-white rounded-full">Beta</span>
          </Link>

          {/* Operations Section */}
          <div className="py-2">
            <div className="px-3 py-1 text-xs font-medium text-[#091747]/50 uppercase tracking-wider">
              Operations
            </div>
          </div>

          <Link
            href="/admin/payers"
            className="flex items-center space-x-3 px-3 py-2 rounded-lg text-[#091747]/70 hover:bg-[#BF9C73]/10 hover:text-[#BF9C73] transition-colors"
          >
            <Shield className="h-4 w-4" />
            <span>Payers</span>
          </Link>

          <Link
            href="/admin/contracts"
            className="flex items-center space-x-3 px-3 py-2 rounded-lg text-[#091747]/70 hover:bg-[#BF9C73]/10 hover:text-[#BF9C73] transition-colors"
          >
            <Activity className="h-4 w-4" />
            <span>Contracts</span>
            <span className="ml-auto px-1.5 py-0.5 text-xs font-medium bg-blue-600 text-white rounded-full">Beta</span>
          </Link>

          <Link
            href="/admin/bookability"
            className="flex items-center space-x-3 px-3 py-2 rounded-lg text-[#091747]/70 hover:bg-[#BF9C73]/10 hover:text-[#BF9C73] transition-colors"
          >
            <GitBranch className="h-4 w-4" />
            <span>Bookability</span>
          </Link>
          
          <Link
            href="/admin/analytics"
            className="flex items-center space-x-3 px-3 py-2 rounded-lg text-[#091747]/70 hover:bg-[#BF9C73]/10 hover:text-[#BF9C73] transition-colors"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Analytics</span>
            <span className="ml-auto px-1.5 py-0.5 text-xs font-medium bg-blue-600 text-white rounded-full">Beta</span>
          </Link>
        </nav>

        {/* Admin User Info & Logout */}
        <div className="absolute bottom-0 left-0 w-64 p-4 border-t border-stone-200 bg-white">
          <div className="bg-[#BF9C73] rounded-lg">
            <ContextSwitcher />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}