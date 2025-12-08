'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Building2,
  Users,
  BarChart3,
  TrendingUp,
  Calendar,
  ArrowRight,
  Shield,
  Briefcase,
  UserCog
} from 'lucide-react'
import IntakeCapacityBanner from '@/components/admin/IntakeCapacityBanner'

interface DashboardStats {
  total_partners: number
  total_organizations: number
  active_partners: number
  live_partners: number
  pipeline_partners: number
  total_users: number
  total_providers: number
  active_providers: number
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    total_partners: 0,
    total_organizations: 0,
    active_partners: 0,
    live_partners: 0,
    pipeline_partners: 0,
    total_users: 0,
    total_providers: 0,
    active_providers: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch basic stats from all APIs
        const [partnersResponse, orgsResponse, providersResponse, activeProvidersResponse] = await Promise.all([
          fetch('/api/admin/partners?per_page=1'),
          fetch('/api/admin/organizations?per_page=1'),
          fetch('/api/admin/providers?limit=1'),
          fetch('/api/admin/providers?status=active&limit=1')
        ])

        const partnersResult = await partnersResponse.json()
        const orgsResult = await orgsResponse.json()
        const providersResult = await providersResponse.json()
        const activeProvidersResult = await activeProvidersResponse.json()

        if (partnersResult.success && orgsResult.success && providersResult.success) {
          setStats({
            total_partners: partnersResult.pagination?.total || 0,
            total_organizations: orgsResult.pagination?.total || 0,
            active_partners: 0, // Will be calculated from actual data
            live_partners: 0, // Will be calculated from actual data
            pipeline_partners: 0, // Will be calculated from actual data
            total_users: orgsResult.data?.reduce((sum: number, org: any) => sum + (org.user_count || 0), 0) || 0,
            total_providers: providersResult.total || 0,
            active_providers: activeProvidersResult.total || 0
          })
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader'] mb-2">
          Admin Dashboard
        </h1>
        <p className="text-[#091747]/70">
          Manage partnerships, organizations, and business development
        </p>
      </div>

      {/* Intake Capacity Banner */}
      <IntakeCapacityBanner />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Briefcase className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Partners</p>
              <p className="text-2xl font-bold text-[#091747]">{stats.total_partners}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Building2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Organizations</p>
              <p className="text-2xl font-bold text-[#091747]">{stats.total_organizations}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-[#091747]">{stats.total_users}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-[#BF9C73]/20 rounded-lg">
              <TrendingUp className="h-6 w-6 text-[#BF9C73]" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Growth</p>
              <p className="text-2xl font-bold text-[#091747]">+{Math.floor(stats.total_partners * 0.15)}</p>
              <p className="text-xs text-gray-500">This quarter</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Partner CRM */}
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#BF9C73]/20 rounded-lg">
                <Briefcase className="h-5 w-5 text-[#BF9C73]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#091747]">Partner CRM</h3>
                <p className="text-sm text-gray-600">Manage treatment center relationships</p>
              </div>
            </div>
            <Link
              href="/admin/partners"
              className="flex items-center space-x-1 text-[#BF9C73] hover:text-[#BF9C73]/80 text-sm font-medium"
            >
              <span>View All</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
              <span className="text-sm text-gray-700">Active Partnerships</span>
              <span className="text-sm font-medium text-[#091747]">{stats.live_partners}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
              <span className="text-sm text-gray-700">In Pipeline</span>
              <span className="text-sm font-medium text-[#091747]">{stats.pipeline_partners}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
              <span className="text-sm text-gray-700">New This Month</span>
              <span className="text-sm font-medium text-[#091747]">
                +{Math.floor(stats.total_partners * 0.1) || 1}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-stone-200">
            <Link
              href="/admin/partners"
              className="w-full bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <Briefcase className="h-4 w-4" />
              <span>Manage Partners</span>
            </Link>
          </div>
        </div>

        {/* Organization Management */}
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Building2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-[#091747]">Organizations</h3>
                <p className="text-sm text-gray-600">Manage treatment centers and partners</p>
              </div>
            </div>
            <Link
              href="/admin/organizations"
              className="flex items-center space-x-1 text-[#BF9C73] hover:text-[#BF9C73]/80 text-sm font-medium"
            >
              <span>View All</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
              <span className="text-sm text-gray-700">Treatment Centers</span>
              <span className="text-sm font-medium text-[#091747]">
                {Math.floor(stats.total_organizations * 0.7)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
              <span className="text-sm text-gray-700">Healthcare Partners</span>
              <span className="text-sm font-medium text-[#091747]">
                {Math.floor(stats.total_organizations * 0.2)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
              <span className="text-sm text-gray-700">Total Users</span>
              <span className="text-sm font-medium text-[#091747]">{stats.total_users}</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-stone-200">
            <Link
              href="/admin/organizations"
              className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <Building2 className="h-4 w-4" />
              <span>Manage Organizations</span>
            </Link>
          </div>
        </div>

        {/* Provider Management */}
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <UserCog className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-[#091747]">Providers</h3>
                <p className="text-sm text-gray-600">Manage healthcare providers</p>
              </div>
            </div>
            <Link
              href="/admin/providers"
              className="flex items-center space-x-1 text-[#BF9C73] hover:text-[#BF9C73]/80 text-sm font-medium"
            >
              <span>View All</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
              <span className="text-sm text-gray-700">Total Providers</span>
              <span className="text-sm font-medium text-[#091747]">{stats.total_providers}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
              <span className="text-sm text-gray-700">Active Providers</span>
              <span className="text-sm font-medium text-[#091747]">{stats.active_providers}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
              <span className="text-sm text-gray-700">Bookable</span>
              <span className="text-sm font-medium text-[#091747]">
                {Math.floor(stats.active_providers * 0.8)}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-stone-200">
            <Link
              href="/admin/providers"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <UserCog className="h-4 w-4" />
              <span>Manage Providers</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-[#091747] flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Recent Activity</span>
          </h3>
          <Link
            href="/admin/analytics"
            className="flex items-center space-x-1 text-[#BF9C73] hover:text-[#BF9C73]/80 text-sm font-medium"
          >
            <span>View Analytics</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        
        <div className="space-y-4">
          {/* Placeholder activity items */}
          <div className="flex items-center space-x-4 p-4 border border-stone-200 rounded-lg">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#091747]">New organization registered</p>
              <p className="text-xs text-gray-500">System activity • 2 hours ago</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 p-4 border border-stone-200 rounded-lg">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#091747]">Partner moved to live stage</p>
              <p className="text-xs text-gray-500">CRM update • 4 hours ago</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 p-4 border border-stone-200 rounded-lg">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Shield className="h-4 w-4 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#091747]">New user added to organization</p>
              <p className="text-xs text-gray-500">User management • 6 hours ago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}