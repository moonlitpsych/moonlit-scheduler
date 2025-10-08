/**
 * IntakeQ Client ID normalization utilities
 *
 * The IntakeQ API expects client IDs as simple numeric strings (e.g., "98").
 * However, we've encountered cases where IDs are stored/passed as JSON objects
 * like {"Id":"98"} or stringified JSON. This module provides normalization
 * to ensure we always use the correct format.
 */

/**
 * Normalizes an IntakeQ client ID to a plain numeric string.
 * Handles multiple input formats:
 * - Plain string: "98" → "98"
 * - Object with Id property: {Id: "98"} → "98"
 * - Stringified JSON: '{"Id":"98"}' → "98"
 * - null/undefined → ""
 *
 * @param raw - The raw client ID value from any source
 * @returns A normalized numeric string, or empty string if invalid
 */
export function normalizeIntakeqClientId(raw: unknown): string {
    // Handle null/undefined
    if (raw == null || raw === '') {
        return ''
    }

    // Handle object with Id property (e.g., {Id: "98"})
    if (typeof raw === 'object') {
        const obj = raw as any
        const idValue = obj.Id ?? obj.id
        if (typeof idValue === 'string' || typeof idValue === 'number') {
            return String(idValue)
        }
        // Object without Id property - invalid
        return ''
    }

    // Handle stringified JSON (e.g., '{"Id":"98"}')
    if (typeof raw === 'string') {
        // Check if it looks like JSON
        const trimmed = raw.trim()
        if (trimmed.startsWith('{')) {
            try {
                const parsed = JSON.parse(trimmed)
                if (parsed && typeof parsed === 'object') {
                    const idValue = parsed.Id ?? parsed.id
                    if (typeof idValue === 'string' || typeof idValue === 'number') {
                        return String(idValue)
                    }
                }
            } catch {
                // Not valid JSON, fall through to treat as plain string
            }
        }
        // Plain string (already correct format)
        return trimmed
    }

    // Handle number
    if (typeof raw === 'number') {
        return String(raw)
    }

    // Unknown type - convert to string as fallback
    return String(raw)
}

/**
 * Validates that a client ID is in the correct format for IntakeQ API.
 * Expected format: numeric string (e.g., "98", "12345")
 *
 * @param clientId - The client ID to validate
 * @returns true if valid, false otherwise
 */
export function isValidIntakeqClientId(clientId: string): boolean {
    if (!clientId || typeof clientId !== 'string') {
        return false
    }
    // Must be a numeric string
    return /^\d+$/.test(clientId)
}

/**
 * Asserts that a client ID is valid, throwing an error if not.
 * Use this right before making IntakeQ API calls to catch malformed IDs early.
 *
 * @param clientId - The client ID to validate
 * @throws Error if client ID is invalid
 */
export function assertValidIntakeqClientId(clientId: string): asserts clientId is string {
    if (!isValidIntakeqClientId(clientId)) {
        throw new Error(
            `Invalid IntakeQ client ID format: "${clientId}". ` +
            `Expected numeric string (e.g., "98"), got: ${typeof clientId}`
        )
    }
}
