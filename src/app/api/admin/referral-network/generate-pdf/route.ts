// Referral Network PDF Generation API
// POST /api/admin/referral-network/generate-pdf - Generate and store PDF document

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { renderToBuffer } from '@react-pdf/renderer'
import { ReferralListPDF } from '@/lib/pdf/ReferralListTemplate'
import type { GeneratePDFRequest, GeneratePDFResponse, ReferralOrganization } from '@/types/referral-network'

async function verifyAdminAccess() {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user || !isAdminEmail(user.email || '')) {
      return { authorized: false, user: null, email: null }
    }

    return { authorized: true, user, email: user.email }
  } catch (error) {
    console.error('Admin verification error:', error)
    return { authorized: false, user: null, email: null }
  }
}

// POST - Generate PDF document
export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const { authorized, email } = await verifyAdminAccess()
    if (!authorized || !email) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json() as GeneratePDFRequest
    const { search_criteria, organizations, payer_name, care_type_names, specialty_tag_names } = body

    // Validate required fields
    if (!search_criteria || !organizations || !payer_name || !care_type_names) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log('📄 Generating referral PDF for:', email, {
      payer: payer_name,
      careTypes: care_type_names.length,
      orgs: organizations.length
    })

    // Generate timestamp for file naming and display
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-')
    const displayDate = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      ReferralListPDF({
        payerName: payer_name,
        careTypeNames: care_type_names,
        specialtyTagNames: specialty_tag_names,
        organizations: organizations as ReferralOrganization[],
        generatedBy: email,
        generatedAt: displayDate
      })
    )

    // Create storage path
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const storagePath = `referral-lists/${year}/${month}/referral-${timestamp}.pdf`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('referral-documents')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false
      })

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError)
      // Continue without storage - we can still return the PDF
    }

    // Get signed URL for download (24 hour expiry)
    let pdfUrl: string | undefined
    if (!uploadError) {
      const { data: signedUrlData } = await supabaseAdmin.storage
        .from('referral-documents')
        .createSignedUrl(storagePath, 60 * 60 * 24) // 24 hours

      pdfUrl = signedUrlData?.signedUrl
    }

    // Count contacts
    const contactCount = organizations.reduce((count, org) => {
      return count + (org.primary_contact_name ? 1 : 0)
    }, 0)

    // Log the generation to audit table
    const { data: logEntry, error: logError } = await supabaseAdmin
      .from('referral_document_logs')
      .insert({
        generated_by_email: email,
        payer_id: search_criteria.payer_id,
        payer_name: payer_name,
        care_type_ids: search_criteria.care_type_ids,
        care_type_names: care_type_names,
        specialty_tag_ids: search_criteria.specialty_tag_ids || [],
        specialty_tag_names: specialty_tag_names || [],
        organization_count: organizations.length,
        contact_count: contactCount,
        output_format: 'pdf',
        pdf_storage_path: uploadError ? null : storagePath,
        search_criteria: search_criteria
      })
      .select('id')
      .single()

    if (logError) {
      console.error('Error logging PDF generation:', logError)
      // Continue - logging failure shouldn't block PDF delivery
    }

    console.log('✅ PDF generated successfully:', {
      logId: logEntry?.id,
      path: storagePath,
      orgs: organizations.length
    })

    // If we couldn't upload to storage, return the PDF directly as base64
    if (!pdfUrl) {
      const base64 = Buffer.from(pdfBuffer).toString('base64')
      return NextResponse.json({
        success: true,
        pdf_base64: base64,
        log_id: logEntry?.id,
        message: 'PDF generated but storage upload failed. Use pdf_base64 for download.'
      } as GeneratePDFResponse & { pdf_base64: string, message: string })
    }

    const response: GeneratePDFResponse = {
      success: true,
      pdf_url: pdfUrl,
      log_id: logEntry?.id
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('PDF generation API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
