/**
 * Admin Eligibility Checker Page
 *
 * Real-time insurance eligibility verification via Office Ally
 * Accessible from /dashboard/admin/eligibility-checker
 */

'use client'

import { useState } from 'react'
import { ClipboardCheck, History } from 'lucide-react'
import EligibilityCheckerForm from '@/components/admin/eligibility/EligibilityCheckerForm'
import EligibilityHistory from '@/components/admin/eligibility/EligibilityHistory'
import AdminBulkSyncButton from '@/components/dashboard/AdminBulkSyncButton'

export default function EligibilityCheckerPage() {
  const [activeTab, setActiveTab] = useState<'check' | 'history'>('check')
  const [refreshKey, setRefreshKey] = useState(0)

  const handleSyncComplete = () => {
    // Refresh the form to show newly synced patients
    setRefreshKey(prev => prev + 1)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Insurance Eligibility Checker
          </h1>
          <p className="text-gray-600">
            Verify patient insurance eligibility and benefits in real-time via Office Ally
          </p>
        </div>
        <AdminBulkSyncButton onSyncComplete={handleSyncComplete} />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('check')}
            className={`
              flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
              ${
                activeTab === 'check'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <ClipboardCheck className="w-5 h-5" />
            Check Eligibility
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`
              flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
              ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <History className="w-5 h-5" />
            History
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'check' && <EligibilityCheckerForm key={refreshKey} />}
        {activeTab === 'history' && <EligibilityHistory />}
      </div>
    </div>
  )
}
