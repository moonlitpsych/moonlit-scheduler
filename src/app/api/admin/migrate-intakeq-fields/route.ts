import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST() {
  try {
    // Add intakeq_service_id and intakeq_location_id columns to providers table
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: `
        ALTER TABLE providers
        ADD COLUMN IF NOT EXISTS intakeq_service_id TEXT,
        ADD COLUMN IF NOT EXISTS intakeq_location_id TEXT;
      `
    })

    if (error) {
      // If exec_sql function doesn't exist, provide manual SQL
      console.error('❌ Migration failed:', error)
      return NextResponse.json({
        success: false,
        error: error.message,
        manual_sql: `
-- Run this SQL manually in Supabase SQL Editor:

ALTER TABLE providers
ADD COLUMN IF NOT EXISTS intakeq_service_id TEXT,
ADD COLUMN IF NOT EXISTS intakeq_location_id TEXT;

COMMENT ON COLUMN providers.intakeq_service_id IS 'IntakeQ Service ID from Dashboard → Settings → Services';
COMMENT ON COLUMN providers.intakeq_location_id IS 'IntakeQ Location ID from Dashboard → Settings → Locations';
        `
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      next_steps: [
        '1. Log into IntakeQ Dashboard',
        '2. Go to Settings → Services to get Service IDs',
        '3. Go to Settings → Locations to get Location IDs',
        '4. Use POST /api/admin/update-provider-intakeq-ids to update each provider'
      ]
    })

  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        manual_sql: `
-- Run this SQL manually in Supabase SQL Editor:

ALTER TABLE providers
ADD COLUMN IF NOT EXISTS intakeq_service_id TEXT,
ADD COLUMN IF NOT EXISTS intakeq_location_id TEXT;

COMMENT ON COLUMN providers.intakeq_service_id IS 'IntakeQ Service ID from Dashboard → Settings → Services';
COMMENT ON COLUMN providers.intakeq_location_id IS 'IntakeQ Location ID from Dashboard → Settings → Locations';
        `
      },
      { status: 500 }
    )
  }
}
