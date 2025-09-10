// Check what effective dates are in the v2 view to understand the date filtering

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const payerId = searchParams.get('payer_id') || 'a01d69d6-ae70-4917-afef-49b5ef7e5220'
        
        console.log('📅 Checking v2 view date ranges...')

        // Get all v2 view data for the payer with date fields (no first_name/last_name in v2 view)
        const { data: v2Data, error: v2Error } = await supabaseAdmin
            .from('v_bookable_provider_payer')
            .select('provider_id, payer_id, effective, bookable_from_date')
            .eq('payer_id', payerId)

        if (v2Error) {
            return NextResponse.json(
                { success: false, error: 'v2 view error', details: v2Error.message },
                { status: 500 }
            )
        }

        const today = new Date().toISOString().split('T')[0]
        const results = {
            total_providers: v2Data?.length || 0,
            today: today,
            date_analysis: {},
            provider_details: []
        }

        if (v2Data && v2Data.length > 0) {
            const effectiveDates = v2Data.map(p => p.effective).filter(Boolean)
            const bookableDates = v2Data.map(p => p.bookable_from_date).filter(Boolean)

            results.date_analysis = {
                effective_dates: {
                    min: effectiveDates.length > 0 ? Math.min(...effectiveDates.map(d => new Date(d).getTime())) : null,
                    max: effectiveDates.length > 0 ? Math.max(...effectiveDates.map(d => new Date(d).getTime())) : null,
                    sample: effectiveDates.slice(0, 3)
                },
                bookable_from_dates: {
                    min: bookableDates.length > 0 ? Math.min(...bookableDates.map(d => new Date(d).getTime())) : null,
                    max: bookableDates.length > 0 ? Math.max(...bookableDates.map(d => new Date(d).getTime())) : null,
                    sample: bookableDates.slice(0, 3)
                }
            }

            results.provider_details = v2Data.map(provider => {
                const effective = new Date(provider.effective || '1900-01-01')
                const bookableFrom = new Date(provider.bookable_from_date || '1900-01-01')
                const todayDate = new Date(today)

                return {
                    provider_id: provider.provider_id,
                    effective: provider.effective,
                    bookable_from_date: provider.bookable_from_date,
                    is_effective_today: effective <= todayDate,
                    is_bookable_today: bookableFrom <= todayDate,
                    days_until_effective: Math.ceil((effective.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)),
                    days_until_bookable: Math.ceil((bookableFrom.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))
                }
            })

            // Convert timestamps to readable dates for min/max
            if (results.date_analysis.effective_dates.min) {
                results.date_analysis.effective_dates.min_readable = new Date(results.date_analysis.effective_dates.min).toISOString().split('T')[0]
                results.date_analysis.effective_dates.max_readable = new Date(results.date_analysis.effective_dates.max).toISOString().split('T')[0]
            }
            if (results.date_analysis.bookable_from_dates.min) {
                results.date_analysis.bookable_from_dates.min_readable = new Date(results.date_analysis.bookable_from_dates.min).toISOString().split('T')[0]
                results.date_analysis.bookable_from_dates.max_readable = new Date(results.date_analysis.bookable_from_dates.max).toISOString().split('T')[0]
            }
        }

        return NextResponse.json({
            success: true,
            message: 'v2 view date analysis complete',
            results,
            recommendations: [
                results.provider_details.filter(p => p.is_effective_today && p.is_bookable_today).length === 0 
                    ? "No providers are effective and bookable today - check effective/bookable_from_date values"
                    : `${results.provider_details.filter(p => p.is_effective_today && p.is_bookable_today).length} providers are ready for booking today`,
                "Consider using legacy provider_payer_networks if v2 view dates are not properly configured"
            ]
        })

    } catch (error: any) {
        console.error('❌ v2 view date check error:', error)
        return NextResponse.json(
            { success: false, error: 'Date check failed', details: error.message },
            { status: 500 }
        )
    }
}