'use client'

import { Database } from '@/types/database'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Calendar, Clock, Video, VideoOff, Phone, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function VirtualVisitsPage() {
  const [user, setUser] = useState<any>(null)
  const [provider, setProvider] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
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
          <p className="mt-4 text-[#091747] font-medium">Loading virtual visits dashboard...</p>
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
            Virtual Visits
          </h1>
          <p className="mt-2 text-[#091747]/70">
            Manage telehealth appointments and Google Meet integration.
          </p>
        </div>

        {/* Google Meet Integration Card */}
        <div className="bg-gradient-to-r from-blue-500/10 to-green-500/10 rounded-xl p-8 mb-8 border border-blue-200">
          <div className="flex items-center mb-4">
            <div className="p-3 bg-blue-500/20 rounded-full">
              <Video className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <h2 className="text-xl font-semibold text-[#091747] font-['Newsreader']">
                Google Meet Integration
              </h2>
              <p className="text-[#091747]/60 text-sm">
                HIPAA-compliant virtual visits with automatic recording and transcription
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white/60 rounded-lg p-4 border border-blue-100">
              <Users className="w-5 h-5 text-blue-600 mb-2" />
              <h3 className="font-medium text-[#091747] text-sm">Secure Meetings</h3>
              <p className="text-xs text-[#091747]/60">HIPAA-compliant Google Meet links</p>
            </div>
            <div className="bg-white/60 rounded-lg p-4 border border-blue-100">
              <Phone className="w-5 h-5 text-blue-600 mb-2" />
              <h3 className="font-medium text-[#091747] text-sm">Auto Recording</h3>
              <p className="text-xs text-[#091747]/60">Automatic session recording for notes</p>
            </div>
            <div className="bg-white/60 rounded-lg p-4 border border-blue-100">
              <Calendar className="w-5 h-5 text-blue-600 mb-2" />
              <h3 className="font-medium text-[#091747] text-sm">Calendar Integration</h3>
              <p className="text-xs text-[#091747]/60">Sync with Google Calendar events</p>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Today's Visits */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#091747] font-['Newsreader']">Today's Visits</h2>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-[#091747]/60">Ready for visits</span>
                </div>
              </div>

              {/* Mock Upcoming Visits */}
              <div className="space-y-4">
                <div className="p-4 border border-stone-200 rounded-lg hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-[#091747]">John Smith - Follow-up</h3>
                      <p className="text-sm text-[#091747]/60 mt-1">45-minute therapy session</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Coming Up</span>
                        <span className="text-xs text-[#091747]/50">2:00 PM - 2:45 PM</span>
                        <span className="text-xs text-[#091747]/50">Virtual</span>
                      </div>
                    </div>
                    <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors font-medium flex items-center gap-2">
                      <Video className="h-4 w-4" />
                      Start Visit
                    </button>
                  </div>
                </div>

                <div className="p-4 border border-stone-200 rounded-lg hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-[#091747]">Sarah Johnson - Initial Assessment</h3>
                      <p className="text-sm text-[#091747]/60 mt-1">60-minute intake appointment</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">Scheduled</span>
                        <span className="text-xs text-[#091747]/50">4:00 PM - 5:00 PM</span>
                        <span className="text-xs text-[#091747]/50">Virtual</span>
                      </div>
                    </div>
                    <button className="bg-stone-100 text-[#091747] px-4 py-2 rounded-lg transition-colors font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Not Ready
                    </button>
                  </div>
                </div>

                <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-[#091747]">Mike Davis - Medication Review</h3>
                      <p className="text-sm text-[#091747]/60 mt-1">15-minute check-in completed</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Completed</span>
                        <span className="text-xs text-[#091747]/50">10:00 AM - 10:15 AM</span>
                        <span className="text-xs text-[#091747]/50">Recording Available</span>
                      </div>
                    </div>
                    <button className="bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white px-4 py-2 rounded-lg transition-colors font-medium">
                      Generate Notes
                    </button>
                  </div>
                </div>
              </div>

              {/* Empty State (when no visits) */}
              <div className="text-center py-12 hidden">
                <VideoOff className="h-12 w-12 text-[#091747]/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-[#091747] mb-2">No Visits Today</h3>
                <p className="text-[#091747]/60 mb-6">
                  Virtual visits from your scheduled appointments will appear here.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
              <h3 className="font-semibold text-[#091747] mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg transition-colors font-medium flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Start Instant Meeting
                </button>
                <button className="w-full bg-stone-50 hover:bg-stone-100 text-[#091747] p-3 rounded-lg transition-colors font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  View Calendar
                </button>
                <button className="w-full bg-stone-50 hover:bg-stone-100 text-[#091747] p-3 rounded-lg transition-colors font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Audio-Only Mode
                </button>
              </div>
            </div>

            {/* Visit Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
              <h3 className="font-semibold text-[#091747] mb-4">This Week</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#091747]/60">Virtual Visits</span>
                    <span className="font-semibold text-[#091747]">12</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#091747]/60">Total Session Time</span>
                    <span className="font-semibold text-[#091747]">8.5 hrs</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#091747]/60">Recordings Generated</span>
                    <span className="font-semibold text-[#091747]">11</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Google Meet Status */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h3 className="font-semibold text-blue-900 mb-3">🎥 Google Meet Ready</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>• HIPAA-compliant workspace</li>
                <li>• Automatic recording enabled</li>
                <li>• Calendar integration active</li>
                <li>• Transcription ready for notes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}