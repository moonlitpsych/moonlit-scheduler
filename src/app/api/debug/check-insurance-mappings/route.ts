/**
 * Debug endpoint to check existing insurance mappings
 * GET /api/debug/check-insurance-mappings
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    try {
        // Get all insurance mappings for practiceq/intakeq
        const { data: mappings, error } = await supabaseAdmin
            .from('payer_external_mappings')
            .select(`
                id,
                payer_id,
                system,
                key_name,
                value,
                payers (
                    name
                )
            `)
            .eq('system', 'practiceq')
            .eq('key_name', 'insurance_company_name')
            .order('value')

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 })
        }

        // Also get all payers that DON'T have mappings
        const { data: allPayers } = await supabaseAdmin
            .from('payers')
            .select('id, name')
            .order('name')

        const mappedPayerIds = new Set(mappings?.map(m => m.payer_id) || [])
        const unmappedPayers = allPayers?.filter(p => !mappedPayerIds.has(p.id)) || []

        return NextResponse.json({
            success: true,
            summary: {
                totalMappings: mappings?.length || 0,
                totalPayers: allPayers?.length || 0,
                unmappedPayers: unmappedPayers.length
            },
            mappings: mappings?.map(m => ({
                payerId: m.payer_id,
                payerName: (m.payers as any)?.name,
                intakeqName: m.value
            })),
            unmappedPayers: unmappedPayers.map(p => ({
                id: p.id,
                name: p.name
            }))
        })

    } catch (error: any) {
        console.error('❌ Error checking insurance mappings:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to check mappings'
        }, { status: 500 })
    }
}