// Service discovery API - finds which visit types (service_instance_ids) have cache data for a payer

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const payerId = searchParams.get('payer_id')
        const fromDate = searchParams.get('from_date') || new Date().toISOString().split('T')[0]
        const thruDate = searchParams.get('thru_date') || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

        if (!payerId) {
            return NextResponse.json(
                { success: false, error: 'payer_id is required' },
                { status: 400 }
            )
        }

        console.log('🔍 Discovering available services for payer:', { payerId, fromDate, thruDate })

        // Step 1: Get bookable providers for this payer from v2 view
        // TODO: Fix daterange parsing issue - for now, force legacy fallback
        console.log('🔄 Temporarily using legacy approach due to v2 daterange parsing issues')
        const providersError = new Error('Temporarily forcing legacy fallback')
        const bookableProviders = null

        if (providersError || !bookableProviders || bookableProviders.length === 0) {
            console.warn('⚠️ v2 view not ready or empty, falling back to legacy provider networks:', providersError?.message)
            
            // Fallback to legacy approach
            const { data: legacyNetworks, error: legacyError } = await supabaseAdmin
                .from('provider_payer_networks')
                .select('provider_id')
                .eq('payer_id', payerId)
                .eq('status', 'in_network')

            if (legacyError) {
                return NextResponse.json(
                    { success: false, error: 'Failed to get provider networks', details: legacyError.message },
                    { status: 500 }
                )
            }

            const providerIds = legacyNetworks?.map(n => n.provider_id) || []
            if (providerIds.length === 0) {
                return NextResponse.json({
                    success: true,
                    data: {
                        available_services: [],
                        message: 'No providers accept this payer'
                    }
                })
            }

            // Check cache for these providers
            const { data: cacheData, error: cacheError } = await supabaseAdmin
                .from('provider_availability_cache')
                .select('service_instance_id, date, provider_id')
                .in('provider_id', providerIds)
                .gte('date', fromDate)
                .lte('date', thruDate)

            if (cacheError) {
                return NextResponse.json(
                    { success: false, error: 'Failed to check availability cache', details: cacheError.message },
                    { status: 500 }
                )
            }

            // Group by service_instance_id
            const serviceMap = new Map()
            cacheData?.forEach(record => {
                const serviceId = record.service_instance_id
                if (!serviceMap.has(serviceId)) {
                    serviceMap.set(serviceId, {
                        service_instance_id: serviceId,
                        provider_ids: new Set(),
                        dates: new Set()
                    })
                }
                serviceMap.get(serviceId).provider_ids.add(record.provider_id)
                serviceMap.get(serviceId).dates.add(record.date)
            })

            const availableServices = Array.from(serviceMap.values()).map(service => ({
                service_instance_id: service.service_instance_id,
                service_name: 'General Consultation', // TODO: Fetch from service_instances table
                cache_days_available: service.dates.size,
                provider_count: service.provider_ids.size,
                date_range: {
                    earliest: Math.min(...Array.from(service.dates)),
                    latest: Math.max(...Array.from(service.dates))
                }
            }))

            return NextResponse.json({
                success: true,
                data: {
                    available_services: availableServices,
                    method_used: 'legacy_fallback',
                    total_services: availableServices.length
                }
            })
        }

        // Step 2: Filter providers by effective dates and bookable_from_date
        const effectiveProviders = bookableProviders?.filter(provider => {
            const effective = new Date(provider.effective || '1900-01-01')
            const bookableFrom = new Date(provider.bookable_from_date || '1900-01-01')
            const requestStart = new Date(fromDate)
            const requestEnd = new Date(thruDate)

            // Provider must be effective before request end and bookable from before request end
            return effective <= requestEnd && bookableFrom <= requestEnd
        }) || []

        if (effectiveProviders.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    available_services: [],
                    message: 'No providers are effective/bookable in the requested date range',
                    debug: {
                        total_providers: bookableProviders?.length || 0,
                        effective_providers: 0,
                        date_range: { fromDate, thruDate }
                    }
                }
            })
        }

        const providerIds = effectiveProviders.map(p => p.provider_id)
        console.log(`📊 Found ${providerIds.length} effective/bookable providers for date range`)

        // Step 3: Find which service_instance_ids have cache data for these providers in date range
        const { data: cacheData, error: cacheError } = await supabaseAdmin
            .from('provider_availability_cache')
            .select('service_instance_id, date, provider_id')
            .in('provider_id', providerIds)
            .gte('date', fromDate)
            .lte('date', thruDate)

        if (cacheError) {
            return NextResponse.json(
                { success: false, error: 'Failed to check availability cache', details: cacheError.message },
                { status: 500 }
            )
        }

        // Group by service_instance_id and analyze availability
        const serviceMap = new Map()
        cacheData?.forEach(record => {
            const serviceId = record.service_instance_id
            if (!serviceMap.has(serviceId)) {
                serviceMap.set(serviceId, {
                    service_instance_id: serviceId,
                    provider_ids: new Set(),
                    dates: new Set()
                })
            }
            serviceMap.get(serviceId).provider_ids.add(record.provider_id)
            serviceMap.get(serviceId).dates.add(record.date)
        })

        // TODO: Fetch actual service names from service_instances table
        const availableServices = Array.from(serviceMap.values()).map(service => ({
            service_instance_id: service.service_instance_id,
            service_name: service.service_instance_id === 'ac8a10fa-443e-4913-93d3-26c0307beb96' ? 
                'Initial Psychiatric Consultation' : 'General Consultation',
            cache_days_available: service.dates.size,
            provider_count: service.provider_ids.size,
            date_range: {
                earliest: Math.min(...Array.from(service.dates)),
                latest: Math.max(...Array.from(service.dates))
            }
        }))

        console.log(`✅ Found ${availableServices.length} services with availability cache`)

        return NextResponse.json({
            success: true,
            data: {
                available_services: availableServices,
                method_used: 'v2_view',
                total_services: availableServices.length,
                debug: {
                    bookable_providers: bookableProviders?.length || 0,
                    effective_providers: effectiveProviders.length,
                    cache_records: cacheData?.length || 0
                }
            }
        })

    } catch (error: any) {
        console.error('❌ Service discovery error:', error)
        return NextResponse.json(
            { success: false, error: 'Service discovery failed', details: error.message },
            { status: 500 }
        )
    }
}