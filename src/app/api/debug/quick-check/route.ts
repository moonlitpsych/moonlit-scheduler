import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    criticalFlags: {
      INTAKE_HIDE_NON_INTAKE_PROVIDERS: process.env.INTAKE_HIDE_NON_INTAKE_PROVIDERS || 'NOT SET',
      PRACTICEQ_ENRICH_ENABLED: process.env.PRACTICEQ_ENRICH_ENABLED || 'NOT SET',
      PRACTICEQ_SEND_QUESTIONNAIRE_ON_CREATE: process.env.PRACTICEQ_SEND_QUESTIONNAIRE_ON_CREATE || 'NOT SET',
    },
    integrations: {
      INTAKEQ_API_KEY_LENGTH: process.env.INTAKEQ_API_KEY?.length || 0,
      RESEND_API_KEY_SET: !!process.env.RESEND_API_KEY,
      FROM_EMAIL: process.env.FROM_EMAIL || 'NOT SET',
    },
    warnings: [
      process.env.INTAKE_HIDE_NON_INTAKE_PROVIDERS !== 'true' && 'INTAKE_HIDE_NON_INTAKE_PROVIDERS must be "true"',
      (process.env.INTAKEQ_API_KEY?.length || 0) !== 40 && `INTAKEQ_API_KEY is ${process.env.INTAKEQ_API_KEY?.length || 0} chars (should be 40)`,
      !process.env.FROM_EMAIL && 'FROM_EMAIL not set',
    ].filter(Boolean)
  })
}
