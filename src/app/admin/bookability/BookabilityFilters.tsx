'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { FilterState } from './page'

interface BookabilityFiltersProps {
  filters: FilterState
  setFilters: (filters: FilterState) => void
  availablePayers: {id: string, name: string}[]
  availableProviders: {id: string, name: string}[]
}

export default function BookabilityFilters({
  filters,
  setFilters,
  availablePayers,
  availableProviders
}: BookabilityFiltersProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const toggleDropdown = (dropdown: string) => {
    setOpenDropdown(openDropdown === dropdown ? null : dropdown)
  }

  const updateFilters = (updates: Partial<FilterState>) => {
    setFilters({ ...filters, ...updates })
  }

  const clearAllFilters = () => {
    setFilters({
      payers: [],
      providers: [],
      path: 'all',
      requiresAttending: 'all',
      state: 'all',
      activeToday: false
    })
    setOpenDropdown(null)
  }

  const MultiSelectDropdown = ({
    label,
    value,
    options,
    onChange,
    dropdownKey
  }: {
    label: string
    value: string[]
    options: {id: string, name: string}[]
    onChange: (selected: string[]) => void
    dropdownKey: string
  }) => {
    const isOpen = openDropdown === dropdownKey

    const toggleOption = (optionId: string) => {
      if (value.includes(optionId)) {
        onChange(value.filter(id => id !== optionId))
      } else {
        onChange([...value, optionId])
      }
    }

    const selectAll = () => {
      onChange(options.map(opt => opt.id))
    }

    const selectNone = () => {
      onChange([])
    }

    return (
      <div className="relative">
        <button
          onClick={() => toggleDropdown(dropdownKey)}
          className="w-full flex items-center justify-between px-3 py-2 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
        >
          <span className="text-sm">
            {value.length === 0 
              ? `All ${label}` 
              : `${label} (${value.length})`
            }
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg z-10 max-h-64 overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-stone-200 bg-stone-50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#091747]">Select {label}</span>
                <div className="flex space-x-2">
                  <button
                    onClick={selectAll}
                    className="text-xs text-[#BF9C73] hover:text-[#BF9C73]/80"
                  >
                    All
                  </button>
                  <button
                    onClick={selectNone}
                    className="text-xs text-[#BF9C73] hover:text-[#BF9C73]/80"
                  >
                    None
                  </button>
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="max-h-48 overflow-y-auto">
              {options.map(option => (
                <label
                  key={option.id}
                  className="flex items-center px-3 py-2 hover:bg-stone-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={value.includes(option.id)}
                    onChange={() => toggleOption(option.id)}
                    className="w-4 h-4 text-[#BF9C73] border-stone-300 rounded focus:ring-[#BF9C73]/20"
                  />
                  <span className="ml-2 text-sm text-[#091747]">{option.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const SingleSelectDropdown = ({
    label,
    value,
    options,
    onChange,
    dropdownKey
  }: {
    label: string
    value: string
    options: {value: string, label: string}[]
    onChange: (selected: string) => void
    dropdownKey: string
  }) => {
    const isOpen = openDropdown === dropdownKey
    const selectedLabel = options.find(opt => opt.value === value)?.label || 'All'

    return (
      <div className="relative">
        <button
          onClick={() => toggleDropdown(dropdownKey)}
          className="w-full flex items-center justify-between px-3 py-2 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
        >
          <span className="text-sm">{selectedLabel}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg z-10">
            {options.map(option => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value)
                  setOpenDropdown(null)
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-stone-50 transition-colors ${
                  value === option.value ? 'bg-[#BF9C73]/10 text-[#BF9C73]' : 'text-[#091747]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="mb-6 p-4 bg-stone-50 rounded-lg border border-stone-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[#091747]">Filters</h3>
        <button
          onClick={clearAllFilters}
          className="flex items-center space-x-1 text-xs text-[#BF9C73] hover:text-[#BF9C73]/80"
        >
          <X className="h-3 w-3" />
          <span>Clear All</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Payers */}
        <div>
          <label className="block text-xs font-medium text-[#091747]/70 mb-1">Payers</label>
          <MultiSelectDropdown
            label="Payers"
            value={filters.payers}
            options={availablePayers}
            onChange={(selected) => updateFilters({ payers: selected })}
            dropdownKey="payers"
          />
        </div>

        {/* Providers */}
        <div>
          <label className="block text-xs font-medium text-[#091747]/70 mb-1">Providers</label>
          <MultiSelectDropdown
            label="Providers"
            value={filters.providers}
            options={availableProviders}
            onChange={(selected) => updateFilters({ providers: selected })}
            dropdownKey="providers"
          />
        </div>

        {/* Path */}
        <div>
          <label className="block text-xs font-medium text-[#091747]/70 mb-1">Bookability Path</label>
          <SingleSelectDropdown
            label="Path"
            value={filters.path}
            options={[
              { value: 'all', label: 'All Paths' },
              { value: 'direct', label: 'Direct Only' },
              { value: 'supervised', label: 'Supervised Only' }
            ]}
            onChange={(selected) => updateFilters({ path: selected as any })}
            dropdownKey="path"
          />
        </div>

        {/* Requires Attending */}
        <div>
          <label className="block text-xs font-medium text-[#091747]/70 mb-1">Requires Attending</label>
          <SingleSelectDropdown
            label="Attending"
            value={filters.requiresAttending}
            options={[
              { value: 'all', label: 'All' },
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' }
            ]}
            onChange={(selected) => updateFilters({ requiresAttending: selected as any })}
            dropdownKey="attending"
          />
        </div>

        {/* State */}
        <div>
          <label className="block text-xs font-medium text-[#091747]/70 mb-1">State</label>
          <SingleSelectDropdown
            label="State"
            value={filters.state}
            options={[
              { value: 'all', label: 'All States' },
              { value: 'UT', label: 'Utah' },
              { value: 'ID', label: 'Idaho' }
            ]}
            onChange={(selected) => updateFilters({ state: selected as any })}
            dropdownKey="state"
          />
        </div>

        {/* Active Today Toggle */}
        <div>
          <label className="block text-xs font-medium text-[#091747]/70 mb-1">Status</label>
          <label className="flex items-center space-x-2 px-3 py-2 bg-white border border-stone-200 rounded-lg cursor-pointer hover:bg-stone-50 transition-colors">
            <input
              type="checkbox"
              checked={filters.activeToday}
              onChange={(e) => updateFilters({ activeToday: e.target.checked })}
              className="w-4 h-4 text-[#BF9C73] border-stone-300 rounded focus:ring-[#BF9C73]/20"
            />
            <span className="text-sm text-[#091747]">Active Today</span>
          </label>
        </div>
      </div>

      {/* Active Filters Summary */}
      {(filters.payers.length > 0 || filters.providers.length > 0 || filters.path !== 'all' || 
        filters.requiresAttending !== 'all' || filters.state !== 'all' || filters.activeToday) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {filters.payers.length > 0 && (
            <span className="inline-flex items-center space-x-1 px-2 py-1 bg-[#BF9C73]/10 text-[#BF9C73] text-xs rounded">
              <span>Payers: {filters.payers.length}</span>
              <button onClick={() => updateFilters({ payers: [] })}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.providers.length > 0 && (
            <span className="inline-flex items-center space-x-1 px-2 py-1 bg-[#BF9C73]/10 text-[#BF9C73] text-xs rounded">
              <span>Providers: {filters.providers.length}</span>
              <button onClick={() => updateFilters({ providers: [] })}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.path !== 'all' && (
            <span className="inline-flex items-center space-x-1 px-2 py-1 bg-[#BF9C73]/10 text-[#BF9C73] text-xs rounded">
              <span>{filters.path === 'direct' ? 'Direct' : 'Supervised'}</span>
              <button onClick={() => updateFilters({ path: 'all' })}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}