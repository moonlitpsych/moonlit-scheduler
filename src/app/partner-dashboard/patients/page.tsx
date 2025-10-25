/**
 * Partner Dashboard - Patient Roster Page
 * View all assigned patients with ROI status and upcoming appointments
 */

'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { PartnerHeader } from '@/components/partner-dashboard/PartnerHeader'
import { TransferPatientModal } from '@/components/partner-dashboard/TransferPatientModal'
import { SendNotificationModal } from '@/components/partner-dashboard/SendNotificationModal'
import { UploadROIModal } from '@/components/partner-dashboard/UploadROIModal'
import { AssignProviderModal } from '@/components/partner-dashboard/AssignProviderModal'
import { EngagementStatusChip } from '@/components/partner-dashboard/EngagementStatusChip'
import { AppointmentStatusIndicator } from '@/components/partner-dashboard/AppointmentStatusIndicator'
import { ChangeEngagementStatusModal } from '@/components/partner-dashboard/ChangeEngagementStatusModal'
import SyncAppointmentsButton from '@/components/partner-dashboard/SyncAppointmentsButton'
import BulkSyncButton from '@/components/partner-dashboard/BulkSyncButton'
import { PartnerUser } from '@/types/partner-types'
import { Database } from '@/types/database'
import { Users, Calendar, CheckCircle, AlertCircle, UserCheck, Bell, FileText, Activity } from 'lucide-react'
import Link from 'next/link'

// SWR fetcher function
const fetcher = (url: string) => fetch(url).then(res => res.json())

interface PatientWithDetails {
  id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  date_of_birth?: string
  status: string
  primary_provider_id?: string
  primary_provider?: {
    id: string
    first_name: string
    last_name: string
  }
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
    roi_file_url?: string
    primary_contact_user_id?: string
    status: string
    last_practiceq_sync_at?: string | null
  }
  is_assigned_to_me: boolean
  current_assignment?: {
    partner_user_id: string
    partner_users?: {
      full_name: string
    }
  }
  previous_appointment?: {
    id: string
    start_time: string
    status: string
    providers?: {
      first_name: string
      last_name: string
    }
  } | null
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
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'assigned' | 'roi_missing' | 'active_only' | 'no_future_appt'>('all')
  const [engagementStatusFilter, setEngagementStatusFilter] = useState<string>('active')

  // Pagination state
  const [page, setPage] = useState(1)
  const [allPatients, setAllPatients] = useState<PatientWithDetails[]>([])

  // Use SWR for data fetching with caching
  const { data: partnerData, error: partnerError } = useSWR('/api/partner/me', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000, // 5 minutes
  })

  const { data: patientsData, error: patientsError, mutate } = useSWR(
    `/api/partner-dashboard/patients?page=${page}&limit=20`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30 seconds
      onSuccess: (data) => {
        if (data.success && page === 1) {
          setAllPatients(data.data.patients)
        } else if (data.success && page > 1) {
          setAllPatients(prev => [...prev, ...data.data.patients])
        }
      }
    }
  )

  const partnerUser = partnerData?.success ? partnerData.data : null
  const patients = patientsData?.success ? allPatients : []
  const totalCount = patientsData?.data?.pagination?.total || 0
  const hasMore = patientsData?.data?.pagination?.hasMore || false
  const loading = !patientsData && !patientsError
  const error = partnerError || patientsError

  // Transfer modal state
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<PatientWithDetails | null>(null)

  // Notification modal state
  const [notificationModalOpen, setNotificationModalOpen] = useState(false)
  const [notifyPatient, setNotifyPatient] = useState<PatientWithDetails | null>(null)

  // ROI modal state
  const [roiModalOpen, setRoiModalOpen] = useState(false)
  const [roiPatient, setRoiPatient] = useState<PatientWithDetails | null>(null)

  // Assign provider modal state
  const [assignProviderModalOpen, setAssignProviderModalOpen] = useState(false)
  const [assignProviderPatient, setAssignProviderPatient] = useState<PatientWithDetails | null>(null)

  // Change engagement status modal state
  const [changeStatusModalOpen, setChangeStatusModalOpen] = useState(false)
  const [changeStatusPatient, setChangeStatusPatient] = useState<PatientWithDetails | null>(null)

  // Function to refresh patient data (used by sync button)
  const refreshPatientData = async () => {
    setPage(1)
    setAllPatients([])
    await mutate() // Revalidate SWR cache
  }

  // Optimistic update helper - updates UI immediately, then revalidates
  const optimisticUpdatePatient = async (
    patientId: string,
    updates: Partial<PatientWithDetails>,
    apiCall: () => Promise<void>
  ) => {
    // Update local state immediately for instant UI feedback
    setAllPatients(prev =>
      prev.map(p => p.id === patientId ? { ...p, ...updates } : p)
    )

    try {
      // Make the actual API call
      await apiCall()
      // Refresh from server to get authoritative data
      await mutate()
    } catch (error) {
      // Rollback on error by refreshing from server
      console.error('Optimistic update failed, rolling back:', error)
      await mutate()
      throw error
    }
  }

  // Load more patients (pagination)
  const loadMorePatients = () => {
    if (hasMore) {
      setPage(prev => prev + 1)
    }
  }

  // Filter and search patients (client-side filtering)
  const filteredPatients = patients.filter(p => {
    // Apply type filter
    if (filterType === 'assigned' && !p.is_assigned_to_me) return false
    if (filterType === 'roi_missing' && p.affiliation.consent_status === 'active') return false
    if (filterType === 'active_only' && p.status !== 'active') return false
    if (filterType === 'no_future_appt' && p.next_appointment) return false

    // Apply engagement status filter (if not 'all')
    if (engagementStatusFilter && engagementStatusFilter !== 'all' && p.status !== engagementStatusFilter) {
      return false
    }

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(search) ||
        p.email?.toLowerCase().includes(search) ||
        p.phone?.includes(search)
      )
    }

    return true
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  // Transfer modal handlers
  const handleOpenTransferModal = (patient: PatientWithDetails) => {
    setSelectedPatient(patient)
    setTransferModalOpen(true)
  }

  const handleCloseTransferModal = () => {
    setTransferModalOpen(false)
    setSelectedPatient(null)
  }

  const handleTransferSuccess = async () => {
    // Refresh patient list using SWR cache invalidation
    await refreshPatientData()
  }

  // Check if user can transfer patients (admin or case_manager)
  const canTransferPatients = partnerUser &&
    ['partner_admin', 'partner_case_manager'].includes(partnerUser.role)

  // Notification modal handlers
  const handleOpenNotificationModal = (patient: PatientWithDetails) => {
    setNotifyPatient(patient)
    setNotificationModalOpen(true)
  }

  const handleCloseNotificationModal = () => {
    setNotificationModalOpen(false)
    setNotifyPatient(null)
  }

  const handleNotificationSuccess = async () => {
    // Refresh patient list using SWR cache invalidation
    await refreshPatientData()
  }

  // ROI modal handlers
  const handleOpenROIModal = (patient: PatientWithDetails) => {
    setRoiPatient(patient)
    setRoiModalOpen(true)
  }

  const handleCloseROIModal = () => {
    setRoiModalOpen(false)
    setRoiPatient(null)
  }

  const handleROISuccess = async () => {
    // Refresh patient list using SWR cache invalidation
    await refreshPatientData()
  }

  // Assign provider modal handlers
  const handleOpenAssignProviderModal = (patient: PatientWithDetails) => {
    setAssignProviderPatient(patient)
    setAssignProviderModalOpen(true)
  }

  const handleCloseAssignProviderModal = () => {
    setAssignProviderModalOpen(false)
    setAssignProviderPatient(null)
  }

  const handleAssignProviderSuccess = async () => {
    // Refresh patient list using SWR cache invalidation
    await refreshPatientData()
  }

  // Change engagement status modal handlers
  const handleOpenChangeStatusModal = (patient: PatientWithDetails) => {
    setChangeStatusPatient(patient)
    setChangeStatusModalOpen(true)
  }

  const handleCloseChangeStatusModal = () => {
    setChangeStatusModalOpen(false)
    setChangeStatusPatient(null)
  }

  const handleChangeStatusSuccess = async () => {
    // Refresh patient list using SWR cache invalidation
    await refreshPatientData()
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
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-moonlit-navy mb-2 font-['Newsreader']">
              Patient Roster
            </h1>
            <p className="text-gray-600 font-['Newsreader'] font-light">
              View and manage patients from your organization
            </p>
          </div>
          <BulkSyncButton onSyncComplete={refreshPatientData} />
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                <p className="text-sm font-medium text-gray-600 font-['Newsreader']">Active</p>
                <p className="text-2xl font-bold text-moonlit-navy mt-1">
                  {patients.filter(p => p.status === 'active').length}
                </p>
              </div>
              <Activity className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 font-['Newsreader']">No Future Appt</p>
                <p className="text-2xl font-bold text-moonlit-navy mt-1">
                  {patients.filter(p => !p.next_appointment).length}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-orange-600" />
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
              <CheckCircle className="w-8 h-8 text-blue-600" />
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

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                  filterType === 'all'
                    ? 'bg-moonlit-brown text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('active_only')}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                  filterType === 'active_only'
                    ? 'bg-moonlit-brown text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Active Only
              </button>
              <button
                onClick={() => setFilterType('no_future_appt')}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                  filterType === 'no_future_appt'
                    ? 'bg-moonlit-brown text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                No Future Appt
              </button>
              <button
                onClick={() => setFilterType('assigned')}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                  filterType === 'assigned'
                    ? 'bg-moonlit-brown text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                My Patients
              </button>
              <button
                onClick={() => setFilterType('roi_missing')}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
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
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Seen / Next Appt
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Provider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
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
                            <Link
                              href={`/partner-dashboard/patients/${patient.id}`}
                              className="text-sm font-medium text-moonlit-brown hover:text-moonlit-brown/80 hover:underline"
                            >
                              {patient.first_name} {patient.last_name}
                            </Link>
                            {patient.is_assigned_to_me && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                Assigned
                              </span>
                            )}
                            {patient.primary_insurance_payer && (
                              <div className="text-sm text-gray-500 mt-1">
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
                        {patient.primary_provider ? (
                          <button
                            onClick={() => handleOpenAssignProviderModal(patient)}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-moonlit-brown/10 text-moonlit-brown hover:bg-moonlit-brown/20 transition-colors"
                            title="Click to change provider"
                          >
                            Dr. {patient.primary_provider.last_name}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenAssignProviderModal(patient)}
                            className="text-sm text-blue-600 hover:text-blue-800 underline"
                          >
                            Assign provider
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {patient.previous_appointment ? (
                          <div className="text-sm text-gray-500">
                            {new Date(patient.previous_appointment.start_time).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">—</span>
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
                      <td className="px-6 py-4">
                        <SyncAppointmentsButton
                          patientId={patient.id}
                          patientName={`${patient.first_name} ${patient.last_name}`}
                          lastSyncAt={patient.affiliation.last_practiceq_sync_at}
                          onSyncComplete={refreshPatientData}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-3">
                          {/* ROI Upload Button - only show if no ROI on file */}
                          {!patient.affiliation.consent_on_file && (
                            <>
                              <button
                                onClick={() => handleOpenROIModal(patient)}
                                className="text-moonlit-brown hover:text-moonlit-brown/80 flex items-center space-x-1"
                                title="Upload ROI"
                              >
                                <FileText className="w-4 h-4" />
                                <span>Upload ROI</span>
                              </button>
                              {canTransferPatients && <span className="text-gray-300">|</span>}
                            </>
                          )}

                          {canTransferPatients && (
                            <>
                              {patient.current_assignment && (
                                <>
                                  <button
                                    onClick={() => handleOpenTransferModal(patient)}
                                    className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                                  >
                                    <UserCheck className="w-4 h-4" />
                                    <span>Transfer</span>
                                  </button>
                                  <span className="text-gray-300">|</span>
                                </>
                              )}
                              <button
                                onClick={() => handleOpenNotificationModal(patient)}
                                className="text-green-600 hover:text-green-800 flex items-center space-x-1"
                              >
                                <Bell className="w-4 h-4" />
                                <span>Notify</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Load More Button */}
              {hasMore && (
                <div className="p-6 text-center border-t border-gray-200">
                  <button
                    onClick={loadMorePatients}
                    disabled={loading}
                    className="px-6 py-2 bg-moonlit-brown text-white rounded-lg hover:bg-moonlit-brown/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Loading...' : `Load More (${totalCount - patients.length} remaining)`}
                  </button>
                  <p className="mt-2 text-sm text-gray-600">
                    Showing {patients.length} of {totalCount} patients
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Transfer Patient Modal */}
      {selectedPatient && (
        <TransferPatientModal
          patient={selectedPatient}
          isOpen={transferModalOpen}
          onClose={handleCloseTransferModal}
          onSuccess={handleTransferSuccess}
        />
      )}

      {/* Send Notification Modal */}
      {notifyPatient && (
        <SendNotificationModal
          patient={notifyPatient}
          appointments={notifyPatient.next_appointment ? [notifyPatient.next_appointment] : []}
          isOpen={notificationModalOpen}
          onClose={handleCloseNotificationModal}
          onSuccess={handleNotificationSuccess}
        />
      )}

      {/* Upload ROI Modal */}
      {roiPatient && partnerUser && (
        <UploadROIModal
          patient={roiPatient}
          organizationId={partnerUser.organization_id}
          isOpen={roiModalOpen}
          onClose={handleCloseROIModal}
          onSuccess={handleROISuccess}
        />
      )}

      {/* Assign Provider Modal */}
      {assignProviderPatient && (
        <AssignProviderModal
          patient={assignProviderPatient}
          isOpen={assignProviderModalOpen}
          onClose={handleCloseAssignProviderModal}
          onSuccess={handleAssignProviderSuccess}
        />
      )}
    </div>
  )
}
