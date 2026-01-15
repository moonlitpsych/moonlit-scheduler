// Co-sign queue stats API - get counts for dashboard
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET() {
  try {
    // Get count of pending items
    const { count: pendingCount, error: pendingError } = await supabase
      .from('cosign_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    if (pendingError) {
      console.error('❌ [Co-Sign Stats] Pending count error:', pendingError)
    }

    // Get count of notes signed today
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { count: signedTodayCount, error: todayError } = await supabase
      .from('cosign_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'signed')
      .gte('signed_at', todayStart.toISOString())

    if (todayError) {
      console.error('❌ [Co-Sign Stats] Today count error:', todayError)
    }

    // Get count of notes signed this week
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 7)
    weekStart.setHours(0, 0, 0, 0)

    const { count: signedThisWeekCount, error: weekError } = await supabase
      .from('cosign_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'signed')
      .gte('signed_at', weekStart.toISOString())

    if (weekError) {
      console.error('❌ [Co-Sign Stats] Week count error:', weekError)
    }

    return NextResponse.json({
      pending: pendingCount ?? 0,
      signedToday: signedTodayCount ?? 0,
      signedThisWeek: signedThisWeekCount ?? 0
    })
  } catch (error: any) {
    console.error('❌ [Co-Sign Stats] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
