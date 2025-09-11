// src/lib/hooks/useApiRequests.ts
// Custom hook for managing API requests with deduplication, cancellation, and debouncing

import { useCallback, useRef, useEffect } from 'react'

interface RequestOptions extends RequestInit {
  debounceMs?: number
  deduplication?: boolean
  cacheKey?: string
}

interface CachedResponse<T> {
  data: T
  timestamp: number
  expiresAt: number
}

export function useApiRequests() {
  // Store active request controllers for cancellation
  const controllersRef = useRef<Map<string, AbortController>>(new Map())
  
  // Store debounce timeouts
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  
  // Simple in-memory cache for responses
  const cacheRef = useRef<Map<string, CachedResponse<any>>>(new Map())

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel all active requests
      controllersRef.current.forEach(controller => controller.abort())
      controllersRef.current.clear()
      
      // Clear all timeouts
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout))
      timeoutsRef.current.clear()
      
      // Clear cache
      cacheRef.current.clear()
    }
  }, [])

  const generateRequestKey = useCallback((url: string, options?: RequestOptions): string => {
    const method = options?.method || 'GET'
    const body = options?.body || ''
    const cacheKey = options?.cacheKey || ''
    return `${method}:${url}:${body}:${cacheKey}`
  }, [])

  const getCachedResponse = useCallback(<T>(key: string): T | null => {
    const cached = cacheRef.current.get(key)
    if (!cached) return null
    
    if (Date.now() > cached.expiresAt) {
      cacheRef.current.delete(key)
      return null
    }
    
    return cached.data as T
  }, [])

  const setCachedResponse = useCallback(<T>(key: string, data: T, ttlMs: number = 30000): void => {
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs
    })
  }, [])

  const makeRequest = useCallback(async <T>(
    url: string, 
    options: RequestOptions = {}
  ): Promise<T> => {
    const {
      debounceMs = 300,
      deduplication = true,
      cacheKey,
      ...fetchOptions
    } = options

    const requestKey = generateRequestKey(url, options)
    
    // Check cache first
    if (deduplication) {
      const cached = getCachedResponse<T>(requestKey)
      if (cached) {
        console.log(`🎯 Request cache hit: ${requestKey.substring(0, 50)}...`)
        return cached
      }
    }

    return new Promise((resolve, reject) => {
      // Clear existing timeout for this request
      const existingTimeout = timeoutsRef.current.get(requestKey)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
      }

      // Set up debounced request
      const timeout = setTimeout(async () => {
        try {
          // Cancel any existing request with the same key
          const existingController = controllersRef.current.get(requestKey)
          if (existingController) {
            existingController.abort()
          }

          // Create new abort controller
          const controller = new AbortController()
          controllersRef.current.set(requestKey, controller)

          console.log(`📡 Making request: ${url}`)

          // Make the actual request
          const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal,
          })

          // Remove controller on completion
          controllersRef.current.delete(requestKey)
          timeoutsRef.current.delete(requestKey)

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const data = await response.json()

          // Cache successful responses
          if (deduplication) {
            setCachedResponse(requestKey, data, 30000) // 30 second cache
          }

          resolve(data)

        } catch (error) {
          // Clean up on error
          controllersRef.current.delete(requestKey)
          timeoutsRef.current.delete(requestKey)

          if (error instanceof Error && error.name === 'AbortError') {
            console.log(`❌ Request cancelled: ${url}`)
            reject(new Error('Request cancelled'))
          } else {
            console.error(`❌ Request failed: ${url}`, error)
            reject(error)
          }
        }
      }, debounceMs)

      timeoutsRef.current.set(requestKey, timeout)
    })
  }, [generateRequestKey, getCachedResponse, setCachedResponse])

  const cancelRequest = useCallback((url: string, options?: RequestOptions): boolean => {
    const requestKey = generateRequestKey(url, options)
    
    // Cancel timeout
    const timeout = timeoutsRef.current.get(requestKey)
    if (timeout) {
      clearTimeout(timeout)
      timeoutsRef.current.delete(requestKey)
    }

    // Cancel active request
    const controller = controllersRef.current.get(requestKey)
    if (controller) {
      controller.abort()
      controllersRef.current.delete(requestKey)
      return true
    }

    return false
  }, [generateRequestKey])

  const cancelAllRequests = useCallback((): number => {
    let cancelled = 0

    // Cancel all timeouts
    timeoutsRef.current.forEach(timeout => {
      clearTimeout(timeout)
      cancelled++
    })
    timeoutsRef.current.clear()

    // Cancel all active requests
    controllersRef.current.forEach(controller => {
      controller.abort()
      cancelled++
    })
    controllersRef.current.clear()

    if (cancelled > 0) {
      console.log(`🛑 Cancelled ${cancelled} requests`)
    }

    return cancelled
  }, [])

  const getRequestStats = useCallback(() => {
    return {
      activeRequests: controllersRef.current.size,
      pendingRequests: timeoutsRef.current.size,
      cachedResponses: cacheRef.current.size
    }
  }, [])

  const clearCache = useCallback((pattern?: string): number => {
    if (!pattern) {
      const size = cacheRef.current.size
      cacheRef.current.clear()
      return size
    }

    let cleared = 0
    for (const [key] of cacheRef.current) {
      if (key.includes(pattern)) {
        cacheRef.current.delete(key)
        cleared++
      }
    }
    return cleared
  }, [])

  return {
    makeRequest,
    cancelRequest,
    cancelAllRequests,
    getRequestStats,
    clearCache
  }
}

// Utility hook specifically for availability requests
export function useAvailabilityRequests() {
  const { makeRequest, cancelRequest, cancelAllRequests } = useApiRequests()

  const fetchProviders = useCallback(async (
    payerId: string, 
    language: string = 'English'
  ) => {
    return makeRequest(`/api/patient-booking/providers-for-payer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payer_id: payerId, language }),
      debounceMs: 200,
      cacheKey: `providers:${payerId}:${language}`
    })
  }, [makeRequest])

  const fetchAvailability = useCallback(async (
    payerId: string,
    date: string,
    providerId?: string,
    language?: string
  ) => {
    const payload: any = { payer_id: payerId, date }
    if (providerId) payload.provider_id = providerId
    if (language) payload.language = language

    return makeRequest(`/api/patient-booking/merged-availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      debounceMs: 400, // Higher debounce for expensive availability calls
      cacheKey: `availability:${payerId}:${date}:${providerId || 'all'}:${language || 'en'}`
    })
  }, [makeRequest])

  const fetchLanguages = useCallback(async () => {
    return makeRequest(`/api/patient-booking/available-languages`, {
      method: 'GET',
      debounceMs: 100,
      cacheKey: 'languages'
    })
  }, [makeRequest])

  // Cancel requests when switching providers/dates
  const cancelAvailabilityRequests = useCallback(() => {
    // Cancel specific availability-related requests
    cancelRequest('/api/patient-booking/merged-availability')
    cancelRequest('/api/patient-booking/providers-for-payer')
  }, [cancelRequest])

  return {
    fetchProviders,
    fetchAvailability,
    fetchLanguages,
    cancelAvailabilityRequests,
    cancelAllRequests
  }
}