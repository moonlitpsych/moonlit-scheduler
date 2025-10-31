import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const PRIVRATSKY_ID = '504d53c6-54ef-40b0-81d4-80812c2c7bfd'

export async function POST() {
  try {
    console.log('🔧 Updating Dr. Privratsky to Thursday 9am-4pm...')

    // Delete existing
    const { error: deleteError } = await supabaseAdmin
      .from('provider_availability')
      .delete()
      .eq('provider_id', PRIVRATSKY_ID)

    if (deleteError) {
      throw new Error(`Delete failed: ${deleteError.message}`)
    }

    console.log('✅ Deleted old schedule')

    // Insert new Thursday schedule
    const { data, error: insertError } = await supabaseAdmin
      .from('provider_availability')
      .insert([{
        provider_id: PRIVRATSKY_ID,
        day_of_week: 4, // Thursday
        start_time: '09:00:00',
        end_time: '16:00:00', // 4pm
        is_recurring: true,
        timezone: 'America/Denver'
      }])
      .select()

    if (insertError) {
      throw new Error(`Insert failed: ${insertError.message}`)
    }

    console.log('✅ Created Thursday 9am-4pm schedule')

    // Verify
    const { data: verify } = await supabaseAdmin
      .from('provider_availability')
      .select('*')
      .eq('provider_id', PRIVRATSKY_ID)

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    return NextResponse.json({
      success: true,
      message: 'Updated Dr. Privratsky to Thursday 9am-4pm',
      verification: verify?.map(v => ({
        day: days[v.day_of_week],
        time: `${v.start_time} - ${v.end_time}`
      }))
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
