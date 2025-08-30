'use client'

import { useState, useEffect } from 'react'
import { Database } from '@/types/database'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { User, Search, Plus, FileText, Calendar, Phone, Mail, CreditCard, Filter, Eye, Edit } from 'lucide-react'

interface Patient {
  id: string
  name: string
  email?: string
  phone?: string
  mrn?: string
  dob?: string
  gender?: string
  source: 'intakeq' | 'moonlit'
  intakeq_id?: string
  insurance?: {
    primary?: {
      company?: string
      policyNumber?: string
      memberName?: string
      groupNumber?: string
    }
  }
  created_at: string
  last_appointment?: string
  appointment_count?: number
}

interface PatientManagerProps {
  providerId?: string
  onPatientSelect?: (patient: Patient) => void
}

export default function PatientManager({ providerId, onPatientSelect }: PatientManagerProps) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<'all' | 'recent' | 'intakeq'>('all')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    loadPatients()
  }, [filter, providerId])

  const loadPatients = async () => {
    setLoading(true)
    setError('')

    try {
      // This would connect to your patient database
      // For now, showing the structure with mock data
      const mockPatients: Patient[] = [
        {
          id: 'patient_1',
          name: 'Sarah Johnson',
          email: 'sarah.johnson@email.com',
          phone: '(555) 123-4567',
          mrn: 'MRN001234',
          dob: '1985-06-15',
          gender: 'female',
          source: 'intakeq',
          intakeq_id: 'iq_12345',
          insurance: {
            primary: {
              company: 'Blue Cross Blue Shield',
              policyNumber: 'BCBS123456789',
              memberName: 'Sarah Johnson',
              groupNumber: 'GRP001'
            }
          },
          created_at: '2024-01-15T10:30:00Z',
          last_appointment: '2024-02-20T14:00:00Z',
          appointment_count: 5
        },
        {
          id: 'patient_2', 
          name: 'Michael Chen',
          email: 'mchen@email.com',
          phone: '(555) 987-6543',
          mrn: 'MRN001235',
          dob: '1992-03-22',
          gender: 'male',
          source: 'moonlit',
          created_at: '2024-02-01T09:15:00Z',
          last_appointment: '2024-02-25T11:00:00Z',
          appointment_count: 2
        },
        {
          id: 'patient_3',
          name: 'Emily Rodriguez',
          email: 'emily.r@email.com',
          phone: '(555) 456-7890',
          mrn: 'MRN001236',
          dob: '1978-11-08',
          gender: 'female',
          source: 'intakeq',
          intakeq_id: 'iq_67890',
          insurance: {
            primary: {
              company: 'Aetna',
              policyNumber: 'AET987654321',
              memberName: 'Emily Rodriguez',
              groupNumber: 'GRP002'
            }
          },
          created_at: '2024-01-20T16:45:00Z',
          last_appointment: '2024-02-18T10:30:00Z',
          appointment_count: 8
        }
      ]

      let filteredPatients = mockPatients

      if (filter === 'recent') {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        filteredPatients = mockPatients.filter(p => 
          p.last_appointment && new Date(p.last_appointment) >= thirtyDaysAgo
        )
      } else if (filter === 'intakeq') {
        filteredPatients = mockPatients.filter(p => p.source === 'intakeq')
      }

      setPatients(filteredPatients)
    } catch (err: any) {
      console.error('Error loading patients:', err)
      setError('Failed to load patients')
    } finally {
      setLoading(false)
    }
  }

  const filteredPatients = patients.filter(patient => {
    if (!searchTerm.trim()) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      patient.name.toLowerCase().includes(searchLower) ||
      patient.email?.toLowerCase().includes(searchLower) ||
      patient.phone?.includes(searchTerm) ||
      patient.mrn?.toLowerCase().includes(searchLower)
    )
  })

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getSourceBadge = (source: string) => {
    return source === 'intakeq' 
      ? 'bg-blue-100 text-blue-700' 
      : 'bg-[#BF9C73]/10 text-[#BF9C73]'
  }

  const handlePatientClick = (patient: Patient) => {
    setSelectedPatient(patient)
    onPatientSelect?.(patient)
  }

  const syncWithIntakeQ = async () => {
    // IntakeQ sync logic would go here
    console.log('Syncing patients with IntakeQ...')
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-[#091747] font-['Newsreader'] mb-2">
              Patients
            </h3>
            <p className="text-sm text-[#091747]/60">
              Manage your patient database and medical records
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={syncWithIntakeQ}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors font-medium flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              Sync IntakeQ
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          {/* Filter Tabs */}
          <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
            {[
              { key: 'all', label: 'All Patients' },
              { key: 'recent', label: 'Recent' },
              { key: 'intakeq', label: 'IntakeQ' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  filter === tab.key
                    ? 'bg-white text-[#091747] shadow-sm'
                    : 'text-[#091747]/60 hover:text-[#091747]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-[#091747]/40" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search patients by name, email, phone, or MRN..."
              className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent font-['Newsreader']"
            />
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
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
      {!loading && filteredPatients.length === 0 && (
        <div className="text-center py-8">
          <User className="w-12 h-12 text-[#091747]/30 mx-auto mb-4" />
          <p className="text-[#091747]/60 font-['Newsreader']">
            {patients.length === 0 
              ? 'No patients found. Sync with IntakeQ to import patient records.'
              : 'No patients match your search criteria.'
            }
          </p>
        </div>
      )}

      {/* Patients List */}
      {filteredPatients.length > 0 && (
        <div className="space-y-4">
          {filteredPatients.map((patient) => (
            <div
              key={patient.id}
              onClick={() => handlePatientClick(patient)}
              className="p-4 border border-stone-200 rounded-lg hover:border-[#BF9C73]/30 hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  {/* Avatar */}
                  <div className="h-12 w-12 rounded-full bg-[#BF9C73]/10 flex items-center justify-center group-hover:bg-[#BF9C73]/20 transition-colors">
                    <span className="text-sm font-medium text-[#BF9C73]">
                      {getInitials(patient.name)}
                    </span>
                  </div>

                  <div className="flex-1">
                    {/* Patient Name and Source */}
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-[#091747] font-['Newsreader']">
                        {patient.name}
                      </h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSourceBadge(patient.source)}`}>
                        {patient.source === 'intakeq' ? 'IntakeQ' : 'Moonlit'}
                      </span>
                    </div>

                    {/* Contact Information */}
                    <div className="text-sm text-[#091747]/60 space-y-1 mb-3">
                      {patient.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3" />
                          {patient.email}
                        </div>
                      )}
                      {patient.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3 h-3" />
                          {patient.phone}
                        </div>
                      )}
                      <div className="flex items-center gap-4">
                        {patient.dob && (
                          <div>DOB: {formatDate(patient.dob)}</div>
                        )}
                        {patient.mrn && (
                          <div className="font-mono text-xs">MRN: {patient.mrn}</div>
                        )}
                        {patient.gender && (
                          <div className="capitalize">{patient.gender}</div>
                        )}
                      </div>
                    </div>

                    {/* Appointment Stats */}
                    <div className="flex items-center gap-4 text-xs text-[#091747]/50">
                      {patient.appointment_count !== undefined && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {patient.appointment_count} appointments
                        </div>
                      )}
                      {patient.last_appointment && (
                        <div>Last visit: {formatDate(patient.last_appointment)}</div>
                      )}
                      <div>Added: {formatDate(patient.created_at)}</div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      // View patient details
                      console.log('View patient:', patient.id)
                    }}
                    className="text-[#091747]/60 hover:text-[#091747] p-1 rounded transition-colors"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      // Edit patient
                      console.log('Edit patient:', patient.id)
                    }}
                    className="text-[#091747]/60 hover:text-[#091747] p-1 rounded transition-colors"
                    title="Edit Patient"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Insurance Information */}
              {patient.insurance?.primary && (
                <div className="mt-3 p-3 bg-stone-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-[#091747]">
                      Primary Insurance
                    </span>
                  </div>
                  <div className="text-xs text-[#091747]/60 space-y-1">
                    {patient.insurance.primary.company && (
                      <div><strong>Company:</strong> {patient.insurance.primary.company}</div>
                    )}
                    {patient.insurance.primary.policyNumber && (
                      <div><strong>Policy:</strong> {patient.insurance.primary.policyNumber}</div>
                    )}
                    {patient.insurance.primary.memberName && (
                      <div><strong>Member:</strong> {patient.insurance.primary.memberName}</div>
                    )}
                    {patient.insurance.primary.groupNumber && (
                      <div><strong>Group:</strong> {patient.insurance.primary.groupNumber}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {filteredPatients.length > 0 && (
        <div className="mt-6 pt-4 border-t border-stone-200">
          <p className="text-sm text-[#091747]/60 font-['Newsreader']">
            Showing {filteredPatients.length} of {patients.length} patients
          </p>
        </div>
      )}
    </div>
  )
}