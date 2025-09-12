// src/lib/services/intakeQCache.ts
// In-memory cache for IntakeQ API responses with TTL

interface CacheEntry<T> {
  data: T
  expiresAt: number
  createdAt: number
}

export class IntakeQCache {
  private cache = new Map<string, CacheEntry<any>>()
  private defaultTtlMs: number

  constructor(defaultTtlMs: number = 10 * 60 * 1000) { // 10 minutes default
    this.defaultTtlMs = defaultTtlMs
    
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  private generateKey(providerId: string, date?: string, type: string = 'appointments'): string {
    return `${type}:${providerId}:${date || 'all'}`
  }

  set<T>(providerId: string, data: T, date?: string, ttlMs?: number): void {
    const key = this.generateKey(providerId, date)
    const expiresAt = Date.now() + (ttlMs || this.defaultTtlMs)
    
    this.cache.set(key, {
      data,
      expiresAt,
      createdAt: Date.now()
    })

    // Log cache activity in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`💾 Cached IntakeQ data: ${key} (TTL: ${Math.round((ttlMs || this.defaultTtlMs) / 1000)}s)`)
    }
  }

  get<T>(providerId: string, date?: string): T | null {
    const key = this.generateKey(providerId, date)
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    // Log cache hit in development
    if (process.env.NODE_ENV === 'development') {
      const ageMs = Date.now() - entry.createdAt
      console.log(`🎯 Cache hit: ${key} (age: ${Math.round(ageMs / 1000)}s)`)
    }

    return entry.data
  }

  has(providerId: string, date?: string): boolean {
    const key = this.generateKey(providerId, date)
    const entry = this.cache.get(key)
    
    if (!entry) return false
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return false
    }
    
    return true
  }

  delete(providerId: string, date?: string): boolean {
    const key = this.generateKey(providerId, date)
    return this.cache.delete(key)
  }

  // Clear all cache for a specific provider
  clearProvider(providerId: string): number {
    let cleared = 0
    for (const [key] of this.cache) {
      if (key.includes(`:${providerId}:`)) {
        this.cache.delete(key)
        cleared++
      }
    }
    return cleared
  }

  // Clear all expired entries
  cleanup(): number {
    const now = Date.now()
    let removed = 0
    
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
        removed++
      }
    }
    
    if (removed > 0 && process.env.NODE_ENV === 'development') {
      console.log(`🧹 Cleaned up ${removed} expired IntakeQ cache entries`)
    }
    
    return removed
  }

  // Clear all entries
  clear(): void {
    this.cache.clear()
    if (process.env.NODE_ENV === 'development') {
      console.log('🗑️ Cleared all IntakeQ cache')
    }
  }

  // Get cache statistics
  getStats(): {
    size: number
    totalEntries: number
    expiredEntries: number
    oldestEntryAge: number | null
    newestEntryAge: number | null
  } {
    const now = Date.now()
    let expiredEntries = 0
    let oldestAge: number | null = null
    let newestAge: number | null = null

    for (const [, entry] of this.cache) {
      if (now > entry.expiresAt) {
        expiredEntries++
        continue
      }

      const age = now - entry.createdAt
      if (oldestAge === null || age > oldestAge) {
        oldestAge = age
      }
      if (newestAge === null || age < newestAge) {
        newestAge = age
      }
    }

    return {
      size: this.cache.size,
      totalEntries: this.cache.size,
      expiredEntries,
      oldestEntryAge: oldestAge,
      newestEntryAge: newestAge
    }
  }

  // Cache with automatic retry logic for cache misses
  async getOrFetch<T>(
    providerId: string, 
    date: string | undefined,
    fetcher: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    // Check cache first
    const cached = this.get<T>(providerId, date)
    if (cached !== null) {
      return cached
    }

    // Cache miss - fetch from API
    const data = await fetcher()
    
    // Cache the result
    this.set(providerId, data, date, ttlMs)
    
    return data
  }
}

// Singleton instance
export const intakeQCache = new IntakeQCache(10 * 60 * 1000) // 10 minute default TTL