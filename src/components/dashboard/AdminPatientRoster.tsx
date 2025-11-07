/**
 * Admin Patient Roster Component
 *
 * Shows ALL patients with:
 * - Engagement status
 * - Last seen / Next appointment
 * - Provider assignment
 * - Organization affiliation (filterable/sortable)
 * - Case manager assignment
 * - Ability to change engagement status
 */

'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Users, Calendar, Activity, Building2, UserCheck, Download, RotateCcw, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { EngagementStatusChip } from '@/components/partner-dashboard/EngagementStatusChip'
import { AppointmentStatusIndicator } from '@/components/partner-dashboard/AppointmentStatusIndicator'
import { ChangeEngagementStatusModal } from '@/components/partner-dashboard/ChangeEngagementStatusModal'
import SyncAppointmentsButton from '@/components/dashboard/SyncAppointmentsButton'
import AdminBulkSyncButton from '@/components/dashboard/AdminBulkSyncButton'
import Link from 'next/link'
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
  primary_provider_id?: string | null
  provider_first_name?: string | null
  provider_last_name?: string | null
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

type SortColumn = 'name' | 'status' | 'previous' | 'next' | 'provider' | 'payer' | 'organization' | 'caseManager'
type SortDirection = 'asc' | 'desc' | null

export default function AdminPatientRoster() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [appointmentFilter, setAppointmentFilter] = useState<string>('all')
  const [orgFilter, setOrgFilter] = useState<string>('all')
  const [providerFilter, setProviderFilter] = useState<string>('all')
  const [payerFilter, setPayerFilter] = useState<string>('all')
  const [showTestPatients, setShowTestPatients] = useState(false)
  const [sortBy, setSortBy] = useState<string>('patient_name')
  const [page, setPage] = useState(1)
  const limit = 50

  // Client-side column sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  // Build API URL with filters
  const buildApiUrl = () => {
    const params = new URLSearchParams()
    if (searchTerm) params.append('search', searchTerm)
    if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)
    if (appointmentFilter === 'no_future') params.append('has_future_appointment', 'false')
    if (appointmentFilter === 'has_future') params.append('has_future_appointment', 'true')
    if (orgFilter && orgFilter !== 'all') params.append('organization_id', orgFilter)
    if (!showTestPatients) params.append('exclude_test_patients', 'true')
    params.append('sort_by', sortBy)
    params.append('limit', limit.toString())
    params.append('offset', ((page - 1) * limit).toString())

    return `/api/patients/activity-summary?${params.toString()}`
  }

  const { data, error, mutate } = useSWR(buildApiUrl(), fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000
  })

  const patients = data?.patients || []
  const totalCount = data?.pagination?.total || 0
  const loading = !data && !error

  // Resizable columns
  const { columnWidths, handleMouseDown, resetWidths } = useResizableColumns('admin-patient-roster', {
    patient: 200,
    status: 120,
    previous: 160,
    next: 180,
    provider: 150,
    payer: 150,
    organization: 150,
    caseManager: 150,
    practiceq: 140,
    actions: 160
  })

  // CSV Export function
  const handleExportCSV = () => {
    const csvData = sortedPatients.map(patient => ({
      name: `${patient.first_name} ${patient.last_name}`,
      email: patient.email || '',
      phone: patient.phone || '',
      status: patient.engagement_status,
      previousAppointment: patient.last_seen_date ? formatDateForCSV(patient.last_seen_date) : '',
      previousAppointmentRelative: patient.last_seen_date ? formatRelativeTime(patient.last_seen_date, false) : '',
      previousAppointmentStatus: patient.last_appointment_status || '',
      nextAppointment: patient.next_appointment_date ? formatDateForCSV(patient.next_appointment_date) : '',
      nextAppointmentRelative: patient.next_appointment_date ? formatRelativeTime(patient.next_appointment_date, true) : '',
      provider: patient.provider_last_name ? `Dr. ${patient.provider_last_name}` : '',
      payer: patient.payer_name || '',
      organizations: patient.affiliation_details?.map(a => a.org_name).join('; ') || '',
      caseManager: patient.case_manager_name || ''
    }))

    const columnMapping = {
      name: 'Patient Name',
      email: 'Email',
      phone: 'Phone',
      status: 'Engagement Status',
      previousAppointment: 'Previous Appointment',
      previousAppointmentRelative: 'Days Since',
      previousAppointmentStatus: 'Previous Appt Status',
      nextAppointment: 'Next Appointment',
      nextAppointmentRelative: 'Days Until',
      provider: 'Provider',
      payer: 'Payer',
      organizations: 'Organizations',
      caseManager: 'Case Manager'
    }

    const timestamp = new Date().toISOString().split('T')[0]
    exportToCSV(csvData, `admin-patients-${timestamp}.csv`, columnMapping)
  }

  // Change engagement status modal
  const [changeStatusModalOpen, setChangeStatusModalOpen] = useState(false)
  const [changeStatusPatient, setChangeStatusPatient] = useState<Patient | null>(null)
  const [userEmail, setUserEmail] = useState('admin@trymoonlit.com')

  // PracticeQ discovery
  const [discoveryModalOpen, setDiscoveryModalOpen] = useState(false)
  const [discoveryInProgress, setDiscoveryInProgress] = useState(false)
  const [discoveryResults, setDiscoveryResults] = useState<any>(null)

  const handleOpenChangeStatusModal = (patient: Patient) => {
    setChangeStatusPatient(patient)
    setChangeStatusModalOpen(true)
  }

  const handleChangeStatusSuccess = async () => {
    console.log('🔄 Refreshing patient list after status change...')
    await mutate()
    console.log('✅ Patient list refreshed')
  }

  const handleDiscoverPatients = async () => {
    setDiscoveryInProgress(true)
    setDiscoveryResults(null)

    try {
      const response = await fetch('/api/admin/patients/discover-from-practiceq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syncAppointments: true
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Discovery failed')
      }

      setDiscoveryResults(data)
      console.log('✅ Discovery complete:', data)

      // Refresh patient list to show new patients
      await mutate()
    } catch (error: any) {
      console.error('❌ Discovery failed:', error)
      setDiscoveryResults({
        success: false,
        error: error.message
      })
    } finally {
      setDiscoveryInProgress(false)
    }
  }

  // Get unique organizations for filter
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

  // Get unique payers for filter
  const uniquePayers = patients.reduce((acc: any[], p: Patient) => {
    if (p.payer_name && p.primary_payer_id && !acc.find(payer => payer.id === p.primary_payer_id)) {
      acc.push({ id: p.primary_payer_id, name: p.payer_name })
    }
    return acc
  }, [])

  // Get unique providers for filter
  const uniqueProviders = patients.reduce((acc: any[], p: Patient) => {
    if (p.primary_provider_id && p.provider_last_name && !acc.find(prov => prov.id === p.primary_provider_id)) {
      acc.push({
        id: p.primary_provider_id,
        name: `Dr. ${p.provider_last_name}`,
        lastName: p.provider_last_name
      })
    }
    return acc
  }, []).sort((a, b) => a.lastName.localeCompare(b.lastName))

  // Handle column sort
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Cycle through: asc -> desc -> null (unsorted)
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortDirection(null)
        setSortColumn(null)
      }
    } else {
      // New column, start with ascending
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Get sort icon for column header
  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="w-4 h-4 text-moonlit-brown" />
    }
    return <ArrowDown className="w-4 h-4 text-moonlit-brown" />
  }

  // Apply client-side filters (search is handled server-side now)
  const filteredPatients = patients.filter((p: Patient) => {
    // Provider filter
    if (providerFilter && providerFilter !== 'all' && p.primary_provider_id !== providerFilter) {
      return false
    }

    // Payer filter
    if (payerFilter && payerFilter !== 'all' && p.primary_payer_id !== payerFilter) {
      return false
    }

    return true
  })

  // Sort patients after filtering
  const sortedPatients = [...filteredPatients].sort((a, b) => {
    if (!sortColumn || !sortDirection) return 0

    let aValue: any
    let bValue: any

    switch (sortColumn) {
      case 'name':
        aValue = `${a.first_name} ${a.last_name}`.toLowerCase()
        bValue = `${b.first_name} ${b.last_name}`.toLowerCase()
        break
      case 'status':
        aValue = a.engagement_status
        bValue = b.engagement_status
        break
      case 'previous':
        aValue = a.last_seen_date ? new Date(a.last_seen_date).getTime() : 0
        bValue = b.last_seen_date ? new Date(b.last_seen_date).getTime() : 0
        break
      case 'next':
        aValue = a.next_appointment_date ? new Date(a.next_appointment_date).getTime() : Number.MAX_SAFE_INTEGER
        bValue = b.next_appointment_date ? new Date(b.next_appointment_date).getTime() : Number.MAX_SAFE_INTEGER
        break
      case 'provider':
        aValue = a.provider_last_name ? `${a.provider_first_name} ${a.provider_last_name}`.toLowerCase() : ''
        bValue = b.provider_last_name ? `${b.provider_first_name} ${b.provider_last_name}`.toLowerCase() : ''
        break
      case 'payer':
        aValue = (a.payer_name || '').toLowerCase()
        bValue = (b.payer_name || '').toLowerCase()
        break
      case 'organization':
        aValue = a.affiliation_details && a.affiliation_details.length > 0
          ? a.affiliation_details[0].org_name.toLowerCase()
          : ''
        bValue = b.affiliation_details && b.affiliation_details.length > 0
          ? b.affiliation_details[0].org_name.toLowerCase()
          : ''
        break
      case 'caseManager':
        aValue = (a.case_manager_name || '').toLowerCase()
        bValue = (b.case_manager_name || '').toLowerCase()
        break
      default:
        return 0
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

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
              All Patients
            </h1>
            <p className="text-gray-600 font-['Newsreader'] font-light">
              View and manage all patients across the platform
            </p>
          </div>
          <div className="flex items-center gap-3">
            <AdminBulkSyncButton onSyncComplete={handleChangeStatusSuccess} />
            <button
              onClick={() => setDiscoveryModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-moonlit-brown rounded-md shadow-sm text-sm font-medium text-moonlit-brown bg-white hover:bg-moonlit-cream focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moonlit-brown"
              title="Discover new patients from PracticeQ"
            >
              <Search className="w-4 h-4 mr-2" />
              Discover from PracticeQ
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moonlit-brown"
              title="Export current view to CSV"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
            <button
              onClick={resetWidths}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moonlit-brown"
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
                <p className="text-sm font-medium text-gray-600">Total Patients</p>
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
                <p className="text-sm font-medium text-gray-600">With Organizations</p>
                <p className="text-2xl font-bold text-moonlit-navy mt-1">
                  {patients.filter((p: Patient) => p.shared_with_org_ids.length > 0).length}
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
                <option value="unresponsive">Unresponsive</option>
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

              {/* Provider Filter */}
              {uniqueProviders.length > 0 && (
                <select
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-moonlit-brown"
                >
                  <option value="all">All Providers</option>
                  {uniqueProviders.map((provider: any) => (
                    <option key={provider.id} value={provider.id}>{provider.name}</option>
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

              {/* Test Patient Toggle */}
              <label className="flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={showTestPatients}
                  onChange={(e) => setShowTestPatients(e.target.checked)}
                  className="mr-2 h-4 w-4 text-moonlit-brown focus:ring-moonlit-brown border-gray-300 rounded"
                />
                <span className="text-gray-700">Show test patients</span>
              </label>

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
          ) : sortedPatients.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No patients found</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[calc(100vh-400px)] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th style={{ width: columnWidths.patient }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('name')}
                        className="flex items-center gap-2 hover:text-moonlit-brown transition-colors"
                      >
                        Patient
                        {getSortIcon('name')}
                      </button>
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown" onMouseDown={(e) => handleMouseDown('patient', e)} />
                    </th>
                    <th style={{ width: columnWidths.status }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('status')}
                        className="flex items-center gap-2 hover:text-moonlit-brown transition-colors"
                      >
                        Status
                        {getSortIcon('status')}
                      </button>
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown" onMouseDown={(e) => handleMouseDown('status', e)} />
                    </th>
                    <th style={{ width: columnWidths.previous }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('previous')}
                        className="flex items-center gap-2 hover:text-moonlit-brown transition-colors"
                      >
                        Previous Appointment
                        {getSortIcon('previous')}
                      </button>
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown" onMouseDown={(e) => handleMouseDown('previous', e)} />
                    </th>
                    <th style={{ width: columnWidths.next }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('next')}
                        className="flex items-center gap-2 hover:text-moonlit-brown transition-colors"
                      >
                        Next Appointment
                        {getSortIcon('next')}
                      </button>
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown" onMouseDown={(e) => handleMouseDown('next', e)} />
                    </th>
                    <th style={{ width: columnWidths.provider }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('provider')}
                        className="flex items-center gap-2 hover:text-moonlit-brown transition-colors"
                      >
                        Provider
                        {getSortIcon('provider')}
                      </button>
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown" onMouseDown={(e) => handleMouseDown('provider', e)} />
                    </th>
                    <th style={{ width: columnWidths.payer }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('payer')}
                        className="flex items-center gap-2 hover:text-moonlit-brown transition-colors"
                      >
                        Payer
                        {getSortIcon('payer')}
                      </button>
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown" onMouseDown={(e) => handleMouseDown('payer', e)} />
                    </th>
                    <th style={{ width: columnWidths.organization }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('organization')}
                        className="flex items-center gap-2 hover:text-moonlit-brown transition-colors"
                      >
                        Organization
                        {getSortIcon('organization')}
                      </button>
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown" onMouseDown={(e) => handleMouseDown('organization', e)} />
                    </th>
                    <th style={{ width: columnWidths.caseManager }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('caseManager')}
                        className="flex items-center gap-2 hover:text-moonlit-brown transition-colors"
                      >
                        Case Manager
                        {getSortIcon('caseManager')}
                      </button>
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown" onMouseDown={(e) => handleMouseDown('caseManager', e)} />
                    </th>
                    <th style={{ width: columnWidths.practiceq }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      PracticeQ Sync
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown" onMouseDown={(e) => handleMouseDown('practiceq', e)} />
                    </th>
                    <th style={{ width: columnWidths.actions }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown" onMouseDown={(e) => handleMouseDown('actions', e)} />
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedPatients.map((patient: Patient) => (
                    <tr key={patient.patient_id} className="hover:bg-gray-50">
                      <td style={{ width: columnWidths.patient }} className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-moonlit-navy">
                            {patient.first_name} {patient.last_name}
                          </div>
                          <div className="text-sm text-gray-500">{patient.email}</div>
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
                      <td style={{ width: columnWidths.provider }} className="px-6 py-4 whitespace-nowrap">
                        {patient.provider_first_name && patient.provider_last_name ? (
                          <div className="text-sm">
                            Dr. {patient.provider_last_name}
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
                      <td style={{ width: columnWidths.practiceq }} className="px-6 py-4">
                        <SyncAppointmentsButton
                          patientId={patient.patient_id}
                          patientName={`${patient.first_name} ${patient.last_name}`}
                          lastSyncAt={patient.last_intakeq_sync}
                          onSyncComplete={handleChangeStatusSuccess}
                          userType="admin"
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
                  {sortedPatients.length === 1
                    ? 'Showing 1 patient matching filters'
                    : `Showing all ${sortedPatients.length} patients matching filters`
                  }
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
          userType="admin"
        />
      )}

      {/* PracticeQ Discovery Modal */}
      {discoveryModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-moonlit-navy mb-4 font-['Newsreader']">
              Discover New Patients from PracticeQ
            </h2>

            {!discoveryInProgress && !discoveryResults && (
              <>
                <p className="text-gray-700 mb-6">
                  This will scan all patients in PracticeQ (IntakeQ) and import any that don't exist in your database yet.
                </p>
                <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
                  <li>Searches appointments from the last 90 days to 90 days in the future</li>
                  <li>Creates patient records for any new patients found</li>
                  <li>Automatically syncs their appointment history</li>
                  <li>Does not modify existing patient records</li>
                </ul>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setDiscoveryModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDiscoverPatients()}
                    className="px-4 py-2 bg-moonlit-brown text-white rounded-md hover:bg-moonlit-brown/90"
                  >
                    Start Discovery
                  </button>
                </div>
              </>
            )}

            {discoveryInProgress && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-moonlit-brown mx-auto mb-4"></div>
                <p className="text-gray-700 text-lg">Scanning PracticeQ for new patients...</p>
                <p className="text-gray-500 text-sm mt-2">This may take up to 30 seconds</p>
              </div>
            )}

            {discoveryResults && (
              <>
                {discoveryResults.success ? (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-green-800 font-medium">
                        ✅ Discovery Complete!
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">PracticeQ Clients Found</p>
                        <p className="text-2xl font-bold text-moonlit-navy">{discoveryResults.stats.intakeq_clients}</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Already in Database</p>
                        <p className="text-2xl font-bold text-blue-700">{discoveryResults.stats.existing_patients}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">New Patients Created</p>
                        <p className="text-2xl font-bold text-green-700">{discoveryResults.stats.new_patients_created}</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Appointments Synced</p>
                        <p className="text-2xl font-bold text-purple-700">{discoveryResults.stats.patients_synced}</p>
                      </div>
                    </div>

                    {discoveryResults.created_patients && discoveryResults.created_patients.length > 0 && (
                      <div className="mt-4">
                        <h3 className="font-medium text-moonlit-navy mb-2">New Patients Added:</h3>
                        <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                          <ul className="space-y-2">
                            {discoveryResults.created_patients.map((patient: any, idx: number) => (
                              <li key={idx} className="text-sm">
                                <span className="font-medium">{patient.name}</span>
                                <span className="text-gray-600"> ({patient.email})</span>
                                {patient.syncResult && (
                                  <span className="text-gray-500 text-xs ml-2">
                                    • {patient.syncResult.new} new appt{patient.syncResult.new !== 1 ? 's' : ''}
                                    {patient.syncResult.updated > 0 && `, ${patient.syncResult.updated} updated`}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {discoveryResults.stats.errors && discoveryResults.stats.errors.length > 0 && (
                      <div className="mt-4">
                        <h3 className="font-medium text-red-800 mb-2">Errors:</h3>
                        <div className="bg-red-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                          <ul className="space-y-2">
                            {discoveryResults.stats.errors.map((err: any, idx: number) => (
                              <li key={idx} className="text-sm text-red-700">
                                <span className="font-medium">{err.email}</span>: {err.error}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          setDiscoveryModalOpen(false)
                          setDiscoveryResults(null)
                        }}
                        className="px-4 py-2 bg-moonlit-brown text-white rounded-md hover:bg-moonlit-brown/90"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-800 font-medium">❌ Discovery Failed</p>
                      <p className="text-red-700 text-sm mt-2">{discoveryResults.error}</p>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          setDiscoveryModalOpen(false)
                          setDiscoveryResults(null)
                        }}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
