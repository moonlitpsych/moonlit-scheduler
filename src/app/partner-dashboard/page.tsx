// Partner Dashboard Main Page
'use client'

import { useEffect, useState } from 'react'
import { PartnerHeader } from '@/components/partner-dashboard/PartnerHeader'
import { DashboardStats } from '@/components/partner-dashboard/DashboardStats'
import { UpcomingAppointments } from '@/components/partner-dashboard/UpcomingAppointments'
import { PartnerDashboardData, PartnerUser } from '@/types/partner-types'

// Mock data for development - replace with actual API calls
const mockPartnerUser: PartnerUser = {
  id: 'user-123',
  organization_id: 'org-456',
  first_name: 'Sarah',
  last_name: 'Johnson',
  email: 'sarah@firststephouse.org',
  role: 'partner_case_manager',
  status: 'active',
  timezone: 'America/Denver',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  organization: {
    id: 'org-456',
    name: 'First Step House',
    slug: 'first-step-house',
    type: 'treatment_center',
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
}

export default function PartnerDashboardPage() {
  const [dashboardData, setDashboardData] = useState<PartnerDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        
        // In production, this would make an actual API call
        // const response = await fetch('/api/partner-dashboard', {
        //   headers: {
        //     'x-partner-user-id': mockPartnerUser.id
        //   }
        // })
        
        // Mock response for development
        await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate loading
        
        const mockData: PartnerDashboardData = {
          upcoming_appointments: [
            {
              id: 'apt-1',
              start_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
              end_time: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
              status: 'confirmed',
              providers: {
                id: 'prov-1',
                first_name: 'Travis',
                last_name: 'Norseth',
                title: 'MD'
              },
              patients: {
                id: 'pat-1',
                first_name: 'John',
                last_name: 'Smith',
                phone: '(555) 123-4567'
              },
              payers: {
                id: 'pay-1',
                name: 'Utah Medicaid'
              }
            },
            {
              id: 'apt-2',
              start_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(), // Tomorrow
              end_time: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
              status: 'scheduled',
              providers: {
                id: 'prov-2',
                first_name: 'Tatiana',
                last_name: 'Kaehler',
                title: 'MD'
              },
              patients: {
                id: 'pat-2',
                first_name: 'Mary',
                last_name: 'Johnson',
                phone: '(555) 987-6543'
              },
              payers: {
                id: 'pay-2',
                name: 'Molina Healthcare'
              }
            }
          ],
          my_assigned_patients: [],
          recent_changes: [],
          organization_stats: {
            total_patients: 24,
            active_patients: 18,
            appointments_this_week: 12,
            pending_changes: 3
          }
        }
        
        setDashboardData(mockData)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const handleRequestChange = (appointmentId: string) => {
    // TODO: Open change request modal
    console.log('Request change for appointment:', appointmentId)
    alert(`Change request for appointment ${appointmentId} - Modal would open here`)
  }

  if (error) {
    return (
      <div className="min-h-screen bg-moonlit-cream">
        <PartnerHeader partnerUser={mockPartnerUser} currentPage="dashboard" />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2 font-['Newsreader']">Error Loading Dashboard</h2>
            <p className="text-red-600 font-['Newsreader'] font-light">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg font-medium font-['Newsreader'] transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-moonlit-cream">
      <PartnerHeader partnerUser={mockPartnerUser} currentPage="dashboard" />
      
      <div className="container mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-moonlit-navy mb-2 font-['Newsreader']">
            Welcome back, {mockPartnerUser.first_name}!
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
              appointments_this_week: 0,
              pending_changes: 0
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
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-moonlit-peach rounded-full"></div>
                    <span>Appointment confirmed for John Smith</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-moonlit-brown rounded-full"></div>
                    <span>New patient affiliation approved</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-moonlit-orange rounded-full"></div>
                    <span>Change request submitted</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-moonlit-navy mb-4 font-['Newsreader']">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">📅</span>
                    <div>
                      <div className="font-medium font-['Newsreader']">Request Appointment Change</div>
                      <div className="text-sm text-gray-500 font-['Newsreader'] font-light">Reschedule or cancel appointments</div>
                    </div>
                  </div>
                </button>
                <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">👥</span>
                    <div>
                      <div className="font-medium font-['Newsreader']">View My Patients</div>
                      <div className="text-sm text-gray-500 font-['Newsreader'] font-light">See all assigned patients</div>
                    </div>
                  </div>
                </button>
                <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">📊</span>
                    <div>
                      <div className="font-medium font-['Newsreader']">View Reports</div>
                      <div className="text-sm text-gray-500 font-['Newsreader'] font-light">Export appointment data</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}