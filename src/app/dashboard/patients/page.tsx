'use client'

import { Database } from '@/types/database'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import PatientManager from '@/components/patients/PatientManager'
import PatientSearch from '@/components/notes/PatientSearch'
import NoteGenerator from '@/components/notes/NoteGenerator'

export default function PatientsPage() {
  const [user, setUser] = useState<any>(null)
  const [provider, setProvider] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const [showNoteGenerator, setShowNoteGenerator] = useState(false)
  
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

  const handlePatientSelect = (patient: any) => {
    setSelectedPatient(patient)
    setShowNoteGenerator(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#BF9C73] mx-auto"></div>
          <p className="mt-4 text-[#091747] font-medium">Loading patient records...</p>
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
            Patient Records
          </h1>
          <p className="mt-2 text-[#091747]/70">
            Manage patient database, search IntakeQ records, and generate clinical notes.
          </p>
        </div>

        {showNoteGenerator && selectedPatient ? (
          /* Note Generation View */
          <div className="space-y-6">
            {/* Back Button */}
            <button
              onClick={() => {
                setShowNoteGenerator(false)
                setSelectedPatient(null)
              }}
              className="text-[#BF9C73] hover:text-[#BF9C73]/80 text-sm font-medium flex items-center gap-2"
            >
              ← Back to Patients
            </button>

            {/* Patient Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-[#BF9C73]/20 flex items-center justify-center">
                  <span className="text-sm font-medium text-[#BF9C73]">
                    {selectedPatient.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="font-semibold text-[#091747] font-['Newsreader']">
                    Generating Note for {selectedPatient.name}
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-[#091747]/60">
                    {selectedPatient.email && <span>📧 {selectedPatient.email}</span>}
                    {selectedPatient.mrn && <span>MRN: {selectedPatient.mrn}</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Note Generator */}
            <NoteGenerator
              patient={selectedPatient}
              onNoteSaved={(noteId) => {
                console.log('Note saved:', noteId)
                // Could navigate to notes page or show success message
              }}
            />
          </div>
        ) : (
          /* Patient Management View */
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Main Patient Management */}
            <div className="xl:col-span-2">
              <PatientManager 
                providerId={provider?.id}
                onPatientSelect={handlePatientSelect}
              />
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* IntakeQ Patient Search */}
              <PatientSearch 
                onPatientSelect={handlePatientSelect}
              />

              {/* Patient Stats */}
              <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                <h3 className="font-semibold text-[#091747] mb-4">Patient Database</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#091747]/60">Total Patients</span>
                    <span className="font-semibold text-[#091747]">127</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#091747]/60">Active This Month</span>
                    <span className="font-semibold text-[#091747]">43</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#091747]/60">IntakeQ Synced</span>
                    <span className="font-semibold text-[#091747]">98</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#091747]/60">Notes Generated</span>
                    <span className="font-semibold text-[#091747]">156</span>
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
                    Generate New Note
                  </button>
                  <button 
                    onClick={() => router.push('/dashboard/appointments')}
                    className="w-full bg-stone-50 hover:bg-stone-100 text-[#091747] p-3 rounded-lg transition-colors font-medium text-sm"
                  >
                    View Appointments
                  </button>
                  <button 
                    className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 p-3 rounded-lg transition-colors font-medium text-sm"
                  >
                    Sync with IntakeQ
                  </button>
                </div>
              </div>

              {/* Integration Status */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                <h3 className="font-semibold text-green-900 mb-3">🔗 EMR Integration</h3>
                <ul className="space-y-2 text-sm text-green-800">
                  <li>• IntakeQ API connected</li>
                  <li>• Real-time patient sync</li>
                  <li>• Insurance data available</li>
                  <li>• HIPAA-compliant access</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}