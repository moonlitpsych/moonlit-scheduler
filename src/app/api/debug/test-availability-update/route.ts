import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Test endpoint to verify provider availability updates work correctly
 * Simulates what the UI sends to /api/providers/availability
 */
export async function POST() {
  const PRIVRATSKY_ID = '504d53c6-54ef-40b0-81d4-80812c2c7bfd'

  try {
    console.log('🧪 Testing availability update with proper schema...')

    // Simulate the payload format that the UI sends
    const testSchedule = {
      0: { day_of_week: 0, is_available: false, time_blocks: [] }, // Sunday
      1: { day_of_week: 1, is_available: false, time_blocks: [] }, // Monday
      2: { day_of_week: 2, is_available: false, time_blocks: [] }, // Tuesday
      3: { day_of_week: 3, is_available: false, time_blocks: [] }, // Wednesday
      4: { // Thursday - AVAILABLE
        day_of_week: 4,
        is_available: true,
        time_blocks: [
          {
            start_time: '09:00:00',
            end_time: '16:00:00'
          }
        ]
      },
      5: { day_of_week: 5, is_available: false, time_blocks: [] }, // Friday
      6: { day_of_week: 6, is_available: false, time_blocks: [] }  // Saturday
    }

    // Delete existing
    const { error: deleteError } = await supabaseAdmin
      .from('provider_availability')
      .delete()
      .eq('provider_id', PRIVRATSKY_ID)

    if (deleteError) {
      throw new Error(`Delete failed: ${deleteError.message}`)
    }

    console.log('✅ Deleted old schedule')

    // Prepare blocks using the SAME logic as the actual API
    const newBlocks: any[] = []
    Object.values(testSchedule).forEach((daySchedule: any) => {
      if (daySchedule.is_available && daySchedule.time_blocks.length > 0) {
        daySchedule.time_blocks.forEach((block: any) => {
          if (block.start_time && block.end_time) {
            newBlocks.push({
              provider_id: PRIVRATSKY_ID,
              day_of_week: daySchedule.day_of_week,
              start_time: block.start_time,
              end_time: block.end_time,
              is_recurring: true,
              timezone: 'America/Denver',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
          }
        })
      }
    })

    console.log(`📝 Inserting ${newBlocks.length} blocks with schema:`, Object.keys(newBlocks[0] || {}))

    // Insert new blocks
    const { data: insertedData, error: insertError } = await supabaseAdmin
      .from('provider_availability')
      .insert(newBlocks)
      .select()

    if (insertError) {
      throw new Error(`Insert failed: ${insertError.message}`)
    }

    console.log('✅ Insert successful!')

    // Verify
    const { data: verification } = await supabaseAdmin
      .from('provider_availability')
      .select('*')
      .eq('provider_id', PRIVRATSKY_ID)

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    return NextResponse.json({
      success: true,
      message: '✅ Availability update works correctly!',
      test_results: {
        blocks_prepared: newBlocks.length,
        blocks_inserted: insertedData?.length || 0,
        schema_used: Object.keys(newBlocks[0] || {}),
        verification: verification?.map(v => ({
          day: days[v.day_of_week],
          time: `${v.start_time} - ${v.end_time}`,
          has_timezone: !!v.timezone
        }))
      }
    })

  } catch (error: any) {
    console.error('❌ Test failed:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
