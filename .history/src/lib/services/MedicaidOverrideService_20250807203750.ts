// src/lib/services/MedicaidOverrideService.ts
import { supabase as supabaseClient } from '@/lib/supabase'

export interface MedicaidCase {
    id: string
    case_number: string
    access_code?: string
    patient_info: {
        first_name: string
        last_name: string
        dob: string
        email: string
        phone: string
        medicaid_id?: string
    }
    payer_info: {
        payer_id: string
        payer_name: string
        plan_type: string
    }
    status: 'pending' | 'approved' | 'denied' | 'expired'
    staff_notes?: string
    approved_by?: string
    approved_at?: string
    expires_at: string
    created_at: string
}

export class MedicaidOverrideService {
    private supabase = supabaseClient

    /**
     * Generate a unique case number for tracking
     */
    generateCaseNumber(): string {
        const prefix = 'MED'
        const timestamp = Date.now().toString(36).toUpperCase()
        const random = Math.random().toString(36).substring(2, 6).toUpperCase()
        return `${prefix}-${timestamp}-${random}`
    }

    /**
     * Generate a secure but user-friendly access code
     */
    generateAccessCode(): string {
        // Use readable characters only (no 0, O, I, l for clarity)
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        let code = ''
        for (let i = 0; i < 8; i++) {
            if (i === 4) code += '-' // Add hyphen for readability
            code += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return code
    }

    /**
     * Create a new Medicaid verification case
     */
    async createCase(
        patientInfo: MedicaidCase['patient_info'],
        payerInfo: MedicaidCase['payer_info']
    ): Promise<{ caseNumber: string; caseId: string } | null> {
        try {
            const caseNumber = this.generateCaseNumber()
            const expiresAt = new Date()
            expiresAt.setHours(expiresAt.getHours() + 72) // 72-hour expiry

            // Store in eligibility_log table
            const { data, error } = await this.supabase
                .from('eligibility_log')
                .insert({
                    case_number: caseNumber,
                    payer_id: payerInfo.payer_id,
                    payer_name: payerInfo.payer_name,
                    patient_data: {
                        ...patientInfo,
                        plan_type: payerInfo.plan_type
                    },
                    status: 'pending',
                    expires_at: expiresAt.toISOString(),
                    created_at: new Date().toISOString()
                })
                .select()
                .single()

            if (error) {
                console.error('Error creating Medicaid case:', error)
                return null
            }

            // Also create a booking lead for staff tracking
            await this.supabase
                .from('booking_leads')
                .insert({
                    email: patientInfo.email,
                    phone: patientInfo.phone,
                    preferred_name: `${patientInfo.first_name} ${patientInfo.last_name}`,
                    requested_payer_id: payerInfo.payer_id,
                    reason: `Medicaid verification needed - Case #${caseNumber}`,
                    status: 'pending',
                    insurance_effective_date: new Date().toISOString().split('T')[0],
                    staff_notes: `Case Number: ${caseNumber}\nPlan Type: ${payerInfo.plan_type}\nMedicaid ID: ${patientInfo.medicaid_id || 'Not provided'}`,
                    created_at: new Date().toISOString()
                })

            console.log(`Created Medicaid case: ${caseNumber}`)
            return { caseNumber, caseId: data.id }

        } catch (error) {
            console.error('Error in createCase:', error)
            return null
        }
    }

    /**
     * Staff approves a Medicaid case
     */
    async approveCase(
        caseNumber: string,
        staffEmail: string,
        notes?: string
    ): Promise<{ accessCode: string } | null> {
        try {
            // Find the case
            const { data: existingCase, error: findError } = await this.supabase
                .from('eligibility_log')
                .select('*')
                .eq('case_number', caseNumber)
                .single()

            if (findError || !existingCase) {
                console.error('Case not found:', caseNumber)
                return null
            }

            if (existingCase.status !== 'pending') {
                console.error('Case already processed:', existingCase.status)
                return null
            }

            // Generate access code
            const accessCode = this.generateAccessCode()

            // Update the case
            const { error: updateError } = await this.supabase
                .from('eligibility_log')
                .update({
                    status: 'approved',
                    access_code: accessCode,
                    approved_by: staffEmail,
                    approved_at: new Date().toISOString(),
                    override_applied: true,
                    override_reason: notes || 'Manual verification completed',
                    updated_at: new Date().toISOString()
                })
                .eq('case_number', caseNumber)

            if (updateError) {
                console.error('Error approving case:', updateError)
                return null
            }

            // Update the booking lead
            await this.supabase
                .from('booking_leads')
                .update({
                    status: 'approved',
                    staff_notes: `${existingCase.staff_notes || ''}\n\nAPPROVED by ${staffEmail}\nAccess Code: ${accessCode}\n${notes ? `Notes: ${notes}` : ''}`,
                    updated_at: new Date().toISOString()
                })
                .match({
                    email: existingCase.patient_data?.email,
                    status: 'pending'
                })

            console.log(`Approved case ${caseNumber} with access code ${accessCode}`)
            return { accessCode }

        } catch (error) {
            console.error('Error in approveCase:', error)
            return null
        }
    }

    /**
     * Verify an access code and get case details
     */
    async verifyAccessCode(accessCode: string): Promise<MedicaidCase | null> {
        try {
            // Clean the access code (remove spaces, hyphens)
            const cleanCode = accessCode.replace(/[\s-]/g, '').toUpperCase()

            const { data: caseData, error } = await this.supabase
                .from('eligibility_log')
                .select('*')
                .eq('access_code', cleanCode)
                .eq('status', 'approved')
                .single()

            if (error || !caseData) {
                console.error('Invalid or expired access code')
                return null
            }

            // Check if expired
            if (new Date(caseData.expires_at) < new Date()) {
                console.error('Access code expired')
                await this.supabase
                    .from('eligibility_log')
                    .update({ status: 'expired' })
                    .eq('id', caseData.id)
                return null
            }

            // Map to MedicaidCase interface
            return {
                id: caseData.id,
                case_number: caseData.case_number,
                access_code: caseData.access_code,
                patient_info: caseData.patient_data,
                payer_info: {
                    payer_id: caseData.payer_id,
                    payer_name: caseData.payer_name,
                    plan_type: caseData.patient_data?.plan_type || 'Unknown'
                },
                status: caseData.status,
                staff_notes: caseData.override_reason,
                approved_by: caseData.approved_by,
                approved_at: caseData.approved_at,
                expires_at: caseData.expires_at,
                created_at: caseData.created_at
            }

        } catch (error) {
            console.error('Error verifying access code:', error)
            return null
        }
    }

    /**
     * Get pending cases for staff review
     */
    async getPendingCases(): Promise<MedicaidCase[]> {
        try {
            const { data: cases, error } = await this.supabase
                .from('eligibility_log')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true })

            if (error) {
                console.error('Error fetching pending cases:', error)
                return []
            }

            return cases.map(c => ({
                id: c.id,
                case_number: c.case_number,
                patient_info: c.patient_data,
                payer_info: {
                    payer_id: c.payer_id,
                    payer_name: c.payer_name,
                    plan_type: c.patient_data?.plan_type || 'Unknown'
                },
                status: c.status,
                expires_at: c.expires_at,
                created_at: c.created_at
            }))

        } catch (error) {
            console.error('Error in getPendingCases:', error)
            return []
        }
    }

    /**
     * Send notification to patient (SMS/Email)
     */
    async sendApprovalNotification(
        caseNumber: string,
        accessCode: string,
        contactInfo: { email?: string; phone?: string }
    ): Promise<boolean> {
        try {
            // TODO: Integrate with SendGrid/Twilio
            console.log(`Would send notification for case ${caseNumber}:`)
            console.log(`Access Code: ${accessCode}`)
            console.log(`To: ${contactInfo.email || contactInfo.phone}`)

            // For now, just log the notification
            // In production, this would trigger actual SMS/email
            return true

        } catch (error) {
            console.error('Error sending notification:', error)
            return false
        }
    }
}

// Export singleton instance
export const medicaidOverrideService = new MedicaidOverrideService()