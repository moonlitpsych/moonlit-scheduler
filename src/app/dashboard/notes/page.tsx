'use client'

import { Database } from '@/types/database'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { FileText, Mic, Plus, Search, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function ProviderNotesPage() {
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
          <p className="mt-4 text-[#091747] font-medium">Loading notes dashboard...</p>
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
            Clinical Notes
          </h1>
          <p className="mt-2 text-[#091747]/70">
            AI-powered note generation and patient documentation management.
          </p>
        </div>

        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-[#BF9C73]/10 to-[#F6B398]/10 rounded-xl p-8 mb-8 border border-[#BF9C73]/20">
          <div className="flex items-center mb-4">
            <div className="p-3 bg-[#BF9C73]/20 rounded-full">
              <Sparkles className="w-6 h-6 text-[#BF9C73]" />
            </div>
            <div className="ml-4">
              <h2 className="text-xl font-semibold text-[#091747] font-['Newsreader']">
                AI Note Generation
              </h2>
              <p className="text-[#091747]/60 text-sm">
                Generate professional clinical notes from visit transcripts using AI
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white/60 rounded-lg p-4 border border-[#BF9C73]/10">
              <FileText className="w-5 h-5 text-[#BF9C73] mb-2" />
              <h3 className="font-medium text-[#091747] text-sm">Professional Templates</h3>
              <p className="text-xs text-[#091747]/60">SOAP notes, intake assessments, follow-ups</p>
            </div>
            <div className="bg-white/60 rounded-lg p-4 border border-[#BF9C73]/10">
              <Mic className="w-5 h-5 text-[#BF9C73] mb-2" />
              <h3 className="font-medium text-[#091747] text-sm">Audio Processing</h3>
              <p className="text-xs text-[#091747]/60">Generate notes from meeting transcripts</p>
            </div>
            <div className="bg-white/60 rounded-lg p-4 border border-[#BF9C73]/10">
              <Search className="w-5 h-5 text-[#BF9C73] mb-2" />
              <h3 className="font-medium text-[#091747] text-sm">Patient Integration</h3>
              <p className="text-xs text-[#091747]/60">Link notes to patient appointments</p>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Notes */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#091747] font-['Newsreader']">Recent Notes</h2>
                <button className="bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white px-4 py-2 rounded-lg transition-colors font-medium flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  New Note
                </button>
              </div>

              {/* Mock Recent Notes */}
              <div className="space-y-4">
                <div className="p-4 border border-stone-200 rounded-lg hover:border-[#BF9C73]/30 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-[#091747]">Follow-up Visit - John Smith</h3>
                      <p className="text-sm text-[#091747]/60 mt-1">Generated from 45-minute virtual session</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Completed</span>
                        <span className="text-xs text-[#091747]/50">2 hours ago</span>
                        <span className="text-xs text-[#091747]/50">SOAP Note</span>
                      </div>
                    </div>
                    <FileText className="w-5 h-5 text-[#BF9C73]" />
                  </div>
                </div>

                <div className="p-4 border border-stone-200 rounded-lg hover:border-[#BF9C73]/30 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-[#091747]">Initial Assessment - Sarah Johnson</h3>
                      <p className="text-sm text-[#091747]/60 mt-1">Intake appointment with diagnostic assessment</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">In Progress</span>
                        <span className="text-xs text-[#091747]/50">1 day ago</span>
                        <span className="text-xs text-[#091747]/50">Intake Form</span>
                      </div>
                    </div>
                    <FileText className="w-5 h-5 text-[#BF9C73]" />
                  </div>
                </div>

                <div className="p-4 border border-stone-200 rounded-lg hover:border-[#BF9C73]/30 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-[#091747]">Medication Review - Mike Davis</h3>
                      <p className="text-sm text-[#091747]/60 mt-1">15-minute check-in for prescription adjustment</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Completed</span>
                        <span className="text-xs text-[#091747]/50">3 days ago</span>
                        <span className="text-xs text-[#091747]/50">Progress Note</span>
                      </div>
                    </div>
                    <FileText className="w-5 h-5 text-[#BF9C73]" />
                  </div>
                </div>
              </div>

              {/* Empty State (when no notes) */}
              <div className="text-center py-12 hidden">
                <FileText className="h-12 w-12 text-[#091747]/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-[#091747] mb-2">No Notes Yet</h3>
                <p className="text-[#091747]/60 mb-6">
                  Start by generating your first clinical note from a patient visit.
                </p>
                <button className="bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white px-6 py-3 rounded-lg transition-colors font-medium">
                  Generate First Note
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
              <h3 className="font-semibold text-[#091747] mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white p-3 rounded-lg transition-colors font-medium flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Generate New Note
                </button>
                <button className="w-full bg-stone-50 hover:bg-stone-100 text-[#091747] p-3 rounded-lg transition-colors font-medium flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Search Patients
                </button>
                <button className="w-full bg-stone-50 hover:bg-stone-100 text-[#091747] p-3 rounded-lg transition-colors font-medium flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  Upload Transcript
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
              <h3 className="font-semibold text-[#091747] mb-4">This Month</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#091747]/60">Notes Generated</span>
                    <span className="font-semibold text-[#091747]">24</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#091747]/60">Patients Documented</span>
                    <span className="font-semibold text-[#091747]">18</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#091747]/60">Avg. Generation Time</span>
                    <span className="font-semibold text-[#091747]">2.3 min</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Integration Status */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <h3 className="font-semibold text-green-900 mb-3">✅ AI Notes Integration</h3>
              <ul className="space-y-2 text-sm text-green-800">
                <li>• Connected to your appointments</li>
                <li>• Google Meet transcripts ready</li>
                <li>• IntakeQ EMR integration active</li>
                <li>• HIPAA-compliant processing</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}