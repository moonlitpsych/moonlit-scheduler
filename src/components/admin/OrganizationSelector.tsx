'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search, Building2, Users, X, Check } from 'lucide-react'

interface Organization {
  id: string
  name: string
  slug: string
  type: string
  status: string
  default_case_manager_id?: string | null
  stats?: {
    partners_count: number
    active_users_count: number
    active_patients_count: number
  }
}

interface OrganizationSelectorProps {
  value?: string  // organization_id
  onChange: (orgId: string | null, org: Organization | null) => void
  placeholder?: string
  disabled?: boolean
  error?: string
}

const TYPE_LABELS: Record<string, string> = {
  healthcare_partner: 'Healthcare Partner',
  treatment_center: 'Treatment Center',
  rehabilitation: 'Rehabilitation',
  mental_health: 'Mental Health',
  substance_abuse: 'Substance Abuse',
  other: 'Other'
}

const TYPE_COLORS: Record<string, string> = {
  healthcare_partner: 'bg-blue-100 text-blue-800',
  treatment_center: 'bg-green-100 text-green-800',
  rehabilitation: 'bg-purple-100 text-purple-800',
  mental_health: 'bg-indigo-100 text-indigo-800',
  substance_abuse: 'bg-amber-100 text-amber-800',
  other: 'bg-gray-100 text-gray-800'
}

export default function OrganizationSelector({
  value,
  onChange,
  placeholder = 'Select an organization...',
  disabled = false,
  error
}: OrganizationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Load organizations on mount
  useEffect(() => {
    loadOrganizations()
  }, [])

  // Set selected org when value changes
  useEffect(() => {
    if (value && organizations.length > 0) {
      const org = organizations.find(o => o.id === value)
      setSelectedOrg(org || null)
    } else if (!value) {
      setSelectedOrg(null)
    }
  }, [value, organizations])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  const loadOrganizations = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/organizations?status=active&include_stats=true&per_page=100')
      const result = await response.json()

      if (result.success) {
        setOrganizations(result.data)
      } else {
        console.error('Failed to load organizations:', result.error)
      }
    } catch (error) {
      console.error('Error loading organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (org: Organization) => {
    setSelectedOrg(org)
    onChange(org.id, org)
    setIsOpen(false)
    setSearchQuery('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedOrg(null)
    onChange(null, null)
  }

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.slug.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger - using div with role=button to avoid nested button issue */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            setIsOpen(!isOpen)
          }
        }}
        className={`
          w-full flex items-center justify-between px-4 py-3 text-left
          bg-white border rounded-lg transition-colors
          ${disabled ? 'bg-gray-50 cursor-not-allowed opacity-60' : 'hover:border-moonlit-brown cursor-pointer'}
          ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-moonlit-brown'}
          ${isOpen ? 'ring-2 ring-moonlit-brown border-moonlit-brown' : ''}
        `}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Building2 className="w-5 h-5 text-gray-400 flex-shrink-0" />
          {selectedOrg ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-gray-900 truncate">
                {selectedOrg.name}
              </span>
              <span className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${TYPE_COLORS[selectedOrg.type] || TYPE_COLORS.other}`}>
                {TYPE_LABELS[selectedOrg.type] || selectedOrg.type}
              </span>
            </div>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedOrg && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation() // Prevent triggering the parent div's onClick
                handleClear(e)
              }}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search organizations..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-moonlit-brown focus:border-transparent"
              />
            </div>
          </div>

          {/* Organization list */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">
                <div className="animate-spin w-5 h-5 border-2 border-moonlit-brown border-t-transparent rounded-full mx-auto mb-2" />
                Loading organizations...
              </div>
            ) : filteredOrganizations.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {searchQuery ? 'No organizations found matching your search' : 'No organizations available'}
              </div>
            ) : (
              filteredOrganizations.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => handleSelect(org)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors
                    ${selectedOrg?.id === org.id ? 'bg-moonlit-brown/5' : ''}
                  `}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">
                        {org.name}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${TYPE_COLORS[org.type] || TYPE_COLORS.other}`}>
                        {TYPE_LABELS[org.type] || org.type}
                      </span>
                    </div>
                    {org.stats && (
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {org.stats.active_patients_count} patients
                        </span>
                        <span>{org.stats.active_users_count} staff</span>
                      </div>
                    )}
                  </div>
                  {selectedOrg?.id === org.id && (
                    <Check className="w-5 h-5 text-moonlit-brown flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
