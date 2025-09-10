import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('🔍 Investigating source of future dates in bookability data...')

    // Get all records from canonical view with dates
    const { data: viewData, error: viewError } = await supabaseAdmin
      .from('v_bookable_provider_payer')
      .select(`
        provider_id,
        payer_id,
        network_status,
        effective_date,
        expiration_date,
        bookable_from_date
      `)
      .order('effective_date', { ascending: false })

    if (viewError) {
      console.error('❌ Error fetching canonical view data:', viewError)
      return NextResponse.json({ success: false, error: viewError })
    }

    // Analyze date patterns
    const dateAnalysis = {
      total_records: viewData?.length || 0,
      future_dates: [],
      past_dates: [],
      date_ranges: {
        earliest_effective: null,
        latest_effective: null,
        earliest_bookable: null,
        latest_bookable: null
      }
    }

    const today = new Date()
    const currentYear = today.getFullYear()

    // Analyze each record
    viewData?.forEach(record => {
      const effectiveDate = record.effective_date ? new Date(record.effective_date) : null
      const bookableDate = record.bookable_from_date ? new Date(record.bookable_from_date) : null

      // Check for future dates
      if (effectiveDate && effectiveDate > today) {
        dateAnalysis.future_dates.push({
          provider_id: record.provider_id,
          payer_id: record.payer_id,
          network_status: record.network_status,
          effective_date: record.effective_date,
          bookable_from_date: record.bookable_from_date,
          issue: 'Future effective date'
        })
      }

      if (bookableDate && bookableDate > today) {
        // Only add if not already in future_dates for the same record
        const existingEntry = dateAnalysis.future_dates.find(
          entry => entry.provider_id === record.provider_id && entry.payer_id === record.payer_id
        )
        if (!existingEntry) {
          dateAnalysis.future_dates.push({
            provider_id: record.provider_id,
            payer_id: record.payer_id,
            network_status: record.network_status,
            effective_date: record.effective_date,
            bookable_from_date: record.bookable_from_date,
            issue: 'Future bookable date'
          })
        }
      }

      // Track date ranges
      if (effectiveDate) {
        if (!dateAnalysis.date_ranges.earliest_effective || effectiveDate < new Date(dateAnalysis.date_ranges.earliest_effective)) {
          dateAnalysis.date_ranges.earliest_effective = record.effective_date
        }
        if (!dateAnalysis.date_ranges.latest_effective || effectiveDate > new Date(dateAnalysis.date_ranges.latest_effective)) {
          dateAnalysis.date_ranges.latest_effective = record.effective_date
        }
      }

      if (bookableDate) {
        if (!dateAnalysis.date_ranges.earliest_bookable || bookableDate < new Date(dateAnalysis.date_ranges.earliest_bookable)) {
          dateAnalysis.date_ranges.earliest_bookable = record.bookable_from_date
        }
        if (!dateAnalysis.date_ranges.latest_bookable || bookableDate > new Date(dateAnalysis.date_ranges.latest_bookable)) {
          dateAnalysis.date_ranges.latest_bookable = record.bookable_from_date
        }
      }
    })

    // Count future vs current/past
    const futureCount = dateAnalysis.future_dates.length
    const totalCount = dateAnalysis.total_records

    console.log('📊 Date Analysis Results:')
    console.log(`   Total records: ${totalCount}`)
    console.log(`   Future dated records: ${futureCount}`)
    console.log(`   Date range: ${dateAnalysis.date_ranges.earliest_effective} to ${dateAnalysis.date_ranges.latest_effective}`)

    return NextResponse.json({
      success: true,
      analysis: dateAnalysis,
      investigation: {
        current_date: today.toISOString().split('T')[0],
        future_records_percentage: totalCount > 0 ? Math.round((futureCount / totalCount) * 100) : 0,
        likely_cause: futureCount > totalCount * 0.8 
          ? "Test data or planned future contracts" 
          : futureCount > 0 
          ? "Mix of current and planned contracts"
          : "All contracts are current or historical"
      },
      recommendations: [
        futureCount > 0 ? "Review data source - may be test data or planned contracts" : "Date data appears realistic",
        "Check if these are intended future contracts vs incorrect data entry",
        "Consider updating to current dates if this is test/demo data"
      ]
    })

  } catch (error: any) {
    console.error('❌ Error in date analysis:', error)
    return NextResponse.json({ success: false, error: error.message })
  }
}