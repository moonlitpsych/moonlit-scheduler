/**
 * Partner Dashboard - Patient Roster Page
 * View all assigned patients with ROI status and upcoming appointments
 */

'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { PartnerHeader } from '@/components/partner-dashboard/PartnerHeader'
import { PartnerUser } from '@/types/partner-types'
import { Database } from '@/types/database'
import { Users, Calendar, CheckCircle, AlertCircle, XCircle, Filter } from 'lucide-react'
import Link from 'next/link'

interface PatientWithDetails {
  id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  date_of_birth?: string
  status: string
  primary_insurance_payer?: {
    id: string
    name: string
  }
  affiliation: {
    id: string
    affiliation_type: string
    start_date: string
    consent_on_file: boolean
    consent_expires_on?: string
    consent_status: 'active' | 'expired' | 'missing'
    primary_contact_user_id?: string
    status: string
  }
  is_assigned_to_me: boolean
  next_appointment?: {
    id: string
    start_time: string
    status: string
    providers?: {
      first_name: string
      last_name: string
    }
  } | null
  upcoming_appointment_count: number
}

export default function PatientRosterPage() {
  const [partnerUser, setPartnerUser] = useState<PartnerUser | null>(null)
  const [patients, setPatients] = useState<PatientWithDetails[]>([])
  const [filteredPatients, setFilteredPatients] = useState<PatientWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'assigned' | 'roi_missing'>('all')

  // Fetch partner user and patients
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Get authenticated user
        const supabase = createClientComponentClient<Database>()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          setError('Authentication required')
          return
        }

        // Fetch partner user data
        const userResponse = await fetch('/api/partner/me', {
          headers: { 'x-partner-user-id': user.id }
        })

        if (!userResponse.ok) {
          setError('Failed to load partner user data')
          return
        }

        const userData = await userResponse.json()
        if (!userData.success) {
          setError(userData.error || 'Failed to load user data')
          return
        }

        setPartnerUser(userData.data)

        // Fetch patients
        const patientsResponse = await fetch('/api/partner-dashboard/patients')

        if (!patientsResponse.ok) {
          setError('Failed to load patients')
          return
        }

        const patientsData = await patientsResponse.json()
        if (!patientsData.success) {
          setError(patientsData.error || 'Failed to load patients')
          return
        }

        setPatients(patientsData.data.patients)
        setFilteredPatients(patientsData.data.patients)

      } catch (err: any) {
        console.error('Error loading patients:', err)
        setError('Failed to load patient roster')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Filter and search patients
  useEffect(() => {
    let filtered = [...patients]

    // Apply type filter
    if (filterType === 'assigned') {
      filtered = filtered.filter(p => p.is_assigned_to_me)
    } else if (filterType === 'roi_missing') {
      filtered = filtered.filter(p => p.affiliation.consent_status !== 'active')
    }

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(p =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(search) ||
        p.email?.toLowerCase().includes(search) ||
        p.phone?.includes(search)
      )
    }

    setFilteredPatients(filtered)
  }, [patients, searchTerm, filterType])

  const getROIStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </span>
        )
      case 'expired':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            Expired
          </span>
        )
      case 'missing':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Missing
          </span>
        )
      default:
        return null
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  if (error) {
    return (
      <div className="min-h-screen bg-moonlit-cream">
        <div className="container mx-auto px-4 py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">{error}</p>
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
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-moonlit-cream">
      <PartnerHeader partnerUser={partnerUser} currentPage="patients" />

      <div className="container mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-moonlit-navy mb-2 font-['Newsreader']">
            Patient Roster
          </h1>
          <p className="text-gray-600 font-['Newsreader'] font-light">
            View and manage patients from your organization
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 font-['Newsreader']">Total Patients</p>
                <p className="text-2xl font-bold text-moonlit-navy mt-1">{patients.length}</p>
              </div>
              <Users className="w-8 h-8 text-moonlit-brown" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 font-['Newsreader']">Assigned to Me</p>
                <p className="text-2xl font-bold text-moonlit-navy mt-1">
                  {patients.filter(p => p.is_assigned_to_me).length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 font-['Newsreader']">ROI Missing</p>
                <p className="text-2xl font-bold text-moonlit-navy mt-1">
                  {patients.filter(p => p.affiliation.consent_status !== 'active').length}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
        </div>

        {/* Filters and search */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search patients by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-moonlit-brown focus:border-transparent"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterType === 'all'
                    ? 'bg-moonlit-brown text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('assigned')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterType === 'assigned'
                    ? 'bg-moonlit-brown text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                My Patients
              </button>
              <button
                onClick={() => setFilterType('roi_missing')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterType === 'roi_missing'
                    ? 'bg-moonlit-brown text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                ROI Missing
              </button>
            </div>
          </div>
        </div>

        {/* Patient list */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {filteredPatients.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-['Newsreader']">
                {searchTerm ? 'No patients found matching your search.' : 'No patients to display.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ROI Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Next Appointment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPatients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {patient.first_name} {patient.last_name}
                              {patient.is_assigned_to_me && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  Assigned
                                </span>
                              )}
                            </div>
                            {patient.primary_insurance_payer && (
                              <div className="text-sm text-gray-500">
                                {patient.primary_insurance_payer.name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{patient.email || '—'}</div>
                        <div className="text-sm text-gray-500">{patient.phone || '—'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getROIStatusBadge(patient.affiliation.consent_status)}
                        {patient.affiliation.consent_expires_on && (
                          <div className="text-xs text-gray-500 mt-1">
                            Expires: {new Date(patient.affiliation.consent_expires_on).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {patient.next_appointment ? (
                          <div>
                            <div className="text-sm text-gray-900 flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {formatDate(patient.next_appointment.start_time)}
                            </div>
                            {patient.next_appointment.providers && (
                              <div className="text-sm text-gray-500">
                                Dr. {patient.next_appointment.providers.last_name}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">No upcoming</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          href={`/partner-dashboard/patients/${patient.id}`}
                          className="text-moonlit-brown hover:text-moonlit-brown/80"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
