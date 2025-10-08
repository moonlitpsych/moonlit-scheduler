/**
 * Feature Flags Configuration
 *
 * Centralized feature flag management for V2.0 features.
 * All flags default to OFF for safe rollout.
 *
 * Usage:
 *   import { featureFlags } from '@/lib/config/featureFlags'
 *   if (featureFlags.bookingAutoRefresh) { ... }
 */

export interface FeatureFlags {
  /** Enable auto-refresh of availability on filter changes (V2.0) */
  bookingAutoRefresh: boolean

  /** Hide non-intake providers from intake booking flows (V2.0) */
  intakeHideNonIntakeProviders: boolean

  /** Enable enriched IntakeQ client creation with additional fields (V2.0) */
  practiceqEnrich: boolean

  /** Enable duplicate client detection and email alerts (V2.0) */
  practiceqDuplicateAlerts: boolean
}

/**
 * Parse boolean environment variable with safe defaults
 */
function parseBooleanEnv(value: string | undefined, defaultValue: boolean = false): boolean {
  if (value === undefined) return defaultValue
  return value.toLowerCase() === 'true' || value === '1'
}

/**
 * Feature flags singleton
 * Reads from environment variables at runtime
 */
export const featureFlags: FeatureFlags = {
  bookingAutoRefresh: parseBooleanEnv(
    process.env.BOOKING_AUTO_REFRESH_ENABLED,
    false
  ),

  intakeHideNonIntakeProviders: parseBooleanEnv(
    process.env.INTAKE_HIDE_NON_INTAKE_PROVIDERS,
    false
  ),

  practiceqEnrich: parseBooleanEnv(
    process.env.PRACTICEQ_ENRICH_ENABLED,
    false
  ),

  practiceqDuplicateAlerts: parseBooleanEnv(
    process.env.PRACTICEQ_DUPLICATE_ALERTS_ENABLED,
    false
  ),
}

/**
 * Get all feature flags status (for admin debugging)
 */
export function getFeatureFlagsStatus(): Record<string, boolean> {
  return {
    bookingAutoRefresh: featureFlags.bookingAutoRefresh,
    intakeHideNonIntakeProviders: featureFlags.intakeHideNonIntakeProviders,
    practiceqEnrich: featureFlags.practiceqEnrich,
    practiceqDuplicateAlerts: featureFlags.practiceqDuplicateAlerts,
  }
}

/**
 * Environment variable validation helper
 * Call this at app startup to ensure all expected env vars are present
 */
export function validateFeatureFlagEnv(): { valid: boolean; missing: string[] } {
  const requiredEnvVars = [
    'BOOKING_AUTO_REFRESH_ENABLED',
    'INTAKE_HIDE_NON_INTAKE_PROVIDERS',
    'PRACTICEQ_ENRICH_ENABLED',
    'PRACTICEQ_DUPLICATE_ALERTS_ENABLED',
  ]

  const missing = requiredEnvVars.filter(key => process.env[key] === undefined)

  if (missing.length > 0) {
    console.warn('⚠️ Missing feature flag environment variables:', missing)
    console.warn('   Add these to .env.local with values: true | false')
  }

  return {
    valid: missing.length === 0,
    missing
  }
}
