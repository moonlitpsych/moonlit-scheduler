import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST() {
  try {
    // Run the migration
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE providers
        ADD COLUMN IF NOT EXISTS intakeq_service_id TEXT,
        ADD COLUMN IF NOT EXISTS intakeq_location_id TEXT;
      `
    })

    if (error) {
      // Try direct query instead
      const { error: directError } = await supabase.from('providers').select('intakeq_service_id, intakeq_location_id').limit(1)

      if (directError && directError.message.includes('does not exist')) {
        return NextResponse.json({
          success: false,
          error: 'Cannot run ALTER TABLE via Supabase client. Please run migration manually in Supabase SQL Editor.',
          sql: `
ALTER TABLE providers
ADD COLUMN IF NOT EXISTS intakeq_service_id TEXT,
ADD COLUMN IF NOT EXISTS intakeq_location_id TEXT;
          `
        }, { status: 500 })
      }

      // Columns might already exist
      return NextResponse.json({
        success: true,
        message: 'Columns may already exist. Proceeding to verification...'
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully'
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
