// Debug endpoint to audit provider_availability_cache and understand why slot generation returns 0 results

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        console.log('🔍 Auditing provider availability cache...')

        const results = {
            cache_analysis: null,
            providers_analysis: null,
            date_analysis: null,
            sample_cache_data: null,
            recommendations: []
        }

        // Check provider_availability_cache table
        const { data: cacheData, error: cacheError } = await supabaseAdmin
            .from('provider_availability_cache')
            .select('*')
            .limit(10)

        if (cacheError) {
            results.cache_analysis = { error: cacheError.message }
        } else {
            results.cache_analysis = {
                total_records: cacheData?.length || 0,
                sample_data: cacheData || []
            }

            if (cacheData && cacheData.length > 0) {
                // Analyze date ranges in cache
                const dates = cacheData.map(record => record.date).sort()
                const providers = [...new Set(cacheData.map(record => record.provider_id))]
                
                results.date_analysis = {
                    earliest_date: dates[0],
                    latest_date: dates[dates.length - 1],
                    unique_providers_in_cache: providers.length,
                    provider_ids: providers
                }
            }
        }

        // Check which providers should have availability
        const { data: bookableProviders, error: providersError } = await supabaseAdmin
            .from('providers')
            .select('id, first_name, last_name, is_bookable')
            .eq('is_bookable', true)

        if (providersError) {
            results.providers_analysis = { error: providersError.message }
        } else {
            results.providers_analysis = {
                bookable_provider_count: bookableProviders?.length || 0,
                bookable_providers: bookableProviders?.map(p => ({
                    id: p.id,
                    name: `${p.first_name} ${p.last_name}`,
                    has_cache_data: false // will update below
                })) || []
            }

            // Check which bookable providers have cache data
            if (cacheData && bookableProviders) {
                const cacheProviderIds = new Set(cacheData.map(c => c.provider_id))
                results.providers_analysis.bookable_providers = results.providers_analysis.bookable_providers.map(p => ({
                    ...p,
                    has_cache_data: cacheProviderIds.has(p.id)
                }))
            }
        }

        // Generate recommendations
        if (!results.cache_analysis?.error && results.cache_analysis?.total_records === 0) {
            results.recommendations.push("provider_availability_cache table is empty - no availability data exists")
            results.recommendations.push("Need to populate availability cache with provider schedules")
            results.recommendations.push("Check if availability generation process is running")
        }

        if (results.providers_analysis?.bookable_providers) {
            const providersWithoutCache = results.providers_analysis.bookable_providers.filter(p => !p.has_cache_data)
            if (providersWithoutCache.length > 0) {
                results.recommendations.push(`${providersWithoutCache.length} bookable providers have no availability cache data: ${providersWithoutCache.map(p => p.name).join(', ')}`)
            }
        }

        // Check what date range we're looking for
        const fromDate = new Date().toISOString().split('T')[0]
        const thruDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        results.sample_cache_data = {
            search_date_range: { fromDate, thruDate },
            explanation: "list_bookable_slots_for_payer needs availability data in this date range"
        }

        return NextResponse.json({
            success: true,
            message: 'Availability cache audit complete',
            results,
            next_steps: [
                "1. Populate provider_availability_cache table with sample availability",
                "2. Test list_bookable_slots_for_payer function with populated cache",
                "3. If working, update merged-availability API to use new function",
                "4. Create availability management system for providers"
            ]
        })

    } catch (error: any) {
        console.error('❌ Availability cache audit error:', error)
        return NextResponse.json(
            { success: false, error: 'Audit failed', details: error.message },
            { status: 500 }
        )
    }
}