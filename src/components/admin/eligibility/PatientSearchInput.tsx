/**
 * Patient Search Input Component
 *
 * Debounced search input for finding patients in the system
 * Displays results in a dropdown
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Loader2, User } from 'lucide-react'
import { usePatientSearch } from '@/hooks/usePatientSearch'

interface PatientSearchInputProps {
  onPatientSelect: (patient: any) => void
}

export default function PatientSearchInput({ onPatientSelect }: PatientSearchInputProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { searchPatients, patients, isLoading, clearResults } = usePatientSearch()

  // Handle clicks outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)

    // Clear previous timeout
    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
    }

    // Set new timeout for debounced search
    const timeout = setTimeout(() => {
      if (value.trim().length >= 2) {
        searchPatients(value)
        setShowResults(true)
      } else {
        clearResults()
        setShowResults(false)
      }
    }, 300) // 300ms debounce

    setDebounceTimeout(timeout)
  }

  // Handle patient selection
  const handleSelectPatient = (patient: any) => {
    onPatientSelect(patient)
    setSearchQuery(`${patient.first_name} ${patient.last_name}`)
    setShowResults(false)
  }

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-gray-400" />
          )}
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => {
            if (patients.length > 0) setShowResults(true)
          }}
          placeholder="Search by patient name or email..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Search Results Dropdown */}
      {showResults && patients.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {patients.map((patient) => (
            <button
              key={patient.id}
              onClick={() => handleSelectPatient(patient)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {patient.first_name} {patient.last_name}
                  </p>
                  <p className="text-sm text-gray-600">{patient.email}</p>
                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                    {patient.date_of_birth && (
                      <span>DOB: {formatDate(patient.date_of_birth)}</span>
                    )}
                    {patient.phone && <span>{patient.phone}</span>}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No Results Message */}
      {showResults && !isLoading && searchQuery.length >= 2 && patients.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
          <p className="text-sm text-gray-600 text-center">
            No patients found matching &quot;{searchQuery}&quot;
          </p>
        </div>
      )}
    </div>
  )
}
