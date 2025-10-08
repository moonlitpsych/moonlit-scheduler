/**
 * Debug endpoint to check which payers have contracts but no service instances
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        // Get all payers
        const { data: payers, error: payersError } = await supabaseAdmin
            .from('payers')
            .select('id, name, effective_date, status_code')
            .order('name')

        if (payersError) {
            return NextResponse.json({
                success: false,
                error: payersError.message
            }, { status: 500 })
        }

        const results = []

        for (const payer of payers) {
            // Check contracts
            const { data: contracts } = await supabaseAdmin
                .from('provider_payer_networks')
                .select('id')
                .eq('payer_id', payer.id)

            // Check service instances
            const { data: instances } = await supabaseAdmin
                .from('service_instances')
                .select('id')
                .eq('payer_id', payer.id)

            const hasContracts = contracts && contracts.length > 0
            const hasInstances = instances && instances.length > 0
            const hasEffectiveDate = !!payer.effective_date
            const isApproved = payer.status_code === 'approved' || payer.status_code === null

            // Flag payers that SHOULD have instances but don't
            const shouldHaveInstances = hasContracts && hasEffectiveDate && isApproved
            const needsInstances = shouldHaveInstances && !hasInstances

            results.push({
                payer_name: payer.name,
                payer_id: payer.id,
                has_contracts: hasContracts,
                contract_count: contracts?.length || 0,
                has_effective_date: hasEffectiveDate,
                effective_date: payer.effective_date,
                is_approved: isApproved,
                status_code: payer.status_code,
                has_instances: hasInstances,
                instance_count: instances?.length || 0,
                should_have_instances: shouldHaveInstances,
                needs_instances: needsInstances
            })
        }

        const needsAction = results.filter(r => r.needs_instances)
        const correct = results.filter(r => !r.needs_instances)

        return NextResponse.json({
            success: true,
            summary: {
                total_payers: results.length,
                payers_needing_instances: needsAction.length,
                payers_correctly_configured: correct.length
            },
            payers_needing_instances: needsAction,
            all_payers: results
        })

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
