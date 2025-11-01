/**
 * Medication Report Service
 * Generates PDF medication reports for partner organizations
 */

import { supabaseAdmin } from '@/lib/supabase'
import { intakeQService } from './intakeQService'
import { parseMedicationsFromNote } from '@/lib/utils/medicationParser'
import { renderToBuffer } from '@react-pdf/renderer'
import { MedicationReportPDF } from '@/lib/pdf/MedicationReportTemplate'
import React from 'react'

export interface GenerateMedicationReportParams {
  patientId: string
  appointmentId: string
  generatedBy?: string // partner_user_id
}

export interface MedicationReportResult {
  success: boolean
  reportId?: string
  pdfUrl?: string
  hasChanges: boolean
  noChangeIndicator: boolean
  error?: string
}

export async function generateMedicationReport(
  params: GenerateMedicationReportParams
): Promise<MedicationReportResult> {
  console.log('📋 Starting medication report generation...', params)

  try {
    // 1. Fetch patient data
    const { data: patient, error: patientError } = await supabaseAdmin
      .from('patients')
      .select('id, first_name, last_name, practiceq_client_id')
      .eq('id', params.patientId)
      .single()

    if (patientError || !patient) {
      throw new Error(`Patient not found: ${patientError?.message}`)
    }

    console.log(`✅ Patient: ${patient.first_name} ${patient.last_name}`)

    // 2. Fetch appointment data
    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from('appointments')
      .select('id, start_time, status, provider_id')
      .eq('id', params.appointmentId)
      .single()

    if (appointmentError || !appointment) {
      throw new Error(`Appointment not found: ${appointmentError?.message}`)
    }

    if (appointment.status !== 'completed') {
      throw new Error('Appointment must be completed to generate medication report')
    }

    console.log(`✅ Appointment: ${appointment.start_time} (${appointment.status})`)

    // 3. Fetch provider data
    const { data: provider, error: providerError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, title, role')
      .eq('id', appointment.provider_id)
      .single()

    if (providerError || !provider) {
      throw new Error(`Provider not found: ${providerError?.message}`)
    }

    const providerCredentials = provider.title || provider.role || 'MD'
    console.log(`✅ Provider: ${provider.first_name} ${provider.last_name}, ${providerCredentials}`)

    // 4. Fetch organization data
    const { data: affiliation, error: affiliationError } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('organization_id, organizations(id, name)')
      .eq('patient_id', params.patientId)
      .eq('status', 'active')
      .single()

    if (affiliationError || !affiliation) {
      throw new Error(`No active organization affiliation found`)
    }

    const organization = (affiliation.organizations as any)

    console.log(`✅ Organization: ${organization.name}`)

    // 5. Fetch IntakeQ notes if patient has client ID
    let medicationData: any = {
      hasChanges: false,
      noChangeIndicator: false,
      changes: [],
      previousMedications: [],
      currentMedications: []
    }

    if (patient.practiceq_client_id) {
      console.log(`📋 Fetching IntakeQ notes for client ${patient.practiceq_client_id}...`)

      // Get notes with "locked" status (Tati's finalized notes)
      const notes = await intakeQService.getClientNotes(patient.practiceq_client_id, {
        limit: 5
      })

      console.log(`   Found ${notes.length} note(s)`)

      // Filter for locked notes only
      const lockedNotes = notes.filter(note => note.Status === 'locked')
      console.log(`   ${lockedNotes.length} locked note(s)`)

      if (lockedNotes.length > 0) {
        // Get full content of most recent note
        const recentNote = await intakeQService.getNote(lockedNotes[0].Id)
        console.log(`   Retrieved full note: ${recentNote.Id}`)

        // Parse medication data
        medicationData = parseMedicationsFromNote(recentNote)
        console.log(`   Parsed medications: ${medicationData.changes.length} changes detected`)
      } else {
        console.log('   ⚠️ No locked notes found')
      }
    } else {
      console.log('⚠️ Patient has no IntakeQ client ID - using database fallback')
    }

    // 6. Generate PDF
    console.log('📄 Generating PDF...')

    const pdfData = {
      patientName: `${patient.first_name} ${patient.last_name}`,
      appointmentDate: new Date(appointment.start_time).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      providerName: `${provider.first_name} ${provider.last_name}`,
      providerCredentials,
      organizationName: organization.name,
      medicationChanges: medicationData.changes,
      hasChanges: medicationData.hasChanges,
      noChangeIndicator: medicationData.noChangeIndicator,
      previousMedications: medicationData.previousMedications,
      currentMedications: medicationData.currentMedications
    }

    const pdfBuffer = await renderToBuffer(React.createElement(MedicationReportPDF, pdfData))

    console.log(`✅ PDF generated: ${pdfBuffer.length} bytes`)

    // 7. Create database record
    const { data: report, error: reportError } = await supabaseAdmin
      .from('medication_reports')
      .insert({
        patient_id: params.patientId,
        organization_id: affiliation.organization_id,
        appointment_id: params.appointmentId,
        provider_id: appointment.provider_id,
        appointment_date: appointment.start_time,
        medication_changes_detected: medicationData.hasChanges,
        status: 'draft',
        generation_method: params.generatedBy ? 'manual' : 'auto_cron',
        generated_by: params.generatedBy || null
      })
      .select()
      .single()

    if (reportError) {
      throw new Error(`Failed to create report record: ${reportError.message}`)
    }

    console.log(`✅ Report record created: ${report.id}`)

    // 8. Upload PDF to Supabase Storage
    const fileName = `${affiliation.organization_id}/${params.patientId}/report-${report.id}.pdf`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('medication-reports')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false
      })

    if (uploadError) {
      throw new Error(`Failed to upload PDF: ${uploadError.message}`)
    }

    console.log(`✅ PDF uploaded: ${fileName}`)

    // 9. Get signed URL
    const { data: signedUrlData } = await supabaseAdmin.storage
      .from('medication-reports')
      .createSignedUrl(fileName, 60 * 60 * 24 * 7) // 7 days

    if (!signedUrlData) {
      throw new Error('Failed to create signed URL')
    }

    // 10. Update report record with PDF info
    await supabaseAdmin
      .from('medication_reports')
      .update({
        pdf_url: fileName,
        pdf_generated_at: new Date().toISOString(),
        status: 'generated'
      })
      .eq('id', report.id)

    console.log('✅ Report generation complete!')

    return {
      success: true,
      reportId: report.id,
      pdfUrl: signedUrlData.signedUrl,
      hasChanges: medicationData.hasChanges,
      noChangeIndicator: medicationData.noChangeIndicator
    }
  } catch (error: any) {
    console.error('❌ Report generation failed:', error.message)
    return {
      success: false,
      hasChanges: false,
      noChangeIndicator: false,
      error: error.message
    }
  }
}
