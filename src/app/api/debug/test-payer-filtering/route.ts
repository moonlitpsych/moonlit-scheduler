// Debug: Test payer filtering comparison
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        console.log('🔍 Testing payer filtering comparison...')
        
        // Get ALL payers (old approach)
        const { data: allPayers, error: allError } = await supabaseAdmin
            .from('payers')
            .select('id, name, is_active')
            .eq('is_active', true)
            .order('name')

        if (allError) {
            console.error('❌ Error fetching all payers:', allError)
        }

        // Get only contracted payers (new approach)
        const { data: contractedData, error: contractedError } = await supabaseAdmin
            .from('provider_payer_networks')
            .select(`
                payer_id,
                status,
                payers!inner (
                    id,
                    name,
                    payer_type,
                    is_active
                )
            `)
            .eq('status', 'active')
            .eq('payers.is_active', true)

        if (contractedError) {
            console.error('❌ Error fetching contracted payers:', contractedError)
        }

        // Process contracted payers
        const uniquePayersMap = new Map()
        contractedData?.forEach(item => {
            const payer = item.payers
            if (payer && !uniquePayersMap.has(payer.id)) {
                uniquePayersMap.set(payer.id, payer)
            }
        })
        const contractedPayers = Array.from(uniquePayersMap.values())

        console.log('📊 Comparison results:', {
            all_payers_count: allPayers?.length || 0,
            contracted_payers_count: contractedPayers?.length || 0,
            reduction: allPayers?.length ? allPayers.length - contractedPayers.length : 0
        })

        return NextResponse.json({
            success: true,
            comparison: {
                all_payers: {
                    count: allPayers?.length || 0,
                    sample: allPayers?.slice(0, 5).map(p => p.name) || []
                },
                contracted_payers: {
                    count: contractedPayers?.length || 0,
                    sample: contractedPayers?.slice(0, 5).map(p => p.name) || []
                },
                filtered_out: {
                    count: allPayers?.length ? allPayers.length - contractedPayers.length : 0,
                    percentage: allPayers?.length ? Math.round((1 - contractedPayers.length / allPayers.length) * 100) : 0
                }
            },
            debug_info: {
                all_error: allError,
                contracted_error: contractedError,
                total_contract_records: contractedData?.length || 0
            }
        })

    } catch (error: any) {
        console.error('❌ Debug comparison error:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        })
    }
}