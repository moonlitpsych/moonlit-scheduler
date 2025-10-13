/**
 * IntakeQ Questionnaire Service - V2.0
 *
 * Manages guaranteed intake form sending with:
 * - General vs Medicaid questionnaire routing
 * - Immediate send after appointment creation
 * - Non-blocking with email fallback
 * - Audit trail logging
 */

import { intakeQService } from './intakeQService'
import { supabaseAdmin } from '@/lib/supabase'
import { logIntakeqSync } from './intakeqAudit'
import { sendEmail } from './emailService'

// Questionnaire IDs from requirements
const QUESTIONNAIRE_IDS = {
  GENERAL: '67632ecd93139e4c43407617',
  MEDICAID: '6823985dba25b046d739b9c6'
} as const

export interface QuestionnaireRequest {
  intakeqClientId: string
  clientEmail: string
  clientName: string
  payerId: string
  appointmentId?: string
  practitionerId?: string
}

export interface QuestionnaireResult {
  success: boolean
  questionnaireId: string
  questionnaireName: 'general' | 'medicaid'
  error?: string
}

/**
 * Determine if a payer is Medicaid based on DB mapping
 */
async function isMedicaidPayer(payerId: string): Promise<boolean> {
  try {
    // V2.0: Check for explicit Medicaid flag in payer_external_mappings
    const { data: medicaidFlag } = await supabaseAdmin
      .from('payer_external_mappings')
      .select('value')
      .eq('payer_id', payerId)
      .eq('system', 'practiceq')
      .eq('key_name', 'questionnaire_type')
      .single()

    if (medicaidFlag?.value === 'medicaid') {
      console.log(`✅ Identified as Medicaid payer by mapping`)
      return true
    }

    // Fallback: Check network type in provider_payer_networks
    const { data: networkData } = await supabaseAdmin
      .from('provider_payer_networks')
      .select('network_status')
      .eq('payer_id', payerId)
      .eq('network_status', 'medicaid')
      .limit(1)
      .single()

    if (networkData) {
      console.log(`✅ Identified as Medicaid payer by network status`)
      return true
    }

    console.log(`ℹ️ Identified as commercial payer`)
    return false

  } catch (error) {
    console.error('❌ Error checking Medicaid payer:', error)
    return false // Default to general questionnaire on error
  }
}

/**
 * Send questionnaire immediately after appointment creation
 */
export async function sendIntakeQuestionnaire(
  request: QuestionnaireRequest
): Promise<QuestionnaireResult> {
  const startTime = Date.now()

  try {
    // Determine which questionnaire to send
    const isMedicaid = await isMedicaidPayer(request.payerId)
    const questionnaireId = isMedicaid ? QUESTIONNAIRE_IDS.MEDICAID : QUESTIONNAIRE_IDS.GENERAL
    const questionnaireName = isMedicaid ? 'medicaid' : 'general'

    console.log(`📋 Sending ${questionnaireName} questionnaire ${questionnaireId} to ${request.clientEmail}`)

    // Send via IntakeQ API
    const payload = {
      QuestionnaireId: questionnaireId,
      ClientId: request.intakeqClientId, // Use client ID, not email
      ClientName: request.clientName,
      ClientEmail: request.clientEmail
    }

    if (request.practitionerId) {
      payload.PractitionerId = request.practitionerId
    }

    // Make the API call (using existing intakeQService method)
    await intakeQService.sendQuestionnaire({
      questionnaireId,
      clientName: request.clientName,
      clientEmail: request.clientEmail,
      practitionerId: request.practitionerId
    })

    console.log(`✅ ${questionnaireName} questionnaire sent successfully`)

    // Log success to audit trail
    await logIntakeqSync({
      action: 'send_questionnaire',
      status: 'success',
      appointmentId: request.appointmentId || null,
      intakeqClientId: request.intakeqClientId,
      payload,
      response: { questionnaireId, questionnaireName },
      durationMs: Date.now() - startTime
    })

    return {
      success: true,
      questionnaireId,
      questionnaireName
    }

  } catch (error: any) {
    console.error('❌ Failed to send questionnaire:', error)

    // Log failure to audit trail
    await logIntakeqSync({
      action: 'send_questionnaire',
      status: 'failed',
      appointmentId: request.appointmentId || null,
      intakeqClientId: request.intakeqClientId,
      error: error.message,
      durationMs: Date.now() - startTime
    })

    // Send urgent email notification about failure
    try {
      await sendEmail({
        to: 'miriam@trymoonlit.com',
        subject: '⚠️ Urgent: Intake Questionnaire Send Failed',
        html: `
          <p><strong>Failed to send intake questionnaire after booking</strong></p>
          <p>Patient: ${request.clientName} (${request.clientEmail})</p>
          <p>IntakeQ Client ID: ${request.intakeqClientId}</p>
          <p>Appointment ID: ${request.appointmentId || 'Not provided'}</p>
          <p>Error: ${error.message}</p>
          <p><strong>Action Required:</strong> Please manually send the intake questionnaire from IntakeQ.</p>
        `
      })
    } catch (emailError) {
      console.error('❌ Failed to send failure notification email:', emailError)
    }

    return {
      success: false,
      questionnaireId: isMedicaidPayer(request.payerId) ? QUESTIONNAIRE_IDS.MEDICAID : QUESTIONNAIRE_IDS.GENERAL,
      questionnaireName: isMedicaidPayer(request.payerId) ? 'medicaid' : 'general',
      error: error.message
    }
  }
}

/**
 * Build intake questionnaire URL directly (backup method)
 * This can be used if the API send fails
 */
export function buildQuestionnaireUrl(
  questionnaireId: string,
  clientEmail: string,
  clientName: string
): string {
  // IntakeQ questionnaire URLs typically follow this pattern
  // This is a backup method if API sending fails
  const params = new URLSearchParams({
    q: questionnaireId,
    email: clientEmail,
    name: clientName
  })

  return `https://intakeq.com/new/${questionnaireId}?${params.toString()}`
}