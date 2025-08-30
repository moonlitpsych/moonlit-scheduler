'use client'

import { useState, useEffect } from 'react'
import { Database } from '@/types/database'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { MagnifyingGlassIcon, UserPlusIcon, UserIcon, CreditCardIcon } from '@heroicons/react/24/outline'

interface IntakeQPatient {
  id: string
  name: string
  email?: string
  phone?: string
  mrn?: string
  dob?: string
  gender?: string
  source: 'intakeq'
  intakeQId: string
  insurance?: {
    primary?: {
      company?: string
      policyNumber?: string
      memberName?: string
      groupNumber?: string
    }
  }
}

interface PatientSearchProps {
  onPatientSelect?: (patient: IntakeQPatient) => void
}

export default function PatientSearch({ onPatientSelect }: PatientSearchProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [patients, setPatients] = useState<IntakeQPatient[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  
  const supabase = createClientComponentClient<Database>()

  const searchPatients = async () => {
    if (!searchTerm.trim()) return

    setLoading(true)
    setError('')
    setPatients([])

    try {
      const searchUrl = `/api/intakeq/search?query=${encodeURIComponent(searchTerm.trim())}`
      const response = await fetch(searchUrl)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to search patients')
      }

      const clients = await response.json()
      
      // Transform the response to match our internal patient format
      const transformedPatients = clients.map((client: any) => ({
        id: `intakeq_${client.intakeqId}`,
        name: client.name,
        email: client.email,
        phone: client.phone,
        mrn: client.intakeqId,
        dob: client.dateOfBirth,
        gender: client.gender?.toLowerCase() || '',
        source: 'intakeq' as const,
        intakeQId: client.intakeqId,
        insurance: {
          primary: client.insurance?.primary ? {
            company: client.insurance.primary.company,
            policyNumber: client.insurance.primary.policyNumber,
            memberName: client.insurance.primary.memberName,
            groupNumber: client.insurance.primary.groupNumber
          } : undefined
        }
      }))

      setPatients(transformedPatients)
      setHasSearched(true)
    } catch (err: any) {
      setError(err.message)
      setPatients([])
    } finally {
      setLoading(false)
    }
  }

  const loadAllPatients = async () => {
    setLoading(true)
    setError('')
    setPatients([])

    try {
      const response = await fetch('/api/intakeq/clients?includeProfile=true')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load patients')
      }

      if (data.success) {
        const transformedPatients = (data.data || []).map((patient: any) => ({
          id: patient.id,
          name: patient.name,
          email: patient.email,
          phone: patient.phone,
          mrn: patient.mrn,
          dob: patient.dob,
          gender: patient.gender,
          source: patient.source,
          intakeQId: patient.intakeQId,
          insurance: patient.insurance
        }))
        
        setPatients(transformedPatients)
        setHasSearched(true)
      } else {
        throw new Error(data.error || 'Failed to load patients')
      }
    } catch (err: any) {
      setError(err.message)
      setPatients([])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchPatients()
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-[#091747] font-['Newsreader'] mb-2">
          Select Patient
        </h3>
        <p className="text-sm text-[#091747]/60">
          Search for a patient to generate clinical notes
        </p>
      </div>

      {/* Search Controls */}
      <div className="mb-6">
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-3 text-[#091747]/40" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search by name or email..."
              className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent font-['Newsreader']"
            />
          </div>
          <button
            onClick={searchPatients}
            disabled={loading || !searchTerm.trim()}
            className="bg-[#BF9C73] text-white px-4 py-2 rounded-lg hover:bg-[#BF9C73]/90 disabled:bg-stone-400 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        
        <div className="text-center">
          <span className="text-[#091747]/50 text-sm">or</span>
          <button
            onClick={loadAllPatients}
            disabled={loading}
            className="ml-2 text-[#BF9C73] hover:text-[#BF9C73]/80 text-sm font-medium transition-colors"
          >
            Load All Patients
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
          {error.includes('API key') && (
            <p className="text-xs text-red-500 mt-1">
              Please configure your IntakeQ API key in the environment settings.
            </p>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#BF9C73]"></div>
          <p className="mt-2 text-[#091747]/60 font-['Newsreader']">Loading patients...</p>
        </div>
      )}

      {/* No Results */}
      {hasSearched && !loading && patients.length === 0 && !error && (
        <div className="text-center py-8">
          <UserIcon className="w-12 h-12 text-[#091747]/30 mx-auto mb-4" />
          <p className="text-[#091747]/60 font-['Newsreader']">No patients found. Try a different search term.</p>
        </div>
      )}

      {/* Results */}
      {patients.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-[#091747]/60 font-['Newsreader']">
              Found {patients.length} patients
            </p>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-3">
            {patients.map((patient) => (
              <div
                key={patient.id}
                onClick={() => onPatientSelect?.(patient)}
                className="p-4 border border-stone-200 rounded-lg hover:border-[#BF9C73]/30 hover:shadow-sm transition-all cursor-pointer group"
              >
                <div className="flex items-center">
                  {/* Avatar */}
                  <div className="h-12 w-12 rounded-full bg-[#BF9C73]/10 flex items-center justify-center group-hover:bg-[#BF9C73]/20 transition-colors">
                    <span className="text-sm font-medium text-[#BF9C73]">
                      {getInitials(patient.name)}
                    </span>
                  </div>
                  
                  <div className="ml-4 flex-1">
                    <div className="font-medium text-[#091747] font-['Newsreader']">{patient.name}</div>
                    <div className="text-sm text-[#091747]/60 space-y-1">
                      {patient.email && (
                        <div>📧 {patient.email}</div>
                      )}
                      {patient.phone && (
                        <div>📞 {patient.phone}</div>
                      )}
                      {patient.dob && (
                        <div>🎂 DOB: {patient.dob}</div>
                      )}
                      {patient.mrn && (
                        <div className="font-mono text-xs">MRN: {patient.mrn}</div>
                      )}
                    </div>
                  </div>

                  {/* Insurance Badge */}
                  {patient.insurance?.primary?.company && (
                    <div className="ml-4">
                      <div className="flex items-center bg-green-50 text-green-700 px-2 py-1 rounded-full text-xs">
                        <CreditCardIcon className="w-3 h-3 mr-1" />
                        {patient.insurance.primary.company}
                      </div>
                    </div>
                  )}
                </div>

                {/* Insurance Details */}
                {patient.insurance?.primary && (
                  <div className="mt-3 p-3 bg-stone-50 rounded-lg">
                    <div className="text-xs text-[#091747]/60 space-y-1">
                      {patient.insurance.primary.policyNumber && (
                        <div>Policy: {patient.insurance.primary.policyNumber}</div>
                      )}
                      {patient.insurance.primary.memberName && (
                        <div>Member: {patient.insurance.primary.memberName}</div>
                      )}
                      {patient.insurance.primary.groupNumber && (
                        <div>Group: {patient.insurance.primary.groupNumber}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Integration Status */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center">
          <UserPlusIcon className="w-5 h-5 text-blue-600 mr-2" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">Patient Integration Ready</h4>
            <p className="text-xs text-blue-700">
              Select a patient to generate AI-powered clinical notes from appointment transcripts
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}