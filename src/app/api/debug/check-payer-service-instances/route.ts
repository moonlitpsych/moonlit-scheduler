/**
 * Debug endpoint to check which payers have service instances configured
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        // Get all payers with their service instance counts
        const { data: payers, error: payersError } = await supabaseAdmin
            .from('payers')
            .select(`
                id,
                name,
                payer_type
            `)
            .order('name')

        if (payersError) {
            return NextResponse.json({
                success: false,
                error: payersError.message
            }, { status: 500 })
        }

        // For each payer, get service instance details
        const payerDetails = await Promise.all(
            payers.map(async (payer) => {
                // Get service instances for this payer
                const { data: serviceInstances, error: siError } = await supabaseAdmin
                    .from('service_instances')
                    .select(`
                        id,
                        service_id,
                        services (
                            name,
                            duration_minutes
                        ),
                        service_instance_integrations (
                            id,
                            system,
                            external_id
                        )
                    `)
                    .eq('payer_id', payer.id)

                if (siError) {
                    console.error(`Error fetching service instances for ${payer.name}:`, siError)
                }

                const instances = serviceInstances || []
                const hasIntakeQMapping = instances.some(si =>
                    si.service_instance_integrations &&
                    si.service_instance_integrations.length > 0
                )

                return {
                    payer_id: payer.id,
                    payer_name: payer.name,
                    payer_type: payer.payer_type,
                    service_instance_count: instances.length,
                    has_intakeq_mapping: hasIntakeQMapping,
                    service_instances: instances.map(si => ({
                        id: si.id,
                        service_name: si.services?.name,
                        duration_minutes: si.services?.duration_minutes,
                        intakeq_external_id: si.service_instance_integrations?.[0]?.external_id
                    })),
                    can_book: instances.length > 0 && hasIntakeQMapping
                }
            })
        )

        // Separate into bookable and non-bookable
        const bookablePayers = payerDetails.filter(p => p.can_book)
        const nonBookablePayers = payerDetails.filter(p => !p.can_book)

        return NextResponse.json({
            success: true,
            summary: {
                total_active_payers: payers.length,
                bookable_payers: bookablePayers.length,
                non_bookable_payers: nonBookablePayers.length
            },
            bookable_payers: bookablePayers,
            non_bookable_payers: nonBookablePayers,
            recommendation: bookablePayers.length === 0
                ? "⚠️ No payers are currently bookable. Need to create service instances and IntakeQ mappings."
                : `✅ ${bookablePayers.length} payer(s) ready for booking: ${bookablePayers.map(p => p.payer_name).join(', ')}`
        })

    } catch (error: any) {
        console.error('❌ Error checking payer service instances:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
