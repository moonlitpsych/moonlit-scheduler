/**
 * FilterBar Component
 *
 * Search and filter controls for patient roster.
 * Adapts to different user roles (partner, provider, admin).
 */

import { useState, useEffect, useRef } from 'react'
import { RosterFilters, UserRole } from '@/types/patient-roster'

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

        {/* Filter checkboxes - independent and combinable */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Active Only checkbox */}
          <label className="inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.engagementStatus === 'active'}
              onChange={(e) => onFilterChange('engagementStatus', e.target.checked ? 'active' : 'all')}
              className="h-4 w-4 text-moonlit-brown rounded border-gray-300 focus:ring-moonlit-brown"
            />
            <span className="ml-2 text-sm text-gray-700 font-medium">Active Only</span>
          </label>

          {/* No Future Appt checkbox */}
          <label className="inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.appointmentFilter === 'no_future'}
              onChange={(e) => {
                if (e.target.checked) {
                  onFilterChange('appointmentFilter', 'no_future')
                } else {
                  onFilterChange('appointmentFilter', 'all')
                }
              }}
              className="h-4 w-4 text-moonlit-brown rounded border-gray-300 focus:ring-moonlit-brown"
            />
            <span className="ml-2 text-sm text-gray-700 font-medium">No Future Appt</span>
          </label>

          {/* Has Future Appt checkbox */}
          <label className="inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.appointmentFilter === 'has_future'}
              onChange={(e) => {
                if (e.target.checked) {
                  onFilterChange('appointmentFilter', 'has_future')
                } else {
                  onFilterChange('appointmentFilter', 'all')
                }
              }}
              className="h-4 w-4 text-moonlit-brown rounded border-gray-300 focus:ring-moonlit-brown"
            />
            <span className="ml-2 text-sm text-gray-700 font-medium">Has Future Appt</span>
          </label>

          {/* Separator */}
          <div className="border-l border-gray-300 h-5 mx-1" />

          {/* Has Google Meet checkbox */}
          <label className="inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.meetingLinkFilter === 'has_link'}
              onChange={(e) => {
                if (e.target.checked) {
                  onFilterChange('meetingLinkFilter', 'has_link')
                } else {
                  onFilterChange('meetingLinkFilter', 'all')
                }
              }}
              className="h-4 w-4 text-moonlit-brown rounded border-gray-300 focus:ring-moonlit-brown"
            />
            <span className="ml-2 text-sm text-gray-700 font-medium">Has Meet Link</span>
          </label>

          {/* No Google Meet checkbox */}
          <label className="inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.meetingLinkFilter === 'no_link'}
              onChange={(e) => {
                if (e.target.checked) {
                  onFilterChange('meetingLinkFilter', 'no_link')
                } else {
                  onFilterChange('meetingLinkFilter', 'all')
                }
              }}
              className="h-4 w-4 text-moonlit-brown rounded border-gray-300 focus:ring-moonlit-brown"
            />
            <span className="ml-2 text-sm text-gray-700 font-medium">No Meet Link</span>
          </label>

          {/* Partner-specific filters */}
          {userType === 'partner' && (
            <>
              <label className="inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filters.filterType === 'assigned_to_me'}
                  onChange={(e) => onFilterChange('filterType', e.target.checked ? 'assigned_to_me' : 'all')}
                  className="h-4 w-4 text-moonlit-brown rounded border-gray-300 focus:ring-moonlit-brown"
                />
                <span className="ml-2 text-sm text-gray-700 font-medium">My Patients</span>
              </label>

              <label className="inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filters.filterType === 'roi_missing'}
                  onChange={(e) => onFilterChange('filterType', e.target.checked ? 'roi_missing' : 'all')}
                  className="h-4 w-4 text-moonlit-brown rounded border-gray-300 focus:ring-moonlit-brown"
                />
                <span className="ml-2 text-sm text-gray-700 font-medium">ROI Missing</span>
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
