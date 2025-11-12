/**
 * PatientRoster Component
 *
 * Unified patient roster component that works across all user roles (partner, provider, admin).
 * Replaces three separate implementations with a single, flexible component.
 */

'use client'

import { useState } from 'react'
import { Download, RotateCcw, FileText, UserCheck, Bell } from 'lucide-react'
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
  title = 'Patient Roster',
  defaultPageSize = 20,
  apiEndpoint
}: PatientRosterProps) {
  // Use the unified data hook
  const {
    patients,
    stats,
    loading,
    error,
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

  // Loading state
  if (loading) {
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

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-moonlit-cream">
        <div className="container mx-auto px-4 py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">
              {error.message || 'Failed to load patient roster'}
            </p>
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

        {/* Patient table */}
        <RosterTable
          patients={patients}
          userType={userType}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          enablePatientLinks={enablePatientLinks}
          enableStatusEdit={userType === 'partner'}
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
      </div>
    </div>
  )
}
