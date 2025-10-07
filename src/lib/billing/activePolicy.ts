import { supabaseAdmin } from '@/lib/supabase'

export interface PayerSnapshot {
    id: string
    name: string
    type: string
    network_status?: string
    effective_date?: string
    termination_date?: string
}

export interface MemberSnapshot {
    member_id: string
    group_number?: string
    policy_holder_name?: string
    policy_holder_dob?: string
    relationship_to_insured?: string
    coverage_type?: string
}

export interface ActivePolicyResult {
    policyId: string
    payerSnapshot: PayerSnapshot
    memberSnapshot: MemberSnapshot
}

/**
 * Gets the active insurance policy for a patient at a specific time.
 * DEV-ONLY: Creates a synthetic policy from payer data until we have a real policy table.
 */
export async function getActivePolicy(patientId: string, at?: Date, payerId?: string): Promise<ActivePolicyResult> {
    try {
        const atTimestamp = at ? at.toISOString() : new Date().toISOString()
        console.log(`🔍 Getting active policy for patient ${patientId} at ${atTimestamp}`)

        // DEV-ONLY: Create synthetic policy from payer
        if (!payerId) {
            console.error(`❌ No payerId provided (policy table doesn't exist yet)`)
            const noPolicyError = new Error(`No active insurance policy found for patient ${patientId}`)
            ;(noPolicyError as any).status = 404
            ;(noPolicyError as any).code = 'NO_ACTIVE_POLICY_FOR_PAYER'
            throw noPolicyError
        }

        // Query payer details
        const { data: payer, error: payerError } = await supabaseAdmin
            .from('payers')
            .select('id, name, payer_type, state')
            .eq('id', payerId)
            .single()

        if (payerError || !payer) {
            console.error('❌ Error querying payer:', payerError)
            const noPolicyError = new Error(`No active insurance policy found for patient ${patientId}`)
            ;(noPolicyError as any).status = 404
            ;(noPolicyError as any).code = 'NO_ACTIVE_POLICY_FOR_PAYER'
            throw noPolicyError
        }

        // Create synthetic policy
        const result: ActivePolicyResult = {
            policyId: `synthetic-${patientId}-${payerId}`,
            payerSnapshot: {
                id: payer.id,
                name: payer.name,
                type: payer.payer_type || 'unknown',
                network_status: undefined,
                effective_date: atTimestamp,
                termination_date: undefined
            },
            memberSnapshot: {
                member_id: patientId, // Using patient ID as member ID for dev
                group_number: undefined,
                policy_holder_name: undefined,
                policy_holder_dob: undefined,
                relationship_to_insured: 'self',
                coverage_type: undefined
            }
        }

        console.log(`✅ Created synthetic policy for patient ${patientId}:`, {
            policyId: result.policyId,
            payerName: result.payerSnapshot.name,
            memberId: result.memberSnapshot.member_id
        })

        return result

    } catch (error: any) {
        // Re-throw structured errors
        if (error.status && (error.code || error.status !== 500)) {
            throw error
        }

        // Wrap unexpected errors
        console.error(`❌ Unexpected error in getActivePolicy for patient ${patientId}:`, error)
        const wrappedError = new Error(`Failed to get active policy: ${error.message}`)
        ;(wrappedError as any).status = 500
        ;(wrappedError as any).code = 'NO_ACTIVE_POLICY_FOR_PAYER'
        throw wrappedError
    }
}

/**
 * Validates that a patient has an active insurance policy at the specified time.
 * Returns the policy result or throws an error.
 */
export async function validateActivePolicy(patientId: string, at?: Date): Promise<ActivePolicyResult> {
    return getActivePolicy(patientId, at)
}

/**
 * Gets just the payer snapshot for a patient's active policy
 */
export async function getActivePolicyPayer(patientId: string, at?: Date): Promise<PayerSnapshot> {
    const policy = await getActivePolicy(patientId, at)
    return policy.payerSnapshot
}

/**
 * Gets just the member snapshot for a patient's active policy
 */
export async function getActivePolicyMember(patientId: string, at?: Date): Promise<MemberSnapshot> {
    const policy = await getActivePolicy(patientId, at)
    return policy.memberSnapshot
}