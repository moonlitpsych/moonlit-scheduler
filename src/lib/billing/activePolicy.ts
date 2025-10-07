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
 * Queries patient_insurance_policies table directly (no RPC needed).
 */
export async function getActivePolicy(patientId: string, at?: Date): Promise<ActivePolicyResult> {
    try {
        const atTimestamp = at ? at.toISOString() : new Date().toISOString()
        console.log(`🔍 Getting active policy for patient ${patientId} at ${atTimestamp}`)

        // Query patient_insurance_policies with payer join
        const { data: policies, error } = await supabaseAdmin
            .from('patient_insurance_policies')
            .select(`
                id,
                payer_id,
                member_id,
                group_number,
                policy_holder_name,
                policy_holder_dob,
                relationship_to_insured,
                coverage_type,
                effective_date,
                termination_date,
                is_active,
                payers (
                    id,
                    name,
                    payer_type,
                    state
                )
            `)
            .eq('patient_id', patientId)
            .eq('is_active', true)
            .lte('effective_date', atTimestamp)
            .or(`termination_date.is.null,termination_date.gte.${atTimestamp}`)
            .order('effective_date', { ascending: false })
            .limit(1)

        if (error) {
            console.error('❌ Error querying patient_insurance_policies:', error)
            throw new Error(`Database error: ${error.message}`)
        }

        if (!policies || policies.length === 0) {
            console.error(`❌ No active policy found for patient ${patientId} at ${atTimestamp}`)
            const noPolicyError = new Error(`No active insurance policy found for patient ${patientId}`)
            ;(noPolicyError as any).status = 404
            ;(noPolicyError as any).code = 'NO_ACTIVE_POLICY'
            throw noPolicyError
        }

        const policy = policies[0]
        const payer = policy.payers as any

        // Validate required fields
        if (!policy.id) {
            throw new Error('Policy data missing id')
        }

        if (!policy.payer_id || !payer?.name) {
            throw new Error('Policy data missing payer information')
        }

        if (!policy.member_id) {
            throw new Error('Policy data missing member_id')
        }

        // Format the result
        const result: ActivePolicyResult = {
            policyId: policy.id,
            payerSnapshot: {
                id: policy.payer_id,
                name: payer.name,
                type: payer.payer_type || 'unknown',
                network_status: undefined, // Not in patient_insurance_policies
                effective_date: policy.effective_date,
                termination_date: policy.termination_date
            },
            memberSnapshot: {
                member_id: policy.member_id,
                group_number: policy.group_number,
                policy_holder_name: policy.policy_holder_name,
                policy_holder_dob: policy.policy_holder_dob,
                relationship_to_insured: policy.relationship_to_insured,
                coverage_type: policy.coverage_type
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