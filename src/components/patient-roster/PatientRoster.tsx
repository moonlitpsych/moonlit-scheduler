/**
 * PatientRoster Component
 *
 * Unified patient roster component that works across all user roles (partner, provider, admin).
 * Replaces three separate implementations with a single, flexible component.
 */

'use client'

import { useState } from 'react'
import { Download, RotateCcw, FileText, UserCheck, Bell, Building2, X, Search } from 'lucide-react'
import { PatientRosterProps, PatientRosterItem } from '@/types/patient-roster'
import { usePatientRosterData } from '@/hooks/usePatientRosterData'
import { exportPatientRosterToCSV } from '@/utils/patient-roster-helpers'
import { StatsCards } from './StatsCards'
import { FilterBar } from './FilterBar'
import { RosterTable } from './RosterTable'

// Partner-specific modals
import { TransferPatientModal } from '@/components/partner-dashboard/TransferPatientModal'
import { SendNotificationModal } from '@/components/partner-dashboard/SendNotificationModal'
import { UploadROIModal } from '@/components/partner-dashboard/UploadROIModal'
import { AssignProviderModal } from '@/components/partner-dashboard/AssignProviderModal'
import { ChangeEngagementStatusModal } from '@/components/partner-dashboard/ChangeEngagementStatusModal'
import { GenerateMedicationReportModal } from '@/components/partner-dashboard/GenerateMedicationReportModal'
import SyncAppointmentsButton from '@/components/partner-dashboard/SyncAppointmentsButton'

// Admin-specific modals
import { BulkAffiliateModal } from '@/components/admin/BulkAffiliateModal'
import { DiscoverPatientsModal } from '@/components/admin/DiscoverPatientsModal'

// Shared modals
import { AppointmentDetailsModal } from '@/components/shared/AppointmentDetailsModal'

export function PatientRoster({
  userType,
  userId,
  enablePatientLinks = false,
  enableROIActions = false,
  enableTransferAction = false,
  enableNotificationAction = false,
  enableMedicationReport = false,
  showAssignedFilter = false,
  showCaseManagerColumn = false,
  showOrganizationColumn = false,
  enableProviderFilter = false,
  enableTestPatientToggle = false,
  enableDiscoverPatients = false,
  enableBulkSelect = false,
  title = 'Patient Roster',
  defaultPageSize = 20,
  apiEndpoint
}: PatientRosterProps) {
  // Use the unified data hook with retry support
  const {
    patients,
    stats,
    loading,
    error,
    isValidating,
    retryCount,
    page,
    hasMore,
    loadMore,
    filters,
    updateFilter,
    resetFilters,
    sortColumn,
    sortDirection,
    handleSort,
    refresh
  } = usePatientRosterData({
    userType,
    userId,
    pageSize: defaultPageSize
  })

  // Modal states
  const [copiedAppointmentId, setCopiedAppointmentId] = useState<string | null>(null)

  // Appointment modal
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null)
  const [appointmentPatientName, setAppointmentPatientName] = useState<string>('')

  // Partner-specific modals
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<PatientRosterItem | null>(null)

  const [notificationModalOpen, setNotificationModalOpen] = useState(false)
  const [notifyPatient, setNotifyPatient] = useState<PatientRosterItem | null>(null)

  const [roiModalOpen, setRoiModalOpen] = useState(false)
  const [roiPatient, setRoiPatient] = useState<PatientRosterItem | null>(null)

  const [assignProviderModalOpen, setAssignProviderModalOpen] = useState(false)
  const [assignProviderPatient, setAssignProviderPatient] = useState<PatientRosterItem | null>(null)

  const [changeStatusModalOpen, setChangeStatusModalOpen] = useState(false)
  const [changeStatusPatient, setChangeStatusPatient] = useState<PatientRosterItem | null>(null)

  const [medicationReportModalOpen, setMedicationReportModalOpen] = useState(false)
  const [medicationReportPatient, setMedicationReportPatient] = useState<PatientRosterItem | null>(null)

  // Bulk selection state (admin only)
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<string>>(new Set())
  const [bulkAffiliateModalOpen, setBulkAffiliateModalOpen] = useState(false)

  // Discover patients modal state (admin only)
  const [discoverModalOpen, setDiscoverModalOpen] = useState(false)

  // Bulk selection handlers
  const handleSelectionChange = (newSelection: Set<string>) => {
    setSelectedPatientIds(newSelection)
  }

  const handleClearSelection = () => {
    setSelectedPatientIds(new Set())
  }

  const handleOpenBulkAffiliateModal = () => {
    setBulkAffiliateModalOpen(true)
  }

  const handleCloseBulkAffiliateModal = () => {
    setBulkAffiliateModalOpen(false)
  }

  const handleBulkAffiliateSuccess = async () => {
    // Clear selection and refresh data
    setSelectedPatientIds(new Set())
    await refresh()
  }

  // CSV Export handler
  const handleExportCSV = () => {
    const timestamp = new Date().toISOString().split('T')[0]
    exportPatientRosterToCSV({
      patients,
      userType,
      filename: `${userType}-patients-${timestamp}.csv`
    })
  }

  // Google Meet link copy handler
  const handleCopyMeetLink = async (appointmentId: string, link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setCopiedAppointmentId(appointmentId)
      setTimeout(() => setCopiedAppointmentId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Appointment modal handlers
  const handleOpenAppointmentModal = (appointment: any, patientName: string) => {
    setSelectedAppointment(appointment)
    setAppointmentPatientName(patientName)
    setAppointmentModalOpen(true)
  }

  const handleCloseAppointmentModal = () => {
    setAppointmentModalOpen(false)
    setSelectedAppointment(null)
    setAppointmentPatientName('')
  }

  const handleAppointmentUpdate = (appointmentId: string, newLink: string | null) => {
    // This will be called when Google Meet link is updated
    // The modal handles the API call, we just need to refresh the data
    refresh()
  }

  // Partner modal handlers
  const handleOpenTransferModal = (patient: PatientRosterItem) => {
    setSelectedPatient(patient)
    setTransferModalOpen(true)
  }

  const handleCloseTransferModal = () => {
    setTransferModalOpen(false)
    setSelectedPatient(null)
  }

  const handleTransferSuccess = async () => {
    await refresh()
  }

  const handleOpenNotificationModal = (patient: PatientRosterItem) => {
    setNotifyPatient(patient)
    setNotificationModalOpen(true)
  }

  const handleCloseNotificationModal = () => {
    setNotificationModalOpen(false)
    setNotifyPatient(null)
  }

  const handleNotificationSuccess = async () => {
    await refresh()
  }

  const handleOpenROIModal = (patient: PatientRosterItem) => {
    setRoiPatient(patient)
    setRoiModalOpen(true)
  }

  const handleCloseROIModal = () => {
    setRoiModalOpen(false)
    setRoiPatient(null)
  }

  const handleROISuccess = async () => {
    await refresh()
  }

  const handleOpenAssignProviderModal = (patient: PatientRosterItem) => {
    setAssignProviderPatient(patient)
    setAssignProviderModalOpen(true)
  }

  const handleCloseAssignProviderModal = () => {
    setAssignProviderModalOpen(false)
    setAssignProviderPatient(null)
  }

  const handleAssignProviderSuccess = async () => {
    await refresh()
  }

  const handleOpenChangeStatusModal = (patient: PatientRosterItem) => {
    setChangeStatusPatient(patient)
    setChangeStatusModalOpen(true)
  }

  const handleCloseChangeStatusModal = () => {
    setChangeStatusModalOpen(false)
    setChangeStatusPatient(null)
  }

  const handleChangeStatusSuccess = async () => {
    await refresh()
  }

  const handleOpenMedicationReportModal = (patient: PatientRosterItem) => {
    setMedicationReportPatient(patient)
    setMedicationReportModalOpen(true)
  }

  const handleCloseMedicationReportModal = () => {
    setMedicationReportModalOpen(false)
    setMedicationReportPatient(null)
  }

  const handleMedicationReportSuccess = async () => {
    await refresh()
  }

  // Initial loading state - ONLY on very first load with no data
  // After first load, we always show content and use inline indicators
  const showInitialSkeleton = loading && patients.length === 0

  if (showInitialSkeleton) {
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

  // Error state with retry option
  if (error) {
    return (
      <div className="min-h-screen bg-moonlit-cream">
        <div className="container mx-auto px-4 py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">
                  Failed to load patient roster
                </h3>
                <p className="mt-1 text-sm text-red-700">
                  {error.message || 'An unexpected error occurred'}
                </p>
                {retryCount > 0 && (
                  <p className="mt-1 text-xs text-red-600">
                    Retry attempts: {retryCount}
                  </p>
                )}
                <div className="mt-4">
                  <button
                    onClick={() => refresh()}
                    disabled={isValidating}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                  >
                    {isValidating ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-red-700" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Retrying...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Try Again
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
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
              {title}
            </h1>
            <p className="text-gray-600 font-['Newsreader'] font-light">
              {userType === 'partner' && 'View and manage patients from your organization'}
              {userType === 'provider' && 'Manage your patient roster and appointments'}
              {userType === 'admin' && 'View and manage all patients across the platform'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Discover Patients button - Admin only */}
            {enableDiscoverPatients && (
              <button
                onClick={() => setDiscoverModalOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-moonlit-brown text-white rounded-md shadow-sm text-sm font-medium hover:bg-moonlit-brown/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moonlit-brown"
                title="Import new patients from PracticeQ"
              >
                <Search className="w-4 h-4 mr-2" />
                Discover from PracticeQ
              </button>
            )}
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moonlit-brown"
              title="Export current view to CSV"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
            <button
              onClick={() => {
                // Reset column widths - will be implemented via RosterTable ref
                refresh()
              }}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moonlit-brown"
              title="Reset and refresh"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <StatsCards stats={stats} userType={userType} />

        {/* Filters and search */}
        <FilterBar filters={filters} onFilterChange={updateFilter} userType={userType} />

        {/* Bulk action toolbar - Admin only */}
        {enableBulkSelect && selectedPatientIds.size > 0 && (
          <div className="mb-4 bg-moonlit-brown/10 border border-moonlit-brown/20 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-moonlit-brown">
                {selectedPatientIds.size} patient{selectedPatientIds.size === 1 ? '' : 's'} selected
              </span>
              <button
                onClick={handleClearSelection}
                className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Clear selection
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenBulkAffiliateModal}
                className="inline-flex items-center px-4 py-2 bg-moonlit-brown text-white rounded-md hover:bg-moonlit-brown/90 transition-colors text-sm font-medium"
              >
                <Building2 className="w-4 h-4 mr-2" />
                Associate with Organization
              </button>
            </div>
          </div>
        )}

        {/* Patient table with inline loading indicator */}
        <div className="relative">
          {/* Inline loading overlay - shown during filter changes */}
          {isValidating && patients.length > 0 && (
            <div className="absolute top-0 right-0 z-20 px-3 py-1 bg-moonlit-brown/90 text-white text-sm rounded-bl-lg flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Updating...
            </div>
          )}
          <RosterTable
          patients={patients}
          userType={userType}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          enablePatientLinks={enablePatientLinks}
          enableStatusEdit={userType === 'partner'}
          enableBulkSelect={enableBulkSelect}
          showOrganizationColumn={showOrganizationColumn}
          selectedPatientIds={selectedPatientIds}
          onSelectionChange={handleSelectionChange}
          onStatusClick={handleOpenChangeStatusModal}
          onAppointmentClick={handleOpenAppointmentModal}
          onCopyMeetLink={handleCopyMeetLink}
          copiedAppointmentId={copiedAppointmentId}
          renderActions={
            userType === 'partner'
              ? (patient) => (
                  <div className="flex flex-col space-y-2">
                    {/* Sync Button */}
                    <div>
                      <SyncAppointmentsButton
                        patientId={patient.id}
                        patientName={`${patient.first_name} ${patient.last_name}`}
                        lastSyncAt={patient.roi?.last_practiceq_sync_at || patient.last_practiceq_sync_at}
                        onSyncComplete={refresh}
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-3">
                      {/* ROI Upload - only show if no ROI on file */}
                      {enableROIActions && patient.roi && !patient.roi.consent_on_file && (
                        <>
                          <button
                            onClick={() => handleOpenROIModal(patient)}
                            className="text-moonlit-brown hover:text-moonlit-brown/80 flex items-center space-x-1"
                            title="Upload ROI"
                          >
                            <FileText className="w-4 h-4" />
                            <span>Upload ROI</span>
                          </button>
                          {enableTransferAction && <span className="text-gray-300">|</span>}
                        </>
                      )}

                      {/* Transfer and other actions */}
                      {enableTransferAction && (
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
                        </>
                      )}

                      {enableNotificationAction && (
                        <>
                          <button
                            onClick={() => handleOpenNotificationModal(patient)}
                            className="text-green-600 hover:text-green-800 flex items-center space-x-1"
                          >
                            <Bell className="w-4 h-4" />
                            <span>Notify</span>
                          </button>
                          <span className="text-gray-300">|</span>
                        </>
                      )}

                      {enableMedicationReport && (
                        <button
                          onClick={() => handleOpenMedicationReportModal(patient)}
                          className="text-purple-600 hover:text-purple-800 flex items-center space-x-1"
                          title="Generate Medication Report"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Med Report</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              : undefined // Provider and admin don't have actions column yet
          }
        />
        </div>

        {/* Load more button */}
        {hasMore && (
          <div className="mt-6 text-center">
            <button
              onClick={loadMore}
              className="px-6 py-2 bg-moonlit-brown text-white rounded-lg hover:bg-moonlit-brown/90 transition-colors"
            >
              Load More Patients
            </button>
          </div>
        )}

        {/* Appointment Details Modal - All roles */}
        {selectedAppointment && (
          <AppointmentDetailsModal
            appointment={selectedAppointment}
            patientName={appointmentPatientName}
            isOpen={appointmentModalOpen}
            onClose={handleCloseAppointmentModal}
            onUpdate={handleAppointmentUpdate}
          />
        )}

        {/* Partner-specific modals */}
        {userType === 'partner' && (
          <>
            {/* Transfer Patient Modal */}
            {selectedPatient && (
              <TransferPatientModal
                patient={{
                  id: selectedPatient.id,
                  first_name: selectedPatient.first_name,
                  last_name: selectedPatient.last_name
                }}
                isOpen={transferModalOpen}
                onClose={handleCloseTransferModal}
                onSuccess={handleTransferSuccess}
              />
            )}

            {/* Send Notification Modal */}
            {notifyPatient && (
              <SendNotificationModal
                patient={{
                  id: notifyPatient.id,
                  first_name: notifyPatient.first_name,
                  last_name: notifyPatient.last_name,
                  email: notifyPatient.email
                }}
                appointments={
                  notifyPatient.next_appointment ? [notifyPatient.next_appointment] : []
                }
                isOpen={notificationModalOpen}
                onClose={handleCloseNotificationModal}
                onSuccess={handleNotificationSuccess}
              />
            )}

            {/* Upload ROI Modal */}
            {roiPatient && userId && (
              <UploadROIModal
                patient={{
                  id: roiPatient.id,
                  first_name: roiPatient.first_name,
                  last_name: roiPatient.last_name
                }}
                organizationId={userId} // Partner user's organization ID
                isOpen={roiModalOpen}
                onClose={handleCloseROIModal}
                onSuccess={handleROISuccess}
              />
            )}

            {/* Assign Provider Modal */}
            {assignProviderPatient && (
              <AssignProviderModal
                patient={{
                  id: assignProviderPatient.id,
                  first_name: assignProviderPatient.first_name,
                  last_name: assignProviderPatient.last_name,
                  primary_provider_id: assignProviderPatient.primary_provider_id,
                  primary_provider: assignProviderPatient.primary_provider
                }}
                isOpen={assignProviderModalOpen}
                onClose={handleCloseAssignProviderModal}
                onSuccess={handleAssignProviderSuccess}
              />
            )}

            {/* Change Engagement Status Modal */}
            {changeStatusPatient && (
              <ChangeEngagementStatusModal
                patient={{
                  id: changeStatusPatient.id,
                  first_name: changeStatusPatient.first_name,
                  last_name: changeStatusPatient.last_name
                }}
                currentStatus={changeStatusPatient.engagement_status}
                isOpen={changeStatusModalOpen}
                onClose={handleCloseChangeStatusModal}
                onSuccess={handleChangeStatusSuccess}
                userEmail={userId || ''} // Partner user email
                userType="partner"
              />
            )}

            {/* Generate Medication Report Modal */}
            {medicationReportPatient && userId && (
              <GenerateMedicationReportModal
                patient={{
                  id: medicationReportPatient.id,
                  first_name: medicationReportPatient.first_name,
                  last_name: medicationReportPatient.last_name
                }}
                isOpen={medicationReportModalOpen}
                onClose={handleCloseMedicationReportModal}
                onSuccess={handleMedicationReportSuccess}
                partnerUserId={userId}
              />
            )}
          </>
        )}

        {/* Admin-specific modals */}
        {userType === 'admin' && (
          <>
            {enableBulkSelect && (
              <BulkAffiliateModal
                selectedPatientIds={Array.from(selectedPatientIds)}
                patients={patients.filter(p => selectedPatientIds.has(p.id))}
                isOpen={bulkAffiliateModalOpen}
                onClose={handleCloseBulkAffiliateModal}
                onSuccess={handleBulkAffiliateSuccess}
              />
            )}
            {enableDiscoverPatients && (
              <DiscoverPatientsModal
                isOpen={discoverModalOpen}
                onClose={() => setDiscoverModalOpen(false)}
                onSuccess={() => refresh()}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
