import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        console.log('🔍 Starting comprehensive availability system audit...')
        
        // 1. Count all provider_availability records
        const { data: allAvailability, error: allAvailError } = await supabaseAdmin
            .from('provider_availability')
            .select('*')
        
        // 2. Check provider_availability_exceptions
        const { data: exceptions, error: exceptionsError } = await supabaseAdmin
            .from('provider_availability_exceptions')
            .select('*')
        
        // 3. Check provider_schedules (mentioned as empty)
        const { data: schedules, error: schedulesError } = await supabaseAdmin
            .from('provider_schedules')
            .select('*')
        
        // 4. Analyze provider-payer relationships
        const { data: networks, error: networksError } = await supabaseAdmin
            .from('provider_payer_networks')
            .select('*')
            
        // 5. Count active vs inactive providers
        const { data: providers, error: providersError } = await supabaseAdmin
            .from('providers')
            .select('id, first_name, last_name, is_active, is_bookable')
        
        // 6. Sample a specific payer query to see filtering
        const testPayerId = 'a01d69d6-ae70-4917-afef-49b5ef7e5220' // Utah Medicaid
        const { data: payerProviders, error: payerError } = await supabaseAdmin
            .from('provider_payer_networks')
            .select('provider_id, providers!inner(id, first_name, last_name, is_active, is_bookable)')
            .eq('payer_id', testPayerId)
            .eq('status', 'in_network')
            .eq('providers.is_active', true)
            
        // 7. Check if exceptions are being applied
        const testDate = '2025-09-02'
        const testDayOfWeek = new Date(testDate).getDay() // 1 = Monday
        
        console.log('📊 Audit Results:')
        console.log(`- Total provider_availability records: ${allAvailability?.length || 0}`)
        console.log(`- Total exceptions: ${exceptions?.length || 0}`) 
        console.log(`- Total schedules: ${schedules?.length || 0}`)
        console.log(`- Total provider-payer networks: ${networks?.length || 0}`)
        console.log(`- Active providers: ${providers?.filter(p => p.is_active).length || 0}`)
        console.log(`- Bookable providers: ${providers?.filter(p => p.is_bookable).length || 0}`)
        console.log(`- Utah Medicaid providers: ${payerProviders?.length || 0}`)
        
        // Analyze availability by provider for test date
        const availabilityByProvider = allAvailability?.reduce((acc, avail) => {
            if (avail.day_of_week === testDayOfWeek) {
                const provider = providers?.find(p => p.id === avail.provider_id)
                const providerName = provider ? `${provider.first_name} ${provider.last_name}` : avail.provider_id
                if (!acc[providerName]) acc[providerName] = 0
                acc[providerName]++
            }
            return acc
        }, {} as Record<string, number>)
        
        console.log(`📅 Availability for ${testDate} (day ${testDayOfWeek}):`, availabilityByProvider)
        
        return NextResponse.json({
            success: true,
            audit: {
                provider_availability: {
                    total: allAvailability?.length || 0,
                    sample: allAvailability?.[0] || null,
                    by_day_of_week: allAvailability?.reduce((acc, a) => {
                        acc[a.day_of_week] = (acc[a.day_of_week] || 0) + 1
                        return acc
                    }, {} as Record<number, number>) || {}
                },
                exceptions: {
                    total: exceptions?.length || 0,
                    sample: exceptions?.[0] || null,
                    by_provider: exceptions?.reduce((acc, e) => {
                        const provider = providers?.find(p => p.id === e.provider_id)
                        const name = provider ? `${provider.first_name} ${provider.last_name}` : e.provider_id
                        acc[name] = (acc[name] || 0) + 1
                        return acc
                    }, {} as Record<string, number>) || {}
                },
                schedules: {
                    total: schedules?.length || 0,
                    sample: schedules?.[0] || null
                },
                providers: {
                    total: providers?.length || 0,
                    active: providers?.filter(p => p.is_active).length || 0,
                    bookable: providers?.filter(p => p.is_bookable !== false).length || 0,
                    inactive: providers?.filter(p => !p.is_active).length || 0
                },
                networks: {
                    total: networks?.length || 0,
                    utah_medicaid_providers: payerProviders?.length || 0,
                    utah_medicaid_names: payerProviders?.map(p => `${p.providers.first_name} ${p.providers.last_name}`) || []
                },
                test_date_analysis: {
                    date: testDate,
                    day_of_week: testDayOfWeek,
                    availability_by_provider: availabilityByProvider
                }
            }
        })
        
    } catch (error: any) {
        console.error('💥 Error in availability audit:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}