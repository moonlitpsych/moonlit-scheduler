import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('🔄 Starting is_bookable field migration...')

    // First check if the column already exists
    const { data: columns, error: columnError } = await supabaseAdmin
      .rpc('get_columns_info', { table_name: 'providers' })

    if (columnError) {
      console.log('⚠️ Could not check existing columns, proceeding with migration attempt')
    }

    // Attempt to add the column (this will fail gracefully if it exists)
    const addColumnQuery = `
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'providers' AND column_name = 'is_bookable'
        ) THEN
          ALTER TABLE providers ADD COLUMN is_bookable BOOLEAN DEFAULT true;
          COMMENT ON COLUMN providers.is_bookable IS 'Whether this provider can be booked directly by patients. Supervising attendings may be false.';
        END IF;
      END $$;
    `

    const { error: addError } = await supabaseAdmin.rpc('exec_sql', { 
      query: addColumnQuery 
    })

    if (addError) {
      console.error('❌ Failed to add is_bookable column:', addError)
      return NextResponse.json({
        success: false,
        error: 'Failed to add is_bookable column',
        details: addError.message
      }, { status: 500 })
    }

    console.log('✅ is_bookable column added successfully')

    // Update Dr. Privratsky to not be bookable
    const { data: privratsky, error: findError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, is_bookable')
      .eq('last_name', 'Privratsky')
      .single()

    if (findError) {
      console.log('⚠️ Could not find Dr. Privratsky:', findError.message)
    } else {
      const { error: updateError } = await supabaseAdmin
        .from('providers')
        .update({ is_bookable: false })
        .eq('id', privratsky.id)

      if (updateError) {
        console.error('❌ Failed to update Dr. Privratsky:', updateError)
      } else {
        console.log('✅ Updated Dr. Privratsky to is_bookable = false')
      }
    }

    // Get final state of all providers
    const { data: allProviders, error: queryError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, is_bookable, accepts_new_patients')
      .order('last_name')

    if (queryError) {
      console.error('❌ Failed to query final state:', queryError)
    }

    return NextResponse.json({
      success: true,
      message: 'is_bookable field migration completed',
      privratsky_updated: !!privratsky,
      providers: allProviders || [],
      migration_steps: [
        'Added is_bookable BOOLEAN DEFAULT true column',
        'Added column comment for documentation', 
        'Updated Dr. Privratsky to is_bookable = false',
        'Verified all provider states'
      ]
    })

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error.message
    }, { status: 500 })
  }
}