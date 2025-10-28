/**
 * Provider Patient Roster Component
 *
 * Shows ONLY patients assigned to this provider with:
 * - Engagement status
 * - Last seen / Next appointment
 * - Organization affiliation (filterable/sortable)
 * - Case manager assignment (filterable/sortable)
 */

'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Users, Calendar, Activity, Building2, Download, RotateCcw } from 'lucide-react'
import { EngagementStatusChip } from '@/components/partner-dashboard/EngagementStatusChip'
import { AppointmentStatusIndicator } from '@/components/partner-dashboard/AppointmentStatusIndicator'
import { ChangeEngagementStatusModal } from '@/components/partner-dashboard/ChangeEngagementStatusModal'
import SyncAppointmentsButton from '@/components/dashboard/SyncAppointmentsButton'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { exportToCSV, formatDateForCSV, formatRelativeTime } from '@/utils/csvExport'

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface Patient {
  patient_id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  engagement_status: string
  last_seen_date?: string | null
  last_appointment_status?: string | null
  next_appointment_date?: string | null
  has_future_appointment: boolean
  shared_with_org_ids: string[]
  affiliation_details?: Array<{
    org_id: string
    org_name: string
    affiliation_type: string
  }> | null
  primary_case_manager_id?: string | null
  case_manager_name?: string | null
  last_intakeq_sync?: string | null
  primary_payer_id?: string | null
  payer_name?: string | null
  payer_type?: string | null
  payer_state?: string | null
}

interface ProviderPatientRosterProps {
  providerId: string | null
}

export default function ProviderPatientRoster({ providerId }: ProviderPatientRosterProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [appointmentFilter, setAppointmentFilter] = useState<string>('all')
  const [orgFilter, setOrgFilter] = useState<string>('all')
  const [caseManagerFilter, setCaseManagerFilter] = useState<string>('all')
  const [payerFilter, setPayerFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('patient_name')
  const [page, setPage] = useState(1)
  const limit = 50

  // Change engagement status modal
  const [changeStatusModalOpen, setChangeStatusModalOpen] = useState(false)
  const [changeStatusPatient, setChangeStatusPatient] = useState<Patient | null>(null)
  const [userEmail, setUserEmail] = useState('provider@trymoonlit.com')

  // Resizable columns
  const { columnWidths, handleMouseDown, resetWidths } = useResizableColumns('provider-patient-roster', {
    patient: 200,
    status: 120,
    previous: 160,
    next: 180,
    payer: 150,
    organization: 150,
    caseManager: 150,
    contact: 200,
    practiceq: 140,
    actions: 160
  })

  // CSV Export
  const handleExportCSV = () => {
    const csvData = filteredPatients.map((patient: Patient) => ({
      name: `${patient.first_name} ${patient.last_name}`,
      email: patient.email || '',
      phone: patient.phone || '',
      status: patient.engagement_status,
      previousAppointment: patient.last_seen_date
        ? formatDateForCSV(patient.last_seen_date)
        : '',
      previousAppointmentStatus: patient.last_appointment_status || '',
      nextAppointment: patient.next_appointment_date
        ? formatDateForCSV(patient.next_appointment_date)
        : '',
      payer: patient.payer_name || '',
      organization: patient.affiliation_details?.map(a => a.org_name).join('; ') || '',
      caseManager: patient.case_manager_name || '',
      lastSync: patient.last_intakeq_sync
        ? formatDateForCSV(patient.last_intakeq_sync)
        : ''
    }))

    const columnMapping = {
      name: 'Patient Name',
      email: 'Email',
      phone: 'Phone',
      status: 'Status',
      previousAppointment: 'Previous Appointment',
      previousAppointmentStatus: 'Previous Appt Status',
      nextAppointment: 'Next Appointment',
      payer: 'Payer',
      organization: 'Organization',
      caseManager: 'Case Manager',
      lastSync: 'Last PracticeQ Sync'
    }

    const timestamp = new Date().toISOString().split('T')[0]
    exportToCSV(csvData, `provider-patients-${timestamp}.csv`, columnMapping)
  }

  // Build API URL with filters
  const buildApiUrl = () => {
    if (!providerId) return null

    const params = new URLSearchParams()
    params.append('provider_id', providerId)
    if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)
    if (appointmentFilter === 'no_future') params.append('has_future_appointment', 'false')
    if (appointmentFilter === 'has_future') params.append('has_future_appointment', 'true')
    if (orgFilter && orgFilter !== 'all') params.append('organization_id', orgFilter)
    params.append('exclude_test_patients', 'true') // Always exclude test patients from provider view
    params.append('sort_by', sortBy)
    params.append('limit', limit.toString())
    params.append('offset', ((page - 1) * limit).toString())

    return `/api/patients/activity-summary?${params.toString()}`
  }

  const apiUrl = buildApiUrl()

  // Debug logging
  console.log('ProviderPatientRoster - providerId:', providerId)
  console.log('ProviderPatientRoster - apiUrl:', apiUrl)

  const { data, error, mutate } = useSWR(apiUrl, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000
  })

  console.log('ProviderPatientRoster - data:', data)
  console.log('ProviderPatientRoster - error:', error)

  const patients = data?.patients || []
  const totalCount = data?.pagination?.total || 0
  const loading = !data && !error && apiUrl !== null

  // Change status handlers
  const handleOpenChangeStatusModal = (patient: Patient) => {
    setChangeStatusPatient(patient)
    setChangeStatusModalOpen(true)
  }

  const handleChangeStatusSuccess = async () => {
    await mutate()
  }

  // Get unique organizations and case managers for filters
  const uniqueOrgs = patients.reduce((acc: any[], p: Patient) => {
    if (p.affiliation_details) {
      p.affiliation_details.forEach(aff => {
        if (!acc.find(o => o.org_id === aff.org_id)) {
          acc.push({ org_id: aff.org_id, org_name: aff.org_name })
        }
      })
    }
    return acc
  }, [])

  const uniqueCaseManagers = patients.reduce((acc: any[], p: Patient) => {
    if (p.case_manager_name && !acc.find(cm => cm.id === p.primary_case_manager_id)) {
      acc.push({ id: p.primary_case_manager_id, name: p.case_manager_name })
    }
    return acc
  }, [])

  const uniquePayers = patients.reduce((acc: any[], p: Patient) => {
    if (p.payer_name && p.primary_payer_id && !acc.find(payer => payer.id === p.primary_payer_id)) {
      acc.push({ id: p.primary_payer_id, name: p.payer_name })
    }
    return acc
  }, [])

  // Apply client-side search and filters
  const filteredPatients = patients.filter((p: Patient) => {
    // Case manager filter
    if (caseManagerFilter && caseManagerFilter !== 'all' && p.primary_case_manager_id !== caseManagerFilter) {
      return false
    }

    // Payer filter
    if (payerFilter && payerFilter !== 'all' && p.primary_payer_id !== payerFilter) {
      return false
    }

    // Search filter
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

  if (!providerId) {
    return (
      <div className="min-h-screen bg-moonlit-cream p-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-yellow-800">No provider ID found. Please contact support.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-moonlit-cream p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">Error loading patients: {error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-moonlit-cream">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-moonlit-navy mb-2 font-['Newsreader']">
              My Patients
            </h1>
            <p className="text-gray-600 font-['Newsreader'] font-light">
              View and manage your assigned patients
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              title="Export current view to CSV"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
            <button
              onClick={resetWidths}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              title="Reset column widths"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">My Patients</p>
                <p className="text-2xl font-bold text-moonlit-navy mt-1">{totalCount}</p>
              </div>
              <Users className="w-8 h-8 text-moonlit-brown" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-moonlit-navy mt-1">
                  {patients.filter((p: Patient) => p.engagement_status === 'active').length}
                </p>
              </div>
              <Activity className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">No Future Appt</p>
                <p className="text-2xl font-bold text-moonlit-navy mt-1">
                  {patients.filter((p: Patient) => !p.has_future_appointment).length}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-orange-600" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">With Case Mgmt</p>
                <p className="text-2xl font-bold text-moonlit-navy mt-1">
                  {patients.filter((p: Patient) => p.primary_case_manager_id).length}
                </p>
              </div>
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-moonlit-brown focus:border-transparent"
              />
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap gap-2">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-moonlit-brown"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="discharged">Discharged</option>
                <option value="transferred">Transferred</option>
                <option value="inactive">Inactive</option>
              </select>

              {/* Appointment Filter */}
              <select
                value={appointmentFilter}
                onChange={(e) => setAppointmentFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-moonlit-brown"
              >
                <option value="all">All Appointments</option>
                <option value="has_future">Has Future Appt</option>
                <option value="no_future">No Future Appt</option>
              </select>

              {/* Organization Filter */}
              {uniqueOrgs.length > 0 && (
                <select
                  value={orgFilter}
                  onChange={(e) => setOrgFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-moonlit-brown"
                >
                  <option value="all">All Organizations</option>
                  {uniqueOrgs.map((org: any) => (
                    <option key={org.org_id} value={org.org_id}>{org.org_name}</option>
                  ))}
                </select>
              )}

              {/* Case Manager Filter */}
              {uniqueCaseManagers.length > 0 && (
                <select
                  value={caseManagerFilter}
                  onChange={(e) => setCaseManagerFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-moonlit-brown"
                >
                  <option value="all">All Case Managers</option>
                  {uniqueCaseManagers.map((cm: any) => (
                    <option key={cm.id} value={cm.id}>{cm.name}</option>
                  ))}
                </select>
              )}

              {/* Payer Filter */}
              {uniquePayers.length > 0 && (
                <select
                  value={payerFilter}
                  onChange={(e) => setPayerFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-moonlit-brown"
                >
                  <option value="all">All Payers</option>
                  {uniquePayers.map((payer: any) => (
                    <option key={payer.id} value={payer.id}>{payer.name}</option>
                  ))}
                </select>
              )}

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-moonlit-brown"
              >
                <option value="patient_name">Sort: Patient Name</option>
                <option value="last_seen">Sort: Last Seen</option>
                <option value="next_appointment">Sort: Next Appointment</option>
              </select>
            </div>
          </div>
        </div>

        {/* Patient Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-moonlit-brown mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading patients...</p>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No patients found</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[calc(100vh-350px)] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th style={{ width: columnWidths.patient }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Patient
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown"
                        onMouseDown={(e) => handleMouseDown('patient', e)}
                      />
                    </th>
                    <th style={{ width: columnWidths.status }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown"
                        onMouseDown={(e) => handleMouseDown('status', e)}
                      />
                    </th>
                    <th style={{ width: columnWidths.previous }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Previous Appointment
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown"
                        onMouseDown={(e) => handleMouseDown('previous', e)}
                      />
                    </th>
                    <th style={{ width: columnWidths.next }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Next Appointment
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown"
                        onMouseDown={(e) => handleMouseDown('next', e)}
                      />
                    </th>
                    <th style={{ width: columnWidths.payer }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Payer
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown"
                        onMouseDown={(e) => handleMouseDown('payer', e)}
                      />
                    </th>
                    <th style={{ width: columnWidths.organization }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Organization
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown"
                        onMouseDown={(e) => handleMouseDown('organization', e)}
                      />
                    </th>
                    <th style={{ width: columnWidths.caseManager }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Case Manager
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown"
                        onMouseDown={(e) => handleMouseDown('caseManager', e)}
                      />
                    </th>
                    <th style={{ width: columnWidths.contact }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Contact
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown"
                        onMouseDown={(e) => handleMouseDown('contact', e)}
                      />
                    </th>
                    <th style={{ width: columnWidths.practiceq }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      PracticeQ Sync
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown"
                        onMouseDown={(e) => handleMouseDown('practiceq', e)}
                      />
                    </th>
                    <th style={{ width: columnWidths.actions }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown"
                        onMouseDown={(e) => handleMouseDown('actions', e)}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPatients.map((patient: Patient) => (
                    <tr key={patient.patient_id} className="hover:bg-gray-50">
                      <td style={{ width: columnWidths.patient }} className="px-6 py-4">
                        <div className="text-sm font-medium text-moonlit-navy">
                          {patient.first_name} {patient.last_name}
                        </div>
                      </td>
                      <td style={{ width: columnWidths.status }} className="px-6 py-4">
                        <EngagementStatusChip status={patient.engagement_status as any} />
                      </td>
                      <td style={{ width: columnWidths.previous }} className="px-6 py-4">
                        {patient.last_seen_date ? (
                          <div className="flex flex-col space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-900">
                                {new Date(patient.last_seen_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                              {patient.last_appointment_status === 'no_show' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                  No-show
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">
                              {(() => {
                                const diffMs = new Date().getTime() - new Date(patient.last_seen_date).getTime()
                                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
                                return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
                              })()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td style={{ width: columnWidths.next }} className="px-6 py-4">
                        {patient.has_future_appointment && patient.next_appointment_date ? (
                          <div className="flex flex-col space-y-0.5">
                            <span className="text-sm text-gray-900">
                              {new Date(patient.next_appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="text-xs text-gray-500">
                              {(() => {
                                const diffMs = new Date(patient.next_appointment_date).getTime() - new Date().getTime()
                                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
                                if (diffDays === 0) return 'Today'
                                if (diffDays === 1) return 'Tomorrow'
                                return `in ${diffDays} days`
                              })()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td style={{ width: columnWidths.payer }} className="px-6 py-4 whitespace-nowrap">
                        {patient.payer_name ? (
                          <div className="text-sm text-gray-900">{patient.payer_name}</div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td style={{ width: columnWidths.organization }} className="px-6 py-4">
                        {patient.affiliation_details && patient.affiliation_details.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {patient.affiliation_details.map((aff, idx) => (
                              <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                                {aff.org_name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td style={{ width: columnWidths.caseManager }} className="px-6 py-4 whitespace-nowrap">
                        {patient.case_manager_name ? (
                          <div className="text-sm text-gray-900">{patient.case_manager_name}</div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td style={{ width: columnWidths.contact }} className="px-6 py-4">
                        <div className="text-sm text-gray-900">{patient.email || '—'}</div>
                        <div className="text-sm text-gray-500">{patient.phone || '—'}</div>
                      </td>
                      <td style={{ width: columnWidths.practiceq }} className="px-6 py-4">
                        <SyncAppointmentsButton
                          patientId={patient.patient_id}
                          patientName={`${patient.first_name} ${patient.last_name}`}
                          lastSyncAt={patient.last_intakeq_sync}
                          onSyncComplete={handleChangeStatusSuccess}
                          userType="provider"
                        />
                      </td>
                      <td style={{ width: columnWidths.actions }} className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenChangeStatusModal(patient)}
                          className="text-moonlit-brown hover:text-moonlit-brown/80 text-sm font-medium"
                        >
                          Change Status
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Info */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-600">
                  Showing {filteredPatients.length} of {totalCount} patients
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Change Engagement Status Modal */}
      {changeStatusPatient && (
        <ChangeEngagementStatusModal
          patient={{
            id: changeStatusPatient.patient_id,
            first_name: changeStatusPatient.first_name,
            last_name: changeStatusPatient.last_name
          }}
          currentStatus={changeStatusPatient.engagement_status}
          isOpen={changeStatusModalOpen}
          onClose={() => setChangeStatusModalOpen(false)}
          onSuccess={handleChangeStatusSuccess}
          userEmail={userEmail}
          userType="provider"
        />
      )}
    </div>
  )
}
