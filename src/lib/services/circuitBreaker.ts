/**
 * Circuit Breaker implementation for external service calls
 * Prevents cascading failures by failing fast when a service is down
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is down, requests fail immediately
 * - HALF_OPEN: Testing if service has recovered
 */

interface CircuitBreakerConfig {
    name: string
    threshold: number           // Number of failures before opening circuit
    timeout: number             // Time in ms before attempting to close circuit
    windowSize: number          // Time window in ms for counting failures
}

interface CircuitBreakerState {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
    failures: number[]          // Timestamps of recent failures
    lastOpenTime?: number       // When circuit was opened
    consecutiveSuccesses: number
}

class CircuitBreaker {
    private config: CircuitBreakerConfig
    private state: CircuitBreakerState

    constructor(config: CircuitBreakerConfig) {
        this.config = config
        this.state = {
            state: 'CLOSED',
            failures: [],
            consecutiveSuccesses: 0
        }
    }

    /**
     * Execute a function through the circuit breaker
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        // Check if circuit should transition from OPEN to HALF_OPEN
        if (this.state.state === 'OPEN') {
            const now = Date.now()
            if (this.state.lastOpenTime && (now - this.state.lastOpenTime) > this.config.timeout) {
                console.log(`⚡ Circuit breaker [${this.config.name}] transitioning to HALF_OPEN`)
                this.state.state = 'HALF_OPEN'
                this.state.consecutiveSuccesses = 0
            } else {
                // Circuit is still open, fail fast
                console.log(`🚫 Circuit breaker [${this.config.name}] is OPEN - failing fast`)
                throw new Error(`Circuit breaker is OPEN for ${this.config.name}. Service is temporarily unavailable.`)
            }
        }

        try {
            // Execute the function
            const result = await fn()

            // Record success
            this.onSuccess()

            return result

        } catch (error: any) {
            // Record failure
            this.onFailure()

            // Re-throw the error
            throw error
        }
    }

    private onSuccess() {
        if (this.state.state === 'HALF_OPEN') {
            this.state.consecutiveSuccesses++

            // Need 3 consecutive successes to fully close circuit
            if (this.state.consecutiveSuccesses >= 3) {
                console.log(`✅ Circuit breaker [${this.config.name}] transitioning to CLOSED`)
                this.state.state = 'CLOSED'
                this.state.failures = []
                this.state.consecutiveSuccesses = 0
            }
        } else if (this.state.state === 'CLOSED') {
            // Clear old failures on success
            this.cleanOldFailures()
        }
    }

    private onFailure() {
        const now = Date.now()

        if (this.state.state === 'HALF_OPEN') {
            // Single failure in HALF_OPEN reopens circuit immediately
            console.log(`⚡ Circuit breaker [${this.config.name}] reopening - failure in HALF_OPEN state`)
            this.state.state = 'OPEN'
            this.state.lastOpenTime = now
            this.state.consecutiveSuccesses = 0
            return
        }

        // Record failure
        this.state.failures.push(now)
        this.cleanOldFailures()

        // Check if we should open the circuit
        if (this.state.failures.length >= this.config.threshold) {
            console.log(`⚡ Circuit breaker [${this.config.name}] opening - threshold reached (${this.state.failures.length}/${this.config.threshold} failures)`)
            this.state.state = 'OPEN'
            this.state.lastOpenTime = now
        }
    }

    private cleanOldFailures() {
        const now = Date.now()
        const cutoff = now - this.config.windowSize
        this.state.failures = this.state.failures.filter(timestamp => timestamp > cutoff)
    }

    /**
     * Get current circuit state for monitoring
     */
    getState(): { state: string; failures: number; isHealthy: boolean } {
        this.cleanOldFailures()
        return {
            state: this.state.state,
            failures: this.state.failures.length,
            isHealthy: this.state.state === 'CLOSED'
        }
    }

    /**
     * Force reset the circuit breaker (for testing/recovery)
     */
    reset() {
        console.log(`🔄 Circuit breaker [${this.config.name}] manually reset`)
        this.state = {
            state: 'CLOSED',
            failures: [],
            consecutiveSuccesses: 0
        }
    }
}

// Singleton instances for each service
const circuitBreakers = new Map<string, CircuitBreaker>()

/**
 * Get or create a circuit breaker for a service
 */
export function getCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!circuitBreakers.has(name)) {
        const defaultConfig: CircuitBreakerConfig = {
            name,
            threshold: 5,          // Open circuit after 5 failures
            timeout: 30000,        // Try to recover after 30 seconds
            windowSize: 60000,     // Count failures in 1-minute window
            ...config
        }
        circuitBreakers.set(name, new CircuitBreaker(defaultConfig))
    }
    return circuitBreakers.get(name)!
}

/**
 * Specialized circuit breaker for IntakeQ API
 */
export const intakeQCircuitBreaker = getCircuitBreaker('IntakeQ', {
    threshold: 5,              // Open after 5 failures
    timeout: 30000,            // Try recovery after 30 seconds
    windowSize: 60000          // 1-minute failure window
})

/**
 * Health check endpoint data
 */
export function getAllCircuitBreakerStates() {
    const states: Record<string, any> = {}
    circuitBreakers.forEach((breaker, name) => {
        states[name] = breaker.getState()
    })
    return states
}