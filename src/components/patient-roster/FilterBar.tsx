/**
 * FilterBar Component
 *
 * Search and filter controls for patient roster.
 * Adapts to different user roles (partner, provider, admin).
 */

import { useState, useEffect, useRef } from 'react'
import { RosterFilters, UserRole, EngagementStatus } from '@/types/patient-roster'

interface FilterBarProps {
  filters: RosterFilters
  onFilterChange: <K extends keyof RosterFilters>(key: K, value: RosterFilters[K]) => void
  userType: UserRole
}

export function FilterBar({ filters, onFilterChange, userType }: FilterBarProps) {
  // Local state for search input to enable debouncing
  const [localSearchTerm, setLocalSearchTerm] = useState(filters.searchTerm || '')
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Sync local state if parent filter changes (e.g., on reset)
  useEffect(() => {
    setLocalSearchTerm(filters.searchTerm || '')
  }, [filters.searchTerm])

  // Debounced search - only update parent filter after 300ms of no typing
  const handleSearchChange = (value: string) => {
    setLocalSearchTerm(value)

    // Clear any existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    // Set new timeout to update parent filter
    debounceTimeoutRef.current = setTimeout(() => {
      onFilterChange('searchTerm', value)
    }, 300)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search input with debouncing */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search patients by name, email, or phone..."
            value={localSearchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-moonlit-brown focus:border-transparent"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-2">
          {/* Common filters */}
          <button
            onClick={() => onFilterChange('filterType', 'all')}
            className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
              filters.filterType === 'all'
                ? 'bg-moonlit-brown text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>

          <button
            onClick={() => onFilterChange('filterType', 'active_only')}
            className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
              filters.filterType === 'active_only'
                ? 'bg-moonlit-brown text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Active Only
          </button>

          <button
            onClick={() => onFilterChange('filterType', 'no_future_appt')}
            className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
              filters.filterType === 'no_future_appt'
                ? 'bg-moonlit-brown text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            No Future Appt
          </button>

          {/* Partner-specific filters */}
          {userType === 'partner' && (
            <>
              <button
                onClick={() => onFilterChange('filterType', 'assigned_to_me')}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                  filters.filterType === 'assigned_to_me'
                    ? 'bg-moonlit-brown text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                My Patients
              </button>

              <button
                onClick={() => onFilterChange('filterType', 'roi_missing')}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                  filters.filterType === 'roi_missing'
                    ? 'bg-moonlit-brown text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                ROI Missing
              </button>
            </>
          )}

          {/* Engagement status dropdown */}
          <select
            value={filters.engagementStatus || 'active'}
            onChange={(e) => onFilterChange('engagementStatus', e.target.value as EngagementStatus | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-moonlit-brown focus:border-transparent"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="discharged">Discharged</option>
            <option value="transferred">Transferred</option>
            <option value="deceased">Deceased</option>
            <option value="unresponsive">Unresponsive</option>
          </select>
        </div>
      </div>
    </div>
  )
}
