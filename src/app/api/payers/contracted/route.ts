// src/app/api/payers/contracted/route.ts
// Get only payers that have active contracts with providers
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        console.log('🔍 Fetching bookable payers from v_bookable_provider_payer view...')

        // First, get unique payer IDs from the bookable view
        const { data: bookableRelations, error: bookableError } = await supabaseAdmin
            .from('v_bookable_provider_payer')
            .select('payer_id')

        if (bookableError) {
            throw bookableError
        }

        // Get unique payer IDs
        const uniquePayerIds = [...new Set(bookableRelations?.map(r => r.payer_id) || [])]
        
        if (uniquePayerIds.length === 0) {
            return NextResponse.json({
                success: true,
                data: [],
                total: 0,
                debug_info: {
                    total_contracts: 0,
                    unique_payers: 0,
                    payer_names: []
                }
            })
        }

        // Then get the actual payer details
        const { data: contractedPayers, error } = await supabaseAdmin
            .from('payers')
            .select('id, name, payer_type')
            .in('id', uniquePayerIds)

        if (error) {
            console.error('❌ Error fetching contracted payers:', error)
            return NextResponse.json(
                { success: false, error: 'Failed to fetch contracted payers', details: error },
                { status: 500 }
            )
        }

        // Payers are already unique and filtered
        const uniquePayers = contractedPayers || []

        // Sort by priority (common payers first, then alphabetical)
        const commonPayers = ['Cash | Credit Card | ACH', 'Utah Medicaid Fee-for-Service', 'Molina', 'Aetna', 'DMBA']
        const sortedPayers = uniquePayers.sort((a, b) => {
            const aCommon = commonPayers.includes(a.name) ? commonPayers.indexOf(a.name) : 999
            const bCommon = commonPayers.includes(b.name) ? commonPayers.indexOf(b.name) : 999
            if (aCommon !== bCommon) return aCommon - bCommon
            return a.name.localeCompare(b.name)
        })

        console.log(`✅ Found ${uniquePayers.length} contracted payers:`, uniquePayers.map(p => p.name))

        return NextResponse.json({
            success: true,
            data: sortedPayers,
            total: sortedPayers.length,
            debug_info: {
                total_bookable_relations: bookableRelations?.length || 0,
                unique_payer_ids: uniquePayerIds.length,
                unique_payers: uniquePayers.length,
                payer_names: uniquePayers.map(p => p.name).sort()
            }
        })

    } catch (error: any) {
        console.error('❌ Error in contracted payers endpoint:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Failed to fetch contracted payers', 
                details: error.message 
            },
            { status: 500 }
        )
    }
}