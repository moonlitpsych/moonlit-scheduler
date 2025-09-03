// Partner Filters Component
'use client'

import { useState } from 'react'

interface PartnerFiltersProps {
  filters: {
    search: string
    status: string
    stage: string
    hasOrganization: string
  }
  onFilterChange: (newFilters: Partial<PartnerFiltersProps['filters']>) => void
  loading?: boolean
}

export function PartnerFilters({ filters, onFilterChange, loading = false }: PartnerFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'prospect', label: 'Prospect' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'terminated', label: 'Terminated' }
  ]

  const stageOptions = [
    { value: '', label: 'All Stages' },
    { value: 'lead', label: 'Lead' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'contract_sent', label: 'Contract Sent' },
    { value: 'live', label: 'Live' },
    { value: 'dormant', label: 'Dormant' }
  ]

  const organizationOptions = [
    { value: '', label: 'All Partners' },
    { value: 'true', label: 'Has Organization' },
    { value: 'false', label: 'No Organization' }
  ]

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ search: e.target.value })
  }

  const handleSelectChange = (field: string, value: string) => {
    onFilterChange({ [field]: value })
  }

  const clearFilters = () => {
    onFilterChange({
      search: '',
      status: '',
      stage: '',
      hasOrganization: ''
    })
  }

  const hasActiveFilters = filters.search || filters.status || filters.stage || filters.hasOrganization

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* Basic filters */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:space-x-4 space-y-4 lg:space-y-0">
        {/* Search */}
        <div className="flex-1 min-w-0">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
            Search Partners
          </label>
          <input
            id="search"
            type="text"
            value={filters.search}
            onChange={handleSearchChange}
            placeholder="Search by name, email, or contact person..."
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader'] text-sm
                     focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown
                     disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>

        {/* Status Filter */}
        <div className="w-full lg:w-48">
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
            Status
          </label>
          <select
            id="status"
            value={filters.status}
            onChange={(e) => handleSelectChange('status', e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader'] text-sm
                     focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown
                     disabled:bg-gray-50 disabled:text-gray-500"
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Advanced Filters Toggle */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-moonlit-brown hover:text-moonlit-brown-hover font-medium font-['Newsreader'] text-sm"
          >
            {showAdvanced ? 'Less Filters' : 'More Filters'}
          </button>
          
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              disabled={loading}
              className="text-gray-500 hover:text-gray-700 font-medium font-['Newsreader'] text-sm
                       disabled:opacity-50"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Stage Filter */}
            <div>
              <label htmlFor="stage" className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                Pipeline Stage
              </label>
              <select
                id="stage"
                value={filters.stage}
                onChange={(e) => handleSelectChange('stage', e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader'] text-sm
                         focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown
                         disabled:bg-gray-50 disabled:text-gray-500"
              >
                {stageOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Organization Filter */}
            <div>
              <label htmlFor="hasOrganization" className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                Organization Status
              </label>
              <select
                id="hasOrganization"
                value={filters.hasOrganization}
                onChange={(e) => handleSelectChange('hasOrganization', e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader'] text-sm
                         focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown
                         disabled:bg-gray-50 disabled:text-gray-500"
              >
                {organizationOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Active filters indicator */}
      {hasActiveFilters && (
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.search && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-moonlit-cream text-moonlit-brown border border-moonlit-brown/20">
              Search: "{filters.search}"
              <button
                onClick={() => onFilterChange({ search: '' })}
                className="ml-1 text-moonlit-brown hover:text-moonlit-brown-hover"
              >
                ×
              </button>
            </span>
          )}
          {filters.status && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-moonlit-cream text-moonlit-brown border border-moonlit-brown/20">
              Status: {statusOptions.find(o => o.value === filters.status)?.label}
              <button
                onClick={() => onFilterChange({ status: '' })}
                className="ml-1 text-moonlit-brown hover:text-moonlit-brown-hover"
              >
                ×
              </button>
            </span>
          )}
          {filters.stage && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-moonlit-cream text-moonlit-brown border border-moonlit-brown/20">
              Stage: {stageOptions.find(o => o.value === filters.stage)?.label}
              <button
                onClick={() => onFilterChange({ stage: '' })}
                className="ml-1 text-moonlit-brown hover:text-moonlit-brown-hover"
              >
                ×
              </button>
            </span>
          )}
          {filters.hasOrganization && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-moonlit-cream text-moonlit-brown border border-moonlit-brown/20">
              Org: {organizationOptions.find(o => o.value === filters.hasOrganization)?.label}
              <button
                onClick={() => onFilterChange({ hasOrganization: '' })}
                className="ml-1 text-moonlit-brown hover:text-moonlit-brown-hover"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}