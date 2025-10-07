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
 * Calls the public.get_active_policy function and formats the result.
 */
export async function getActivePolicy(patientId: string, at?: Date): Promise<ActivePolicyResult> {
    try {
        const atTimestamp = at ? at.toISOString() : new Date().toISOString()
        console.log(`🔍 Getting active policy for patient ${patientId} at ${atTimestamp}`)

        // Call the database function
        const { data, error } = await supabaseAdmin
            .rpc('get_active_policy', {
                patient_id: patientId,
                at_timestamp: atTimestamp
            })

        if (error) {
            console.error('❌ Error calling get_active_policy function:', error)
            throw new Error(`Database error: ${error.message}`)
        }

        if (!data || data.length === 0) {
            console.error(`❌ No active policy found for patient ${patientId} at ${atTimestamp}`)
            const noPolicyError = new Error(`No active insurance policy found for patient ${patientId}`)
            ;(noPolicyError as any).status = 404
            ;(noPolicyError as any).code = 'NO_ACTIVE_POLICY'
            throw noPolicyError
        }

        const policyData = data[0]

        // Validate required fields
        if (!policyData.policy_id) {
            throw new Error('Policy data missing policy_id')
        }

        if (!policyData.payer_id || !policyData.payer_name) {
            throw new Error('Policy data missing payer information')
        }

        if (!policyData.member_id) {
            throw new Error('Policy data missing member_id')
        }

        // Format the result
        const result: ActivePolicyResult = {
            policyId: policyData.policy_id,
            payerSnapshot: {
                id: policyData.payer_id,
                name: policyData.payer_name,
                type: policyData.payer_type || 'unknown',
                network_status: policyData.network_status,
                effective_date: policyData.payer_effective_date,
                termination_date: policyData.payer_termination_date
            },
            memberSnapshot: {
                member_id: policyData.member_id,
                group_number: policyData.group_number,
                policy_holder_name: policyData.policy_holder_name,
                policy_holder_dob: policyData.policy_holder_dob,
                relationship_to_insured: policyData.relationship_to_insured,
                coverage_type: policyData.coverage_type
            }
        }

        console.log(`✅ Got active policy for patient ${patientId}:`, {
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