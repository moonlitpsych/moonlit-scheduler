/**
 * usePatientRosterData Hook
 *
 * Unified data fetching hook for patient roster across all user roles.
 * Handles SWR caching, pagination, filtering, sorting, and error recovery.
 *
 * Features:
 * - Automatic retry on failure (3 attempts with exponential backoff)
 * - Error recovery with retry button
 * - Deduplication to prevent duplicate requests
 * - Background revalidation for fresh data
 */

import { useState, useMemo, useCallback } from 'react'
import useSWR from 'swr'
import {
  UserRole,
  RosterFilters,
  PatientRosterItem,
  PatientRosterResponse,
  SortColumn
} from '@/types/patient-roster'

/**
 * SWR fetcher with timeout and error handling
 * Times out after 30 seconds to prevent hanging requests
 */
const fetcher = async (url: string) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error ${response.status}: ${errorText || response.statusText}`)
    }

    const data = await response.json()

    // Validate response structure
    if (!data || (typeof data === 'object' && data.error)) {
      throw new Error(data?.error || 'Invalid API response')
    }

    return data
  } catch (error: any) {
    clearTimeout(timeoutId)

    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.')
    }

    throw error
  }
}

interface UsePatientRosterDataOptions {
  userType: UserRole
  userId?: string
  initialFilters?: Partial<RosterFilters>
  pageSize?: number
}

interface UsePatientRosterDataReturn {
  // Data
  patients: PatientRosterItem[]
  stats: PatientRosterResponse['stats']

  // Loading and errors
  loading: boolean
  error: Error | null
  isValidating: boolean  // True when revalidating in background
  retryCount: number     // Number of retry attempts made

  // Pagination
  page: number
  totalPages: number
  hasMore: boolean
  loadMore: () => void
  resetPagination: () => void

  // Filters
  filters: RosterFilters
  updateFilter: <K extends keyof RosterFilters>(key: K, value: RosterFilters[K]) => void
  resetFilters: () => void

  // Sorting (client-side)
  sortColumn: SortColumn | null
  sortDirection: 'asc' | 'desc' | null
  handleSort: (column: SortColumn) => void

  // Data management
  mutate: () => Promise<any>
  refresh: () => Promise<void>
}

export function usePatientRosterData(
  options: UsePatientRosterDataOptions
): UsePatientRosterDataReturn {
  const { userType, userId, initialFilters = {}, pageSize = 20 } = options

  // Filter state
  const [filters, setFilters] = useState<RosterFilters>({
    searchTerm: '',
    engagementStatus: 'active',
    appointmentFilter: 'all',
    meetingLinkFilter: 'all',
    organizationId: 'all',
    providerId: 'all',
    payerId: 'all',
    caseManagerId: 'all',
    filterType: 'all',
    showTestPatients: false,
    sortColumn: null,
    sortDirection: null,
    page: 1,
    limit: pageSize,
    ...initialFilters
  })

  // Sort state (client-side)
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)

  // Pagination state
  const [page, setPage] = useState(1)
  const [allPatients, setAllPatients] = useState<PatientRosterItem[]>([])

  // Build API URL with query parameters
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams({
      user_type: userType,
      page: page.toString(),
      limit: pageSize.toString()
    })

    if (userId) params.set('user_id', userId)
    if (filters.searchTerm) params.set('search', filters.searchTerm)
    if (filters.engagementStatus && filters.engagementStatus !== 'all') {
      params.set('engagement_status', filters.engagementStatus)
    }
    if (filters.appointmentFilter && filters.appointmentFilter !== 'all') {
      params.set('appointment_filter', filters.appointmentFilter)
    }
    if (filters.meetingLinkFilter && filters.meetingLinkFilter !== 'all') {
      params.set('meeting_link_filter', filters.meetingLinkFilter)
    }
    if (filters.organizationId && filters.organizationId !== 'all') {
      params.set('organization_id', filters.organizationId)
    }
    if (filters.providerId && filters.providerId !== 'all') {
      params.set('provider_id', filters.providerId)
    }
    if (filters.payerId && filters.payerId !== 'all') {
      params.set('payer_id', filters.payerId)
    }
    if (filters.caseManagerId && filters.caseManagerId !== 'all') {
      params.set('case_manager_id', filters.caseManagerId)
    }
    if (filters.filterType && filters.filterType !== 'all') {
      params.set('filter_type', filters.filterType)
    }
    if (filters.showTestPatients !== undefined) {
      params.set('show_test_patients', filters.showTestPatients.toString())
    }

    return `/api/patients/roster?${params.toString()}`
  }, [userType, userId, filters, page, pageSize])

  // Track retry count for error display
  const [retryCount, setRetryCount] = useState(0)

  // Track if we've ever successfully loaded data (for initial skeleton vs filter loading)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  // SWR data fetching with caching and retry logic
  const { data, error, mutate, isValidating } = useSWR<PatientRosterResponse>(
    apiUrl,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 30000, // 30 seconds
      errorRetryCount: 3, // Retry up to 3 times on failure
      errorRetryInterval: 2000, // Start with 2 second delay
      shouldRetryOnError: true,
      keepPreviousData: true, // Keep showing old data while fetching new data
      onSuccess: (responseData) => {
        setRetryCount(0) // Reset retry count on success
        setHasLoadedOnce(true) // Mark that we've loaded data at least once
        if (page === 1) {
          setAllPatients(responseData.patients)
        } else if (page > 1) {
          setAllPatients(prev => [...prev, ...responseData.patients])
        }
      },
      onError: (err) => {
        console.error('Patient roster fetch error:', err)
        setRetryCount(prev => prev + 1)
      }
    }
  )

  // Only show full loading skeleton on initial load, not on filter changes
  const loading = !hasLoadedOnce && !data && !error

  // Pagination helpers
  const totalPages = data?.pagination?.totalPages || 0
  const hasMore = data?.pagination?.hasMore || false

  const loadMore = useCallback(() => {
    if (hasMore) {
      setPage(prev => prev + 1)
    }
  }, [hasMore])

  const resetPagination = useCallback(() => {
    setPage(1)
    // Don't clear allPatients here - let the new data replace it in onSuccess
    // This prevents the "No patients" flash while filtering
  }, [])

  // Filter management
  const updateFilter = useCallback(<K extends keyof RosterFilters>(
    key: K,
    value: RosterFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    resetPagination()
  }, [resetPagination])

  const resetFilters = useCallback(() => {
    setFilters({
      searchTerm: '',
      engagementStatus: 'active',
      appointmentFilter: 'all',
      meetingLinkFilter: 'all',
      organizationId: 'all',
      providerId: 'all',
      payerId: 'all',
      caseManagerId: 'all',
      filterType: 'all',
      showTestPatients: false,
      sortColumn: null,
      sortDirection: null,
      page: 1,
      limit: pageSize
    })
    setSortColumn(null)
    setSortDirection(null)
    resetPagination()
  }, [pageSize, resetPagination])

  // Sorting (client-side)
  const handleSort = useCallback((column: SortColumn) => {
    if (sortColumn === column) {
      // Cycle through: asc -> desc -> null (unsorted)
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortDirection(null)
        setSortColumn(null)
      }
    } else {
      // New column, start with ascending
      setSortColumn(column)
      setSortDirection('asc')
    }
  }, [sortColumn, sortDirection])

  // Refresh helper
  const refresh = useCallback(async () => {
    setPage(1)
    // Don't clear allPatients - let keepPreviousData show current data while refreshing
    await mutate()
  }, [mutate])

  // Apply client-side sorting to the patients array
  // Use data?.patients directly when available, falling back to allPatients for pagination
  const patientsToSort = page === 1 ? (data?.patients || allPatients) : allPatients

  const sortedPatients = useMemo(() => {
    if (!sortColumn || !sortDirection) return patientsToSort

    return [...patientsToSort].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortColumn) {
        case 'name':
          aValue = `${a.first_name} ${a.last_name}`.toLowerCase()
          bValue = `${b.first_name} ${b.last_name}`.toLowerCase()
          break
        case 'status':
          aValue = a.engagement_status
          bValue = b.engagement_status
          break
        case 'previous':
          aValue = a.previous_appointment?.start_time
            ? new Date(a.previous_appointment.start_time).getTime()
            : 0
          bValue = b.previous_appointment?.start_time
            ? new Date(b.previous_appointment.start_time).getTime()
            : 0
          break
        case 'next':
          aValue = a.next_appointment?.start_time
            ? new Date(a.next_appointment.start_time).getTime()
            : Number.MAX_SAFE_INTEGER
          bValue = b.next_appointment?.start_time
            ? new Date(b.next_appointment.start_time).getTime()
            : Number.MAX_SAFE_INTEGER
          break
        case 'provider':
          aValue = a.primary_provider
            ? `${a.primary_provider.first_name} ${a.primary_provider.last_name}`.toLowerCase()
            : ''
          bValue = b.primary_provider
            ? `${b.primary_provider.first_name} ${b.primary_provider.last_name}`.toLowerCase()
            : ''
          break
        case 'payer':
          aValue = a.primary_payer?.name?.toLowerCase() || ''
          bValue = b.primary_payer?.name?.toLowerCase() || ''
          break
        case 'organization':
          aValue = a.affiliation_details?.[0]?.org_name?.toLowerCase() || ''
          bValue = b.affiliation_details?.[0]?.org_name?.toLowerCase() || ''
          break
        case 'caseManager':
          aValue = a.case_manager_name?.toLowerCase() || ''
          bValue = b.case_manager_name?.toLowerCase() || ''
          break
        case 'contact':
          aValue = (a.email || a.phone || '').toLowerCase()
          bValue = (b.email || b.phone || '').toLowerCase()
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [patientsToSort, sortColumn, sortDirection])

  return {
    patients: sortedPatients,
    stats: data?.stats || { total: 0, active: 0, no_future_appointment: 0 },
    loading,
    error: error || null,
    isValidating,
    retryCount,
    page,
    totalPages,
    hasMore,
    loadMore,
    resetPagination,
    filters,
    updateFilter,
    resetFilters,
    sortColumn,
    sortDirection,
    handleSort,
    mutate,
    refresh
  }
}
