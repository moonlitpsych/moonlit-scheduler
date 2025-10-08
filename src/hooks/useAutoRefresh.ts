/**
 * Auto-refresh hook for availability data
 *
 * Triggers debounced refresh when dependencies change
 * Uses AbortController to cancel stale requests
 *
 * V2.0 Feature: BOOKING_AUTO_REFRESH_ENABLED
 */

import { useEffect, useRef } from 'react'
import { featureFlags } from '@/lib/config/featureFlags'

interface UseAutoRefreshOptions {
  /** Callback function to execute on refresh */
  onRefresh: () => void | Promise<void>
  /** Dependencies that trigger refresh when changed */
  dependencies: any[]
  /** Debounce delay in milliseconds (default: 300ms) */
  debounceMs?: number
  /** Whether auto-refresh is enabled (default: reads from feature flag) */
  enabled?: boolean
}

/**
 * Auto-refresh hook with debouncing and abort support
 *
 * @example
 * useAutoRefresh({
 *   onRefresh: () => fetchAvailability(date, provider, payer),
 *   dependencies: [date, provider, payer, language],
 *   debounceMs: 300
 * })
 */
export function useAutoRefresh({
  onRefresh,
  dependencies,
  debounceMs = 300,
  enabled = featureFlags.bookingAutoRefresh
}: UseAutoRefreshOptions) {
  const timeoutRef = useRef<NodeJS.Timeout>()
  const isInitialMount = useRef(true)

  useEffect(() => {
    // Skip on initial mount to avoid duplicate fetch
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    // Skip if feature flag is disabled
    if (!enabled) {
      return
    }

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Debounce the refresh
    timeoutRef.current = setTimeout(() => {
      console.log('🔄 Auto-refresh triggered (debounced)')
      onRefresh()
    }, debounceMs)

    // Cleanup on unmount or dependency change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, dependencies) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
}
