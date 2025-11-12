'use client'

import { useState, useEffect } from 'react'
import type { PayerPlanDisplayData, GetPayerPlansResponse } from '@/types/payer-plans'
import { PlanCache } from '@/lib/planCache'

interface UsePayerPlansResult {
  data: PayerPlanDisplayData | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Hook to fetch and cache payer plan data
 *
 * Automatically fetches plans when payerId changes.
 * Uses session storage cache to avoid duplicate API calls.
 *
 * @param payerId - The payer ID to fetch plans for
 * @param providerId - Optional provider ID for provider-specific overrides
 * @param enabled - Whether to fetch data (default: true)
 */
export function usePayerPlans(
  payerId: string | null,
  providerId?: string,
  enabled: boolean = true
): UsePayerPlansResult {
  const [data, setData] = useState<PayerPlanDisplayData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPlans = async () => {
    if (!payerId || !enabled) {
      setData(null)
      return
    }

    // Check cache first
    const cached = PlanCache.get(payerId, providerId)
    if (cached) {
      console.log('✅ Using cached plan data for payer:', payerId)
      setData(cached)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const url = providerId
        ? `/api/payer-plans/${payerId}?providerId=${providerId}`
        : `/api/payer-plans/${payerId}`

      const response = await fetch(url)
      const result: GetPayerPlansResponse = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch plans')
      }

      if (result.data) {
        // Cache the result
        PlanCache.set(payerId, result.data, providerId)
        setData(result.data)
      }
    } catch (err: any) {
      console.error('Error fetching payer plans:', err)
      setError(err.message || 'Failed to load plan information')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [payerId, providerId, enabled])

  return {
    data,
    loading,
    error,
    refetch: fetchPlans
  }
}
