/**
 * Eligibility History Component
 *
 * Displays past eligibility checks with filtering and pagination
 */

'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { History, CheckCircle, XCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface EligibilityCheck {
  id: string
  admin_user_email: string
  patient_first_name: string
  patient_last_name: string
  patient_dob: string
  payer_display_name: string | null
  office_ally_payer_id: string | null
  is_eligible: boolean | null
  coverage_status: string | null
  copay_amounts: any
  deductible_info: any
  response_time_ms: number | null
  created_at: string
}

export default function EligibilityHistory() {
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const limit = 20

  // Build API URL with pagination and filters
  const buildApiUrl = () => {
    const params = new URLSearchParams()
    params.append('limit', limit.toString())
    params.append('offset', ((page - 1) * limit).toString())
    if (searchTerm.trim()) {
      params.append('patient', searchTerm.trim())
    }
    return `/api/admin/eligibility/history?${params.toString()}`
  }

  const { data, error, isLoading } = useSWR(buildApiUrl(), fetcher, {
    revalidateOnFocus: false
  })

  const checks: EligibilityCheck[] = data?.data?.checks || []
  const pagination = data?.data?.pagination || {}
  const loading = isLoading || (!data && !error)

  // Format date/time
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  // Format currency
  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return 'N/A'
    return `$${amount.toFixed(2)}`
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(1) // Reset to first page on search
              }}
              placeholder="Search by patient name..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date/Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Copay
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Admin
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Loading history...
                  </td>
                </tr>
              ) : checks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <History className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p>No eligibility checks found</p>
                    {searchTerm && (
                      <p className="text-sm mt-1">Try a different search term</p>
                    )}
                  </td>
                </tr>
              ) : (
                checks.map((check) => (
                  <tr key={check.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDateTime(check.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {check.patient_first_name} {check.patient_last_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        DOB: {new Date(check.patient_dob).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {check.payer_display_name || check.office_ally_payer_id || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {check.is_eligible === null ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Unknown
                        </span>
                      ) : check.is_eligible ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3" />
                          Eligible
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3" />
                          Not Eligible
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {check.copay_amounts?.mentalHealthOutpatient
                        ? formatCurrency(check.copay_amounts.mentalHealthOutpatient)
                        : check.copay_amounts?.primaryCareCopay
                        ? formatCurrency(check.copay_amounts.primaryCareCopay)
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {check.admin_user_email}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && checks.length > 0 && (
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{pagination.offset + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(pagination.offset + pagination.limit, pagination.totalCount)}
                </span>{' '}
                of <span className="font-medium">{pagination.totalCount}</span> results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasMore}
                  className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
