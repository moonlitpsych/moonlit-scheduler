import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to check which environment variables are set
 * WITHOUT exposing their values (security)
 */
export async function GET() {
  const envVars = {
    // Core Infrastructure
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,

    // IntakeQ
    INTAKEQ_API_KEY: !!process.env.INTAKEQ_API_KEY,
    INTAKEQ_API_KEY_LENGTH: process.env.INTAKEQ_API_KEY?.length || 0,

    // Email
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    FROM_EMAIL: !!process.env.FROM_EMAIL,

    // Feature Flags
    INTAKE_HIDE_NON_INTAKE_PROVIDERS: process.env.INTAKE_HIDE_NON_INTAKE_PROVIDERS,
    PRACTICEQ_ENRICH_ENABLED: process.env.PRACTICEQ_ENRICH_ENABLED,
    PRACTICEQ_SEND_QUESTIONNAIRE_ON_CREATE: process.env.PRACTICEQ_SEND_QUESTIONNAIRE_ON_CREATE,
    PRACTICEQ_ALIAS_EMAILS_FOR_DUPLICATES: process.env.PRACTICEQ_ALIAS_EMAILS_FOR_DUPLICATES,
    BOOKING_AUTO_REFRESH_ENABLED: process.env.BOOKING_AUTO_REFRESH_ENABLED,
    PRACTICEQ_DUPLICATE_ALERTS_ENABLED: process.env.PRACTICEQ_DUPLICATE_ALERTS_ENABLED,

    // Google Meet
    GOOGLE_MEET_SERVICE_ACCOUNT_KEY: !!process.env.GOOGLE_MEET_SERVICE_ACCOUNT_KEY,
    GOOGLE_MEET_IMPERSONATE_EMAIL: process.env.GOOGLE_MEET_IMPERSONATE_EMAIL,
    GOOGLE_WORKSPACE_DOMAIN: process.env.GOOGLE_WORKSPACE_DOMAIN,

    // Public URLs
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_BOOK_NAV_PATH: process.env.NEXT_PUBLIC_BOOK_NAV_PATH,

    // Optional integrations
    ATHENA_BASE_URL: !!process.env.ATHENA_BASE_URL,
    ATHENA_CLIENT_ID: !!process.env.ATHENA_CLIENT_ID,
    UHIN_USERNAME: !!process.env.UHIN_USERNAME,

    // Security/Cron
    CALENDAR_TOKEN_SECRET: !!process.env.CALENDAR_TOKEN_SECRET,
    CRON_SECRET: !!process.env.CRON_SECRET,

    // Environment
    NODE_ENV: process.env.NODE_ENV,
    TZ: process.env.TZ,
  }

  // Count missing critical vars
  const criticalVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'INTAKEQ_API_KEY',
    'RESEND_API_KEY',
    'INTAKE_HIDE_NON_INTAKE_PROVIDERS',
    'PRACTICEQ_ENRICH_ENABLED',
  ]

  const missing = criticalVars.filter(key => !envVars[key as keyof typeof envVars])
  const warnings = []

  // Check for common issues
  if (envVars.INTAKEQ_API_KEY_LENGTH !== 40) {
    warnings.push(`INTAKEQ_API_KEY length is ${envVars.INTAKEQ_API_KEY_LENGTH}, expected 40 (possible Next.js bug)`)
  }

  if (!envVars.GOOGLE_MEET_SERVICE_ACCOUNT_KEY) {
    warnings.push('GOOGLE_MEET_SERVICE_ACCOUNT_KEY not set - telehealth Google Meet links will not be generated')
  }

  if (!envVars.CALENDAR_TOKEN_SECRET) {
    warnings.push('CALENDAR_TOKEN_SECRET not set - using default secret (security risk)')
  }

  if (!envVars.CRON_SECRET) {
    warnings.push('CRON_SECRET not set - cron jobs are unprotected')
  }

  if (envVars.INTAKE_HIDE_NON_INTAKE_PROVIDERS !== 'true') {
    warnings.push('INTAKE_HIDE_NON_INTAKE_PROVIDERS is not "true" - providers not accepting new patients will be shown')
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    envVars,
    summary: {
      criticalVarsMissing: missing.length,
      missingVars: missing,
      warnings: warnings
    }
  })
}
