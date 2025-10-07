/**
 * Debug endpoint to understand supervision relationships in bookability view
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        const MOLINA_PAYER_ID = '8b48c3e2-f555-4d67-8122-c086466ba97d'

        // Get all Molina bookable relationships
        const { data: relationships, error } = await supabaseAdmin
            .from('v_bookable_provider_payer')
            .select(`
                provider_id,
                payer_id,
                network_status,
                billing_provider_id,
                rendering_provider_id,
                effective_date,
                bookable_from_date
            `)
            .eq('payer_id', MOLINA_PAYER_ID)

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 })
        }

        // Get provider names for all referenced providers
        const providerIds = new Set<string>()
        relationships?.forEach(r => {
            providerIds.add(r.provider_id)
            if (r.billing_provider_id) providerIds.add(r.billing_provider_id)
            if (r.rendering_provider_id) providerIds.add(r.rendering_provider_id)
        })

        const { data: providers } = await supabaseAdmin
            .from('providers')
            .select('id, first_name, last_name, title, role, provider_type')
            .in('id', Array.from(providerIds))

        const providerMap = providers?.reduce((acc, p) => {
            acc[p.id] = `${p.first_name} ${p.last_name} (${p.role})`
            return acc
        }, {} as Record<string, string>) || {}

        // Annotate relationships with provider names
        const annotated = relationships?.map(r => ({
            provider_id: r.provider_id,
            provider_name: providerMap[r.provider_id] || 'Unknown',
            network_status: r.network_status,
            billing_provider_id: r.billing_provider_id,
            billing_provider_name: r.billing_provider_id ? providerMap[r.billing_provider_id] : null,
            rendering_provider_id: r.rendering_provider_id,
            rendering_provider_name: r.rendering_provider_id ? providerMap[r.rendering_provider_id] : null,
            effective_date: r.effective_date,
            bookable_from_date: r.bookable_from_date,
            explanation: r.network_status === 'supervised'
                ? `Patient books ${providerMap[r.provider_id]}, supervised by ${r.billing_provider_id ? providerMap[r.billing_provider_id] : 'Unknown'}`
                : `Patient books ${providerMap[r.provider_id]} directly (in-network)`
        }))

        return NextResponse.json({
            success: true,
            total_relationships: relationships?.length || 0,
            relationships: annotated,
            note: 'This shows all Molina bookable relationships with provider names'
        })

    } catch (error: any) {
        console.error('❌ Error checking supervision relationships:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
