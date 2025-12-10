/**
 * useFollowUpData Hook
 *
 * Lazy-loads follow-up data for patients after the main roster loads.
 * Makes a separate API call to avoid blocking the initial roster render.
 */

import { useState, useEffect, useCallback } from 'react'
import { FollowUpDetails } from '@/types/patient-roster'

interface UseFollowUpDataOptions {
  patientIds: string[]
  enabled?: boolean
}

interface UseFollowUpDataReturn {
  followUps: Map<string, FollowUpDetails>
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useFollowUpData({
  patientIds,
  enabled = true
}: UseFollowUpDataOptions): UseFollowUpDataReturn {
  const [followUps, setFollowUps] = useState<Map<string, FollowUpDetails>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchFollowUps = useCallback(async () => {
    if (!enabled || patientIds.length === 0) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/patients/roster/follow-ups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ patientIds })
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch follow-ups: ${response.status}`)
      }

      const data = await response.json()

      if (data.followUps) {
        const newFollowUps = new Map<string, FollowUpDetails>()
        for (const [patientId, followUp] of Object.entries(data.followUps)) {
          newFollowUps.set(patientId, followUp as FollowUpDetails)
        }
        setFollowUps(newFollowUps)
      }
    } catch (err: any) {
      console.error('Error fetching follow-up data:', err)
      setError(err)
    } finally {
      setIsLoading(false)
    }
  }, [patientIds, enabled])

  // Fetch when patient IDs change
  useEffect(() => {
    // Only fetch if we have patient IDs and haven't loaded yet
    if (enabled && patientIds.length > 0) {
      fetchFollowUps()
    }
  }, [patientIds.join(','), enabled]) // Join IDs to create stable dependency

  return {
    followUps,
    isLoading,
    error,
    refetch: fetchFollowUps
  }
}
