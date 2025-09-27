'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Calendar, User, Building } from 'lucide-react'
import { BookabilityRow } from './page'
import BookabilityRowDetails from './BookabilityRowDetails'
import { formatDateSafe } from '@/lib/utils/dateFormatting'
import { getRenderingProviderId } from '@/lib/bookability/mapRenderingProvider'
import { fetchRenderingProviderNames } from '@/lib/bookability/fetchRenderingProviders'

interface BookabilityTableProps {
  data: BookabilityRow[]
  loading: boolean
}

export default function BookabilityTable({ data, loading }: BookabilityTableProps) {
  const [selectedRow, setSelectedRow] = useState<BookabilityRow | null>(null)
  const [sortField, setSortField] = useState<keyof BookabilityRow>('provider_last_name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [renderingProviderNames, setRenderingProviderNames] = useState<Map<string, string>>(new Map())

  // Load rendering provider names when data changes
  useEffect(() => {
    const loadRenderingProviderNames = async () => {
      if (!data.length) return

      const renderingIds = data
        .map(row => getRenderingProviderId(row))
        .filter(Boolean) as string[]

      if (renderingIds.length === 0) return

      try {
        const nameMap = await fetchRenderingProviderNames(renderingIds)
        setRenderingProviderNames(nameMap)
      } catch (error) {
        console.error('Failed to load rendering provider names:', error)
      }
    }

    loadRenderingProviderNames()
  }, [data])

  // RenderingProviderCell component
  const RenderingProviderCell = ({ row }: { row: BookabilityRow }) => {
    const renderingProviderId = getRenderingProviderId(row)

    if (!renderingProviderId) {
      return <span className="text-[#091747]/40">-</span>
    }

    const name = renderingProviderNames.get(renderingProviderId)
    if (name) {
      return <span className="text-[#091747]">{name}</span>
    }

    // Fallback to existing logic while names are loading
    if (row.billing_provider_id === row.provider_id) {
      return (
        <span className="text-[#091747]">
          {row.provider_first_name} {row.provider_last_name}
        </span>
      )
    }

    return <span className="text-[#091747]">Dr. Privratsky</span>
  }

  // Chip component for consistent styling
  const Chip = ({ 
    variant, 
    children 
  }: { 
    variant: 'direct' | 'supervised' | 'yes' | 'no' | 'general'
    children: React.ReactNode 
  }) => {
    const getChipStyles = () => {
      switch (variant) {
        case 'direct':
          return 'bg-green-100 text-green-800 border-green-200'
        case 'supervised':
          return 'bg-blue-100 text-blue-800 border-blue-200'
        case 'yes':
          return 'bg-orange-100 text-orange-800 border-orange-200'
        case 'no':
          return 'bg-gray-100 text-gray-800 border-gray-200'
        case 'general':
          return 'bg-yellow-100 text-yellow-800 border-yellow-200'
        default:
          return 'bg-gray-100 text-gray-800 border-gray-200'
      }
    }

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getChipStyles()}`}>
        {children}
      </span>
    )
  }

  // Format date helper - timezone-safe version
  const formatDate = (dateString: string | null) => {
    return formatDateSafe(dateString, { format: 'short' })
  }

  // Sort data
  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortField]
    const bVal = b[sortField]
    
    if (aVal === null && bVal === null) return 0
    if (aVal === null) return 1
    if (bVal === null) return -1
    
    const comparison = String(aVal).localeCompare(String(bVal))
    return sortDirection === 'asc' ? comparison : -comparison
  })

  // Handle sort
  const handleSort = (field: keyof BookabilityRow) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Sort header component
  const SortHeader = ({ field, children }: { field: keyof BookabilityRow, children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center space-x-1 text-left font-medium text-[#091747] hover:text-[#BF9C73] transition-colors"
    >
      <span>{children}</span>
      {sortField === field && (
        sortDirection === 'asc' ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3 rotate-90" />
      )}
    </button>
  )

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[#BF9C73] border-t-transparent"></div>
        <p className="mt-4 text-[#091747]/60">Loading bookability relationships...</p>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Building className="h-8 w-8 text-stone-400" />
        </div>
        <h3 className="text-lg font-medium text-[#091747] mb-2">No relationships found</h3>
        <p className="text-[#091747]/60">Try adjusting your filters or search terms.</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <SortHeader field="provider_last_name">Provider</SortHeader>
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader field="payer_name">Payer</SortHeader>
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader field="network_status">Path</SortHeader>
              </th>
              <th className="px-4 py-3 text-left">Requires Attending</th>
              <th className="px-4 py-3 text-left">Supervision Level</th>
              <th className="px-4 py-3 text-left">Rendering Provider</th>
              <th className="px-4 py-3 text-left">
                <SortHeader field="state">State</SortHeader>
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader field="effective_date">Effective</SortHeader>
              </th>
              <th className="px-4 py-3 text-left">Expires</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {sortedData.map((row, index) => (
              <tr
                key={`${row.provider_id}-${row.payer_id}`}
                className="hover:bg-stone-50 cursor-pointer transition-colors"
                onClick={() => setSelectedRow(row)}
              >
                {/* Provider */}
                <td className="px-4 py-3">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-[#091747]/40" />
                    <span className="font-medium text-[#091747]">
                      {row.provider_first_name} {row.provider_last_name}
                    </span>
                  </div>
                </td>

                {/* Payer */}
                <td className="px-4 py-3">
                  <span className="text-[#091747]">{row.payer_name}</span>
                </td>

                {/* Path */}
                <td className="px-4 py-3">
                  <Chip variant={row.network_status === 'in_network' ? 'direct' : 'supervised'}>
                    {row.network_status === 'in_network' ? 'Direct' : 'Supervised'}
                  </Chip>
                </td>

                {/* Requires Attending */}
                <td className="px-4 py-3">
                  <Chip variant={row.requires_attending ? 'yes' : 'no'}>
                    {row.requires_attending ? 'Yes' : 'No'}
                  </Chip>
                </td>

                {/* Supervision Level */}
                <td className="px-4 py-3">
                  {row.network_status === 'supervised' ? (
                    <Chip variant="general">General</Chip>
                  ) : (
                    <span className="text-[#091747]/40">-</span>
                  )}
                </td>

                {/* Rendering Provider */}
                <td className="px-4 py-3">
                  <RenderingProviderCell row={row} />
                </td>

                {/* State */}
                <td className="px-4 py-3">
                  <span className="text-[#091747]">{row.state || '-'}</span>
                </td>

                {/* Effective Date */}
                <td className="px-4 py-3">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3 text-[#091747]/40" />
                    <span className="text-sm text-[#091747]">
                      {formatDate(row.effective_date)}
                    </span>
                  </div>
                </td>

                {/* Expiration Date */}
                <td className="px-4 py-3">
                  <span className="text-sm text-[#091747]">
                    {formatDate(row.expiration_date)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Row Details Drawer */}
      {selectedRow && (
        <BookabilityRowDetails
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </>
  )
}