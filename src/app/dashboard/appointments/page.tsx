'use client'

import { Database } from '@/types/database'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import AppointmentManager from '@/components/appointments/AppointmentManager'
import GoogleMeetLauncher from '@/components/virtual-visits/GoogleMeetLauncher'

export default function AppointmentsPage() {
  const [user, setUser] = useState<any>(null)
  const [provider, setProvider] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null)
  
  const router = useRouter()
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    const loadProviderData = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !user) {
          router.push('/auth/login')
          return
        }

        setUser(user)

        // Get provider record
        const { data: providerData, error: providerError } = await supabase
          .from('providers')
          .select('*')
          .eq('auth_user_id', user.id)
          .eq('is_active', true)
          .single()

        if (providerData) {
          setProvider(providerData)
        }
      } catch (err) {
        console.error('Error loading provider:', err)
      } finally {
        setLoading(false)
      }
    }

    loadProviderData()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#BF9C73] mx-auto"></div>
          <p className="mt-4 text-[#091747] font-medium">Loading appointments...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader']">
            Appointments
          </h1>
          <p className="mt-2 text-[#091747]/70">
            Manage your scheduled appointments, virtual visits, and generate clinical notes.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Appointments List */}
          <div className="xl:col-span-2">
            <AppointmentManager 
              providerId={provider?.id}
              onAppointmentSelect={setSelectedAppointment}
            />
          </div>

          {/* Virtual Visit Launcher */}
          <div className="space-y-6">
            {selectedAppointment ? (
              <GoogleMeetLauncher
                appointmentId={selectedAppointment.id}
                patientName={selectedAppointment.patient?.name}
                scheduledTime={selectedAppointment.start_time}
                duration={45}
                onMeetingCreated={(link) => {
                  console.log('Meeting created:', link)
                }}
              />
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                <h3 className="font-semibold text-[#091747] mb-4 font-['Newsreader']">Virtual Visit</h3>
                <p className="text-sm text-[#091747]/60 mb-4">
                  Select an appointment to start or join a virtual visit.
                </p>
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-[#BF9C73]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">📹</span>
                  </div>
                  <p className="text-[#091747]/60 text-sm">
                    Click on an appointment to manage Google Meet integration
                  </p>
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
              <h3 className="font-semibold text-[#091747] mb-4">Today's Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#091747]/60">Scheduled</span>
                  <span className="font-semibold text-[#091747]">3</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#091747]/60">Completed</span>
                  <span className="font-semibold text-[#091747]">1</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#091747]/60">Virtual Visits</span>
                  <span className="font-semibold text-[#091747]">2</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#091747]/60">Notes Generated</span>
                  <span className="font-semibold text-[#091747]">1</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
              <h3 className="font-semibold text-[#091747] mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button 
                  onClick={() => router.push('/dashboard/notes')}
                  className="w-full bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white p-3 rounded-lg transition-colors font-medium text-sm"
                >
                  Generate Clinical Note
                </button>
                <button 
                  onClick={() => router.push('/dashboard/patients')}
                  className="w-full bg-stone-50 hover:bg-stone-100 text-[#091747] p-3 rounded-lg transition-colors font-medium text-sm"
                >
                  Search Patients
                </button>
                <button 
                  onClick={() => router.push('/dashboard/availability')}
                  className="w-full bg-stone-50 hover:bg-stone-100 text-[#091747] p-3 rounded-lg transition-colors font-medium text-sm"
                >
                  Update Availability
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}