/**
 * Admin Patient Roster Page (Unified)
 *
 * Uses the unified PatientRoster component with admin-specific configuration.
 * Shows ALL patients across the platform with full filtering capabilities.
 * Replaced 1,120 lines of inline implementation with ~40 lines.
 */

'use client'

import { PatientRoster } from '@/components/patient-roster'
import AdminBulkSyncButton from '@/components/dashboard/AdminBulkSyncButton'

export default function AdminPatientsPage() {
  return (
    <div className="min-h-screen bg-moonlit-cream">
      <div className="container mx-auto px-4 py-8">
        {/* Page header with AdminBulkSyncButton */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-moonlit-navy mb-2 font-['Newsreader']">
              All Patients
            </h1>
            <p className="text-gray-600 font-['Newsreader'] font-light">
              View and manage all patients across the platform
            </p>
          </div>
          <AdminBulkSyncButton onSyncComplete={() => {
            // Roster will auto-refresh via SWR revalidation
            console.log('Bulk sync completed')
          }} />
        </div>

        {/* Unified Patient Roster Component */}
        <PatientRoster
          userType="admin"
          userId={undefined}

          // Admin-specific features
          showCaseManagerColumn={true}
          showOrganizationColumn={true}
          enableProviderFilter={true}
          enableTestPatientToggle={true}

          // Configuration
          title="All Patients"
          defaultPageSize={50}
        />
      </div>
    </div>
  )
}
