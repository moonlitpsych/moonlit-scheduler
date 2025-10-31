/**
 * Partner Dashboard - Patient Roster Page
 * View all assigned patients with ROI status and upcoming appointments
 */

'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { TransferPatientModal } from '@/components/partner-dashboard/TransferPatientModal'
import { SendNotificationModal } from '@/components/partner-dashboard/SendNotificationModal'
import { UploadROIModal } from '@/components/partner-dashboard/UploadROIModal'
import { AssignProviderModal } from '@/components/partner-dashboard/AssignProviderModal'
import { EngagementStatusChip } from '@/components/partner-dashboard/EngagementStatusChip'
import { AppointmentStatusIndicator } from '@/components/partner-dashboard/AppointmentStatusIndicator'
import { ChangeEngagementStatusModal } from '@/components/partner-dashboard/ChangeEngagementStatusModal'
import SyncAppointmentsButton from '@/components/partner-dashboard/SyncAppointmentsButton'
import BulkSyncButton from '@/components/partner-dashboard/BulkSyncButton'
import AppointmentLocationDisplay from '@/components/partner-dashboard/AppointmentLocationDisplay'
import { partnerImpersonationManager } from '@/lib/partner-impersonation'
import { PartnerUser } from '@/types/partner-types'
import { Database } from '@/types/database'
import { Users, Calendar, CheckCircle, AlertCircle, UserCheck, Bell, FileText, Activity, Download, RotateCcw, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import Link from 'next/link'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { exportToCSV, formatDateForCSV, formatRelativeTime } from '@/utils/csvExport'

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
  engagement_status: string
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
    meeting_url?: string | null
    location_info?: any
    providers?: {
      first_name: string
      last_name: string
    }
  } | null
  upcoming_appointment_count: number
}

type SortColumn = 'name' | 'status' | 'previous' | 'next' | 'provider' | 'contact'
type SortDirection = 'asc' | 'desc' | null

export default function PatientRosterPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'assigned' | 'roi_missing' | 'active_only' | 'no_future_appt'>('all')
  const [engagementStatusFilter, setEngagementStatusFilter] = useState<string>('active')

  // Sort state
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  // Pagination state
  const [page, setPage] = useState(1)
  const [allPatients, setAllPatients] = useState<PatientWithDetails[]>([])

  // Check for admin impersonation
  const impersonation = partnerImpersonationManager.getImpersonatedPartner()
  const impersonatedPartnerId = impersonation?.partner.id

  // Use SWR for data fetching with caching
  // Skip fetching partner/me if admin is impersonating (we already have the data)
  const { data: partnerData, error: partnerError } = useSWR(
    impersonation ? null : '/api/partner/me',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 minutes
    }
  )

  // Build patients API URL with impersonation support
  const patientsUrl = impersonatedPartnerId
    ? `/api/partner-dashboard/patients?page=${page}&limit=20&partner_user_id=${impersonatedPartnerId}`
    : `/api/partner-dashboard/patients?page=${page}&limit=20`

  const { data: patientsData, error: patientsError, mutate } = useSWR(
    patientsUrl,
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

  // Use impersonated partner data if admin is viewing, otherwise use fetched data
  const partnerUser = impersonation
    ? {
        id: impersonation.partner.id,
        auth_user_id: impersonation.partner.auth_user_id,
        organization_id: impersonation.partner.organization_id,
        full_name: impersonation.partner.full_name,
        email: impersonation.partner.email,
        phone: impersonation.partner.phone,
        role: impersonation.partner.role,
        status: impersonation.partner.is_active ? 'active' : 'inactive'
      } as PartnerUser
    : (partnerData?.success ? partnerData.data : null)

  const patients = patientsData?.success ? allPatients : []
  const totalCount = patientsData?.data?.pagination?.total || 0
  const hasMore = patientsData?.data?.pagination?.hasMore || false
  const loading = !patientsData && !patientsError
  const error = partnerError || patientsError

  // Resizable columns
  const { columnWidths, handleMouseDown, resetWidths } = useResizableColumns('partner-patient-roster', {
    patient: 200,
    status: 120,
    previous: 160,
    next: 140,
    provider: 150,
    contact: 200,
    actions: 180
  })

  // CSV Export function
  const handleExportCSV = () => {
    const csvData = sortedPatients.map(patient => ({
      name: `${patient.first_name} ${patient.last_name}`,
      email: patient.email || '',
      phone: patient.phone || '',
      roiStatus: patient.affiliation.consent_status,
      previousAppointment: patient.previous_appointment
        ? formatDateForCSV(patient.previous_appointment.start_time)
        : '',
      previousAppointmentRelative: patient.previous_appointment
        ? formatRelativeTime(patient.previous_appointment.start_time, false)
        : '',
      previousAppointmentStatus: patient.previous_appointment?.status || '',
      nextAppointment: patient.next_appointment
        ? formatDateForCSV(patient.next_appointment.start_time)
        : '',
      nextAppointmentRelative: patient.next_appointment
        ? formatRelativeTime(patient.next_appointment.start_time, true)
        : '',
      provider: patient.primary_provider
        ? `Dr. ${patient.primary_provider.last_name}`
        : '',
      insurance: patient.primary_insurance_payer?.name || ''
    }))

    const columnMapping = {
      name: 'Patient Name',
      email: 'Email',
      phone: 'Phone',
      roiStatus: 'ROI Status',
      previousAppointment: 'Previous Appointment',
      previousAppointmentRelative: 'Days Since',
      previousAppointmentStatus: 'Previous Appt Status',
      nextAppointment: 'Next Appointment',
      nextAppointmentRelative: 'Days Until',
      provider: 'Provider',
      insurance: 'Insurance'
    }

    const timestamp = new Date().toISOString().split('T')[0]
    exportToCSV(csvData, `partner-patients-${timestamp}.csv`, columnMapping)
  }

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

  // Filter and search patients (client-side filtering)
  const filteredPatients = patients.filter(p => {
    // Apply type filter
    if (filterType === 'assigned' && !p.is_assigned_to_me) return false
    if (filterType === 'roi_missing' && p.affiliation.consent_status === 'active') return false
    if (filterType === 'active_only' && p.engagement_status !== 'active') return false
    if (filterType === 'no_future_appt' && p.next_appointment) return false

    // Apply engagement status filter (if not 'all')
    if (engagementStatusFilter && engagementStatusFilter !== 'all' && p.engagement_status !== engagementStatusFilter) {
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
        aValue = a.previous_appointment?.start_time ? new Date(a.previous_appointment.start_time).getTime() : 0
        bValue = b.previous_appointment?.start_time ? new Date(b.previous_appointment.start_time).getTime() : 0
        break
      case 'next':
        aValue = a.next_appointment?.start_time ? new Date(a.next_appointment.start_time).getTime() : Number.MAX_SAFE_INTEGER
        bValue = b.next_appointment?.start_time ? new Date(b.next_appointment.start_time).getTime() : Number.MAX_SAFE_INTEGER
        break
      case 'provider':
        aValue = a.primary_provider ? `${a.primary_provider.first_name} ${a.primary_provider.last_name}`.toLowerCase() : ''
        bValue = b.primary_provider ? `${b.primary_provider.first_name} ${b.primary_provider.last_name}`.toLowerCase() : ''
        break
      case 'contact':
        aValue = (a.email || a.phone || '').toLowerCase()
        bValue = (b.email || b.phone || '').toLowerCase()
        break
      default:
        return 0
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
    return 0
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
          <div className="flex items-center gap-3">
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
            <BulkSyncButton onSyncComplete={refreshPatientData} />
          </div>
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
                  {patients.filter(p => p.engagement_status === 'active').length}
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
          {sortedPatients.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-['Newsreader']">
                {searchTerm ? 'No patients found matching your search.' : 'No patients to display.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
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
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown"
                        onMouseDown={(e) => handleMouseDown('patient', e)}
                      />
                    </th>
                    <th style={{ width: columnWidths.status }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('status')}
                        className="flex items-center gap-2 hover:text-moonlit-brown transition-colors"
                      >
                        Engagement Status
                        {getSortIcon('status')}
                      </button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown"
                        onMouseDown={(e) => handleMouseDown('status', e)}
                      />
                    </th>
                    <th style={{ width: columnWidths.previous }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('previous')}
                        className="flex items-center gap-2 hover:text-moonlit-brown transition-colors"
                      >
                        Previous Appointment
                        {getSortIcon('previous')}
                      </button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown"
                        onMouseDown={(e) => handleMouseDown('previous', e)}
                      />
                    </th>
                    <th style={{ width: columnWidths.next }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('next')}
                        className="flex items-center gap-2 hover:text-moonlit-brown transition-colors"
                      >
                        Next Appointment
                        {getSortIcon('next')}
                      </button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown"
                        onMouseDown={(e) => handleMouseDown('next', e)}
                      />
                    </th>
                    <th style={{ width: columnWidths.provider }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('provider')}
                        className="flex items-center gap-2 hover:text-moonlit-brown transition-colors"
                      >
                        Provider
                        {getSortIcon('provider')}
                      </button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown"
                        onMouseDown={(e) => handleMouseDown('provider', e)}
                      />
                    </th>
                    <th style={{ width: columnWidths.contact }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('contact')}
                        className="flex items-center gap-2 hover:text-moonlit-brown transition-colors"
                      >
                        Contact
                        {getSortIcon('contact')}
                      </button>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown"
                        onMouseDown={(e) => handleMouseDown('contact', e)}
                      />
                    </th>
                    <th style={{ width: columnWidths.actions }} className="relative px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-moonlit-brown"
                        onMouseDown={(e) => handleMouseDown('actions', e)}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedPatients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-gray-50">
                      {/* 1. Patient */}
                      <td style={{ width: columnWidths.patient }} className="px-6 py-4 whitespace-nowrap">
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
                      {/* 2. Engagement Status */}
                      <td style={{ width: columnWidths.status }} className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenChangeStatusModal(patient)}
                          className="hover:opacity-80 transition-opacity"
                          title="Click to change status"
                        >
                          <EngagementStatusChip status={patient.engagement_status} />
                        </button>
                      </td>
                      {/* 3. Previous Appointment */}
                      <td style={{ width: columnWidths.previous }} className="px-6 py-4">
                        {patient.previous_appointment ? (
                          <div className="flex flex-col space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-900">
                                {new Date(patient.previous_appointment.start_time).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                              {patient.previous_appointment.status === 'no_show' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                  No-show
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">
                              {(() => {
                                const diffMs = new Date().getTime() - new Date(patient.previous_appointment.start_time).getTime()
                                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
                                return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
                              })()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      {/* 4. Next Appointment */}
                      <td style={{ width: columnWidths.next }} className="px-6 py-4">
                        {patient.next_appointment ? (
                          <div className="space-y-1">
                            <div className="flex flex-col space-y-0.5">
                              <AppointmentLocationDisplay
                                meetingUrl={patient.next_appointment.meeting_url}
                                locationInfo={patient.next_appointment.location_info}
                                startTime={patient.next_appointment.start_time}
                                compact={true}
                              />
                              <span className="text-xs text-gray-500">
                                {(() => {
                                  const diffMs = new Date(patient.next_appointment.start_time).getTime() - new Date().getTime()
                                  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
                                  return `in ${diffDays} ${diffDays === 1 ? 'day' : 'days'}`
                                })()}
                              </span>
                            </div>
                            {patient.next_appointment.providers && (
                              <div className="text-xs text-gray-500">
                                Dr. {patient.next_appointment.providers.last_name}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No upcoming</span>
                        )}
                      </td>
                      {/* 5. Provider */}
                      <td style={{ width: columnWidths.provider }} className="px-6 py-4 whitespace-nowrap">
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
                      {/* 6. Contact */}
                      <td style={{ width: columnWidths.contact }} className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{patient.email || '—'}</div>
                        <div className="text-sm text-gray-500">{patient.phone || '—'}</div>
                      </td>
                      {/* 7. Actions */}
                      <td style={{ width: columnWidths.actions }} className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-col space-y-2">
                          {/* Sync Button */}
                          <div>
                            <SyncAppointmentsButton
                              patientId={patient.id}
                              patientName={`${patient.first_name} ${patient.last_name}`}
                              lastSyncAt={patient.affiliation.last_practiceq_sync_at}
                              onSyncComplete={refreshPatientData}
                            />
                          </div>
                          {/* Other Actions */}
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

      {/* Change Engagement Status Modal */}
      {changeStatusPatient && (
        <ChangeEngagementStatusModal
          patient={changeStatusPatient}
          isOpen={changeStatusModalOpen}
          onClose={handleCloseChangeStatusModal}
          onSuccess={handleChangeStatusSuccess}
        />
      )}
    </div>
  )
}
