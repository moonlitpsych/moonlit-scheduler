// src/lib/services/EligibilityService.ts
'use client'

export interface PatientInfo {
    firstName: string
    lastName: string
    dob: string
    email?: string
    phone?: string
}

export interface InsuranceInfo {
    payerId: string
    payerName: string
    payerType?: string
    memberId?: string
    ssnLast4?: string
}

export interface EligibilityResult {
    eligible: boolean
    verified: boolean
    bypassed?: boolean
    currentPlan?: string
    isAccepted?: boolean
    message?: string
    error?: string
}

class EligibilityService {
    private isEnabled: boolean

    constructor() {
        // Check if eligibility checker is enabled via environment variable
        this.isEnabled = process.env.NEXT_PUBLIC_ELIGIBILITY_CHECKER === 'true'
        console.log('🔍 Eligibility Checker:', this.isEnabled ? 'ENABLED' : 'DISABLED')
    }

    /**
     * Check Medicaid eligibility for a patient
     * This will either use the UHIN API or bypass based on configuration
     */
    async checkMedicaidEligibility(
        patientInfo: PatientInfo,
        insuranceInfo: InsuranceInfo
    ): Promise<EligibilityResult> {
        // If checker is disabled, bypass and allow booking
        if (!this.isEnabled) {
            console.log('✅ Eligibility checker disabled - bypassing check')
            return {
                eligible: true,
                verified: false,
                bypassed: true,
                message: 'Eligibility check bypassed (feature disabled)'
            }
        }

        // Check if this is a Medicaid payer
        const isMedicaid = insuranceInfo.payerType?.toLowerCase() === 'medicaid' ||
            insuranceInfo.payerName?.toLowerCase().includes('medicaid')

        if (!isMedicaid) {
            // Non-Medicaid payers don't need eligibility check (for now)
            return {
                eligible: true,
                verified: false,
                bypassed: true,
                message: 'Non-Medicaid payer - no verification required'
            }
        }

        console.log('🔍 Checking Medicaid eligibility for:', patientInfo.firstName, patientInfo.lastName)

        try {
            // Call the UHIN API endpoint
            const response = await fetch('/api/medicaid/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    first: patientInfo.firstName,
                    last: patientInfo.lastName,
                    dob: patientInfo.dob,
                    ssn: insuranceInfo.ssnLast4,
                    medicaidId: insuranceInfo.memberId
                })
            })

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`)
            }

            const result = await response.json()

            // Map the API response to our EligibilityResult format
            return {
                eligible: result.enrolled && result.isAccepted,
                verified: result.verified || false,
                currentPlan: result.currentPlan,
                isAccepted: result.isAccepted,
                message: result.message || (result.enrolled
                    ? `Enrolled in ${result.currentPlan}`
                    : 'No active Medicaid coverage'),
                error: result.error
            }

        } catch (error) {
            console.error('❌ Eligibility check failed:', error)

            // In case of error, we can decide to:
            // 1. Block the booking (return eligible: false)
            // 2. Allow the booking with a warning (return eligible: true with error message)
            // For now, let's allow with warning

            return {
                eligible: true,
                verified: false,
                message: 'Unable to verify eligibility - please have your insurance card ready for your appointment',
                error: 'Verification system temporarily unavailable'
            }
        }
    }

    /**
     * Check if eligibility verification is enabled
     */
    isEligibilityCheckEnabled(): boolean {
        return this.isEnabled
    }

    /**
     * Generic eligibility check for any payer (future expansion)
     */
    async checkEligibility(
        patientInfo: PatientInfo,
        insuranceInfo: InsuranceInfo
    ): Promise<EligibilityResult> {
        // For now, only Medicaid uses eligibility checking
        // In the future, this could route to different APIs based on payer type

        const isMedicaid = insuranceInfo.payerType?.toLowerCase() === 'medicaid' ||
            insuranceInfo.payerName?.toLowerCase().includes('medicaid')

        if (isMedicaid) {
            return this.checkMedicaidEligibility(patientInfo, insuranceInfo)
        }

        // All other payers bypass eligibility check for now
        return {
            eligible: true,
            verified: false,
            bypassed: true,
            message: 'Eligibility check not required for this payer'
        }
    }
}

// Export singleton instance
export const eligibilityService = new EligibilityService()

// Also export the class for testing purposes
export default EligibilityService