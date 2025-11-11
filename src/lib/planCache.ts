import type { PayerPlanDisplayData } from '@/types/payer-plans'

const CACHE_PREFIX = 'payer-plans-'
const CACHE_DURATION_MS = 30 * 60 * 1000 // 30 minutes

interface CachedPlanData {
  data: PayerPlanDisplayData
  timestamp: number
}

/**
 * Session storage cache for payer plan data
 *
 * Prevents duplicate API calls when users navigate between payers.
 * Cache is scoped to the browser session and expires after 30 minutes.
 */
export class PlanCache {
  /**
   * Get cached plan data for a payer
   * Returns null if not cached or expired
   */
  static get(payerId: string, providerId?: string): PayerPlanDisplayData | null {
    if (typeof window === 'undefined') return null

    try {
      const key = this.getCacheKey(payerId, providerId)
      const cached = sessionStorage.getItem(key)

      if (!cached) return null

      const { data, timestamp }: CachedPlanData = JSON.parse(cached)

      // Check if expired
      const age = Date.now() - timestamp
      if (age > CACHE_DURATION_MS) {
        sessionStorage.removeItem(key)
        return null
      }

      return data
    } catch (error) {
      console.error('Error reading from plan cache:', error)
      return null
    }
  }

  /**
   * Store plan data in cache
   */
  static set(
    payerId: string,
    data: PayerPlanDisplayData,
    providerId?: string
  ): void {
    if (typeof window === 'undefined') return

    try {
      const key = this.getCacheKey(payerId, providerId)
      const cachedData: CachedPlanData = {
        data,
        timestamp: Date.now()
      }

      sessionStorage.setItem(key, JSON.stringify(cachedData))
    } catch (error) {
      console.error('Error writing to plan cache:', error)
      // Silently fail - caching is an optimization, not critical
    }
  }

  /**
   * Clear cached data for a specific payer
   */
  static clear(payerId: string, providerId?: string): void {
    if (typeof window === 'undefined') return

    try {
      const key = this.getCacheKey(payerId, providerId)
      sessionStorage.removeItem(key)
    } catch (error) {
      console.error('Error clearing plan cache:', error)
    }
  }

  /**
   * Clear all cached plan data
   */
  static clearAll(): void {
    if (typeof window === 'undefined') return

    try {
      // Get all keys and remove ones matching our prefix
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key?.startsWith(CACHE_PREFIX)) {
          sessionStorage.removeItem(key)
        }
      }
    } catch (error) {
      console.error('Error clearing all plan caches:', error)
    }
  }

  /**
   * Generate cache key from payer ID and optional provider ID
   */
  private static getCacheKey(payerId: string, providerId?: string): string {
    return providerId
      ? `${CACHE_PREFIX}${payerId}-${providerId}`
      : `${CACHE_PREFIX}${payerId}`
  }
}
