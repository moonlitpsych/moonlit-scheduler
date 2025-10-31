// Partner Dashboard Main Page
'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { DashboardStats } from '@/components/partner-dashboard/DashboardStats'
import { UpcomingAppointments } from '@/components/partner-dashboard/UpcomingAppointments'
import CalendarExport from '@/components/partner-dashboard/CalendarExport'
import { PartnerDashboardData, PartnerUser } from '@/types/partner-types'
import { Database } from '@/types/database'

export default function PartnerDashboardPage() {
  const [partnerUser, setPartnerUser] = useState<PartnerUser | null>(null)
  const [dashboardData, setDashboardData] = useState<PartnerDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch partner user data and dashboard data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // Get authenticated user from Supabase
        const supabase = createClientComponentClient<Database>()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          setError('Partner authentication required. Please sign in to access your dashboard.')
          return
        }
        
        // Fetch partner user data using the authenticated user's ID
        const userResponse = await fetch('/api/partner/me', {
          headers: {
            'x-partner-user-id': user.id
          }
        })
        
        if (!userResponse.ok) {
          if (userResponse.status === 404) {
            setError('This account does not have partner access. Please check your credentials or contact hello@trymoonlit.com for access.')
          } else {
            setError('Failed to load partner user data. Please try again.')
          }
          return
        }
        
        const userData = await userResponse.json()
        if (!userData.success) {
          setError(userData.error || 'Failed to load user data')
          return
        }
        
        setPartnerUser(userData.data)

        // Fetch dashboard stats
        const statsResponse = await fetch('/api/partner-dashboard/stats')
        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          if (statsData.success) {
            setDashboardData({
              upcoming_appointments: [],
              my_assigned_patients: [],
              recent_changes: [],
              organization_stats: statsData.data.organization_stats
            })
          } else {
            // Fallback to empty stats if API fails
            setDashboardData({
              upcoming_appointments: [],
              my_assigned_patients: [],
              recent_changes: [],
              organization_stats: {
                total_patients: 0,
                active_patients: 0,
                appointments_this_week: 0
              }
            })
          }
        }
        
      } catch (err: any) {
        console.error('Error loading dashboard:', err)
        setError('Partner dashboard is currently unavailable. Please try again or contact hello@trymoonlit.com for support.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleRequestChange = (appointmentId: string) => {
    // TODO: Open change request modal
    console.log('Request change for appointment:', appointmentId)
    alert(`Change request for appointment ${appointmentId} - Modal would open here`)
  }

  if (error) {
    return (
      <div className="min-h-screen bg-moonlit-cream">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-moonlit-brown rounded-lg flex items-center justify-center">
                  <span className="text-white font-semibold text-sm font-['Newsreader']">M</span>
                </div>
                <div className="text-lg font-semibold text-moonlit-navy font-['Newsreader']">
                  Partner Dashboard
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <div className="w-16 h-16 bg-moonlit-cream rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-moonlit-brown" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              
              <h1 className="text-2xl font-bold text-moonlit-navy mb-4 font-['Newsreader']">
                Partner Dashboard
              </h1>
              
              <p className="text-gray-600 mb-6 font-['Newsreader'] font-light leading-relaxed">
                {error}
              </p>
              
              {error.includes('infrastructure is being set up') && (
                <div className="bg-moonlit-cream/30 border border-moonlit-brown/20 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-moonlit-brown mb-2 font-['Newsreader']">
                    What does this mean?
                  </h3>
                  <p className="text-sm text-gray-700 font-['Newsreader'] font-light">
                    The partner dashboard feature is currently being developed and the database infrastructure is not yet deployed. 
                    Once your organization's data has been imported and the partner system is activated, you'll be able to access 
                    appointment management, patient information, and reporting features here.
                  </p>
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-moonlit-brown hover:bg-moonlit-brown/90 text-white rounded-lg font-medium font-['Newsreader'] transition-colors"
                >
                  Check Again
                </button>
                <button
                  onClick={() => window.location.href = '/partner-auth/login'}
                  className="px-6 py-3 border border-gray-300 hover:border-moonlit-brown text-gray-700 hover:text-moonlit-brown rounded-lg font-medium font-['Newsreader'] transition-colors"
                >
                  Partner Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading || !partnerUser) {
    return (
      <div className="min-h-screen bg-moonlit-cream">
        <div className="animate-pulse">
          <div className="h-16 bg-gray-200"></div>
          <div className="container mx-auto px-4 py-8">
            <div className="h-8 bg-gray-200 rounded mb-4 w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded mb-8 w-2/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-moonlit-cream">
      
      <div className="container mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-moonlit-navy mb-2 font-['Newsreader']">
            Welcome back{partnerUser.full_name ? `, ${partnerUser.full_name.split(' ')[0]}` : ''}!
          </h1>
          <p className="text-gray-600 font-['Newsreader'] font-light">
            Here's what's happening with your patients and appointments today.
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="mb-8">
          <DashboardStats 
            stats={dashboardData?.organization_stats || {
              total_patients: 0,
              active_patients: 0,
              appointments_this_week: 0
            }}
            loading={loading}
          />
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upcoming Appointments */}
          <div className="lg:col-span-2">
            <UpcomingAppointments
              appointments={dashboardData?.upcoming_appointments || []}
              loading={loading}
              onRequestChange={handleRequestChange}
            />
          </div>

          {/* Sidebar content */}
          <div className="space-y-6">
            {/* Calendar Export */}
            <CalendarExport partnerUser={partnerUser} />

            {/* Recent Activity */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-moonlit-navy mb-4 font-['Newsreader']">Recent Activity</h3>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3 text-sm text-gray-600">
                  {dashboardData?.recent_changes && dashboardData.recent_changes.length > 0 ? (
                    dashboardData.recent_changes.map((change, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-moonlit-peach rounded-full"></div>
                        <span>{change.description}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 font-['Newsreader'] font-light">
                      No recent activity to display.
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}