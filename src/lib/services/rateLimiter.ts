// src/lib/services/rateLimiter.ts
// Production-ready rate limiter with token bucket, queuing, and exponential backoff

interface RateLimiterConfig {
  maxTokens: number      // Maximum tokens in bucket
  refillRate: number     // Tokens per minute
  maxConcurrency: number // Max concurrent requests
  maxQueueSize: number   // Max queued requests
  baseBackoffMs: number  // Base backoff time
  maxBackoffMs: number   // Max backoff time
  jitterFactor: number   // Randomness factor (0-1)
}

interface QueuedRequest {
  resolve: (response: Response) => void
  reject: (error: Error) => void
  url: string
  options: RequestInit
  attempt: number
  enqueuedAt: number
}

export class TokenBucketRateLimiter {
  private config: RateLimiterConfig
  private tokens: number
  private lastRefill: number
  private queue: QueuedRequest[] = []
  private activeRequests = 0
  private isProcessing = false

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = {
      maxTokens: 8,           // Conservative: 8 RPM instead of 10 to leave buffer
      refillRate: 8,          // Refill 8 tokens per minute
      maxConcurrency: 2,      // Max 2 concurrent requests to IntakeQ
      maxQueueSize: 50,       // Max 50 queued requests
      baseBackoffMs: 1000,    // Start with 1 second backoff
      maxBackoffMs: 30000,    // Max 30 seconds backoff
      jitterFactor: 0.3,      // 30% randomness
      ...config
    }
    
    this.tokens = this.config.maxTokens
    this.lastRefill = Date.now()
  }

  private refillTokens(): void {
    const now = Date.now()
    const timePassed = now - this.lastRefill
    
    // Refill tokens based on time passed
    const tokensToAdd = (timePassed / 60000) * this.config.refillRate
    this.tokens = Math.min(this.config.maxTokens, this.tokens + tokensToAdd)
    this.lastRefill = now
  }

  private hasAvailableToken(): boolean {
    this.refillTokens()
    return this.tokens >= 1
  }

  private consumeToken(): boolean {
    if (this.hasAvailableToken()) {
      this.tokens -= 1
      return true
    }
    return false
  }

  private calculateBackoff(attempt: number, retryAfter?: number): number {
    if (retryAfter) {
      return retryAfter * 1000 // Convert seconds to milliseconds
    }

    // Exponential backoff with jitter
    const baseDelay = Math.min(
      this.config.baseBackoffMs * Math.pow(2, attempt - 1),
      this.config.maxBackoffMs
    )
    
    const jitter = baseDelay * this.config.jitterFactor * Math.random()
    return Math.floor(baseDelay + jitter)
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return
    this.isProcessing = true

    while (this.queue.length > 0 && this.activeRequests < this.config.maxConcurrency) {
      if (!this.hasAvailableToken()) {
        // Wait for token refill
        await this.sleep(1000)
        continue
      }

      const request = this.queue.shift()!
      this.activeRequests++
      this.consumeToken()

      // Process request without blocking queue
      this.executeRequest(request).finally(() => {
        this.activeRequests--
        // Continue processing queue
        if (this.queue.length > 0) {
          setImmediate(() => this.processQueue())
        } else {
          this.isProcessing = false
        }
      })
    }

    this.isProcessing = false
  }

  private async executeRequest(request: QueuedRequest): Promise<void> {
    const { url, options, attempt, resolve, reject } = request

    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })

      if (response.status === 429) {
        // Rate limited - retry with backoff
        if (attempt <= 3) {
          const retryAfter = response.headers.get('retry-after')
          const backoffMs = this.calculateBackoff(attempt, retryAfter ? parseInt(retryAfter) : undefined)
          
          console.warn(`🚦 IntakeQ rate limited (attempt ${attempt}/3), retrying in ${backoffMs}ms`)
          
          setTimeout(() => {
            this.queue.unshift({
              ...request,
              attempt: attempt + 1
            })
            this.processQueue()
          }, backoffMs)
          return
        } else {
          reject(new Error(`Rate limit exceeded after ${attempt} attempts`))
          return
        }
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ IntakeQ API error details:', {
          url,
          status: response.status,
          statusText: response.statusText,
          errorText,
          headers: Object.fromEntries(response.headers.entries())
        })
        reject(new Error(`IntakeQ API error: ${response.status} ${response.statusText} - ${errorText}`))
        return
      }

      resolve(response)

    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        reject(new Error('Request timeout after 30 seconds'))
      } else {
        reject(error as Error)
      }
    }
  }

  async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        resolve,
        reject,
        url,
        options,
        attempt: 1,
        enqueuedAt: Date.now()
      }

      // Check queue size
      if (this.queue.length >= this.config.maxQueueSize) {
        reject(new Error('Request queue full. Please try again later.'))
        return
      }

      // Add to queue
      this.queue.push(request)
      
      // Start processing
      this.processQueue()
    })
  }

  getStatus(): {
    tokens: number
    maxTokens: number
    queueLength: number
    activeRequests: number
    isProcessing: boolean
  } {
    this.refillTokens()
    return {
      tokens: Math.floor(this.tokens * 10) / 10, // Round to 1 decimal
      maxTokens: this.config.maxTokens,
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      isProcessing: this.isProcessing
    }
  }

  // Clear expired requests from queue (older than 5 minutes)
  clearStaleRequests(): number {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000)
    const initialLength = this.queue.length
    
    this.queue = this.queue.filter(request => {
      if (request.enqueuedAt < fiveMinutesAgo) {
        request.reject(new Error('Request expired in queue'))
        return false
      }
      return true
    })

    const removed = initialLength - this.queue.length
    if (removed > 0) {
      console.warn(`🧹 Cleared ${removed} stale requests from IntakeQ queue`)
    }
    return removed
  }
}

// Singleton instance for IntakeQ
export const intakeQRateLimiter = new TokenBucketRateLimiter({
  maxTokens: 8,      // Conservative limit
  refillRate: 8,     // 8 requests per minute
  maxConcurrency: 2, // Max 2 concurrent
  maxQueueSize: 30   // Reasonable queue size
})

// Clean up stale requests every 2 minutes
setInterval(() => {
  intakeQRateLimiter.clearStaleRequests()
}, 2 * 60 * 1000)