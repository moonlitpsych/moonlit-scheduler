/**
 * Debug endpoint to check current service_instances configuration
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        // Get all service instances with their service and payer info
        const { data: instances, error } = await supabaseAdmin
            .from('service_instances')
            .select(`
                id,
                service_id,
                payer_id,
                services (
                    id,
                    name
                ),
                payers (
                    id,
                    name,
                    payer_type
                ),
                service_instance_integrations (
                    id,
                    system,
                    external_id
                )
            `)
            .order('payer_id')

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 })
        }

        // Group by payer
        const byPayer = instances.reduce((acc: any, inst: any) => {
            const payerName = inst.payers?.name || 'Unknown'
            if (!acc[payerName]) {
                acc[payerName] = []
            }
            acc[payerName].push({
                instance_id: inst.id,
                service: inst.services?.name,
                intakeq_mapping: inst.service_instance_integrations?.[0]?.external_id || null
            })
            return acc
        }, {})

        return NextResponse.json({
            success: true,
            total_instances: instances.length,
            payers_with_instances: Object.keys(byPayer).length,
            instances_by_payer: byPayer,
            all_instances: instances
        })

    } catch (error: any) {
        console.error('❌ Error checking service instances:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
