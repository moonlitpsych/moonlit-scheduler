import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: NextRequest) {
  try {
    // Get all payers from database
    const { data: dbPayers, error: payersError } = await supabaseAdmin
      .from('payers')
      .select('id, name, payer_type')
      .order('name')

    if (payersError) {
      return NextResponse.json({
        success: false,
        error: payersError.message
      }, { status: 500 })
    }

    // CSV payers from Master Fee Schedule
    const csvPayers = [
      'Optum',
      'Medicaid FFS',
      'UUHP',
      'Aetna',
      'DMBA',
      'Molina',
      'Health Choice Utah',
      'Idaho Medicaid',
      'HMHI-BHN',
      'SelectHealth'
    ]

    // Suggest mappings based on fuzzy matching
    const suggestedMappings = csvPayers.map(csvName => {
      // Try exact match first
      let dbMatch = dbPayers?.find(db => db.name === csvName)
      let confidence: 'exact' | 'fuzzy' | 'none' = 'none'

      if (dbMatch) {
        confidence = 'exact'
      } else {
        // Try fuzzy matching (case-insensitive, contains)
        const csvLower = csvName.toLowerCase()
        dbMatch = dbPayers?.find(db => {
          const dbLower = db.name.toLowerCase()
          return dbLower.includes(csvLower) || csvLower.includes(dbLower)
        })

        if (dbMatch) {
          confidence = 'fuzzy'
        }
      }

      return {
        csv: csvName,
        db: dbMatch?.name || null,
        db_id: dbMatch?.id || null,
        payer_type: dbMatch?.payer_type || null,
        confidence
      }
    })

    // Identify unmapped payers
    const unmapped = suggestedMappings.filter(m => !m.db)
    const mappedCount = suggestedMappings.length - unmapped.length

    return NextResponse.json({
      success: true,
      database_payers: dbPayers,
      csv_payers: csvPayers,
      suggested_mappings: suggestedMappings,
      summary: {
        total_csv_payers: csvPayers.length,
        mapped_count: mappedCount,
        unmapped_count: unmapped.length,
        unmapped_payers: unmapped.map(m => m.csv)
      },
      notes: {
        exact_matches: suggestedMappings.filter(m => m.confidence === 'exact').length,
        fuzzy_matches: suggestedMappings.filter(m => m.confidence === 'fuzzy').length,
        instructions: 'Review suggested_mappings and confirm correct db names before running migration'
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
