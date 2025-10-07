/**
 * Debug endpoint to check recent appointments
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        // Get all appointments from the last hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

        const { data: recentAppointments, error } = await supabaseAdmin
            .from('appointments')
            .select('*')
            .gte('created_at', oneHourAgo)
            .order('created_at', { ascending: false })

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 })
        }

        // Also check for Oct 22 at 5:00 PM specifically
        const oct22_5pm_utc = '2025-10-22T23:00:00+00:00'
        const oct22_6pm_utc = '2025-10-23T00:00:00+00:00'

        const { data: oct22Appointments, error: oct22Error } = await supabaseAdmin
            .from('appointments')
            .select('*')
            .eq('provider_id', '08fbcd34-cd5f-425c-85bd-1aeeffbe9694')  // Dr. Sweeney
            .eq('status', 'scheduled')
            .gte('start_time', oct22_5pm_utc)
            .lt('start_time', oct22_6pm_utc)

        return NextResponse.json({
            success: true,
            recent_appointments: recentAppointments?.map(apt => ({
                id: apt.id,
                provider_id: apt.provider_id,
                start_time: apt.start_time,
                end_time: apt.end_time,
                status: apt.status,
                created_at: apt.created_at,
                patient_id: apt.patient_id
            })),
            oct22_5pm_slot_check: {
                requested_time: 'Oct 22 at 5:00 PM Mountain (23:00 UTC)',
                existing_appointments: oct22Appointments
            }
        })

    } catch (error: any) {
        console.error('❌ Error checking appointments:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
