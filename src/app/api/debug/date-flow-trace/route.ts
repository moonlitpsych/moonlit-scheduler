import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('🔍 Tracing date flow from database to API response...')

    // Step 1: Raw query to see exactly what comes from Supabase
    const { data: rawData, error } = await supabaseAdmin
      .from('v_bookable_provider_payer')
      .select(`
        provider_id,
        payer_id,
        effective_date,
        bookable_from_date,
        expiration_date
      `)
      .eq('payer_id', '62ab291d-b68e-4c71-a093-2d6e380764c3') // Health Choice Utah
      .limit(3)

    if (error) {
      console.error('❌ Error fetching raw data:', error)
      return NextResponse.json({ success: false, error })
    }

    console.log('📋 Raw Supabase response:', rawData)

    // Step 2: Check what happens when we manually parse
    const processedData = rawData?.map(row => {
      const originalEffectiveDate = row.effective_date
      const originalBookableDate = row.bookable_from_date
      
      // Different parsing approaches
      const effectiveDateAsDate = new Date(originalEffectiveDate)
      const effectiveDateAsString = String(originalEffectiveDate)
      const bookableDateAsDate = new Date(originalBookableDate)
      const bookableDateAsString = String(originalBookableDate)

      return {
        provider_id: row.provider_id,
        payer_id: row.payer_id,
        raw_values: {
          effective_date: originalEffectiveDate,
          bookable_from_date: originalBookableDate,
          expiration_date: row.expiration_date
        },
        type_analysis: {
          effective_date_type: typeof originalEffectiveDate,
          effective_date_constructor: originalEffectiveDate?.constructor?.name,
          bookable_from_date_type: typeof originalBookableDate,
          bookable_from_date_constructor: originalBookableDate?.constructor?.name
        },
        parsing_results: {
          effective_as_date: effectiveDateAsDate,
          effective_as_date_iso: effectiveDateAsDate.toISOString(),
          effective_as_date_local: effectiveDateAsDate.toLocaleDateString(),
          effective_as_string: effectiveDateAsString,
          bookable_as_date: bookableDateAsDate,
          bookable_as_date_iso: bookableDateAsDate.toISOString(),
          bookable_as_date_local: bookableDateAsDate.toLocaleDateString(),
          bookable_as_string: bookableDateAsString
        },
        timezone_info: {
          user_timezone_offset: effectiveDateAsDate.getTimezoneOffset(),
          utc_vs_local_difference: {
            utc_date: effectiveDateAsDate.getUTCDate(),
            local_date: effectiveDateAsDate.getDate(),
            difference: effectiveDateAsDate.getUTCDate() - effectiveDateAsDate.getDate()
          }
        }
      }
    })

    // Step 3: Compare with what the actual API returns
    const adminApiResponse = await fetch('http://localhost:3005/api/admin/bookability')
    const adminApiData = await adminApiResponse.json()
    
    const healthChoiceRecords = adminApiData.data?.filter(
      (record: any) => record.payer_id === '62ab291d-b68e-4c71-a093-2d6e380764c3'
    ) || []

    return NextResponse.json({
      success: true,
      investigation: {
        step_1_raw_supabase: {
          count: rawData?.length || 0,
          sample: rawData?.[0] || null,
          all_dates: rawData?.map(r => ({ 
            effective: r.effective_date, 
            bookable: r.bookable_from_date 
          })) || []
        },
        step_2_parsing_analysis: processedData,
        step_3_admin_api_comparison: {
          admin_api_count: healthChoiceRecords.length,
          admin_api_dates: healthChoiceRecords.map((r: any) => ({
            provider: `${r.provider_first_name} ${r.provider_last_name}`,
            effective_date: r.effective_date,
            bookable_from_date: r.bookable_from_date
          }))
        },
        current_server_info: {
          server_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          server_time: new Date().toISOString(),
          server_date_only: new Date().toISOString().split('T')[0]
        }
      },
      diagnosis: {
        expected_effective_date: '2025-09-01',
        expected_bookable_date: '2025-08-11',
        off_by_one_detected: 'Will be determined by comparing raw vs processed values'
      }
    })

  } catch (error: any) {
    console.error('❌ Error in date flow trace:', error)
    return NextResponse.json({ success: false, error: error.message })
  }
}