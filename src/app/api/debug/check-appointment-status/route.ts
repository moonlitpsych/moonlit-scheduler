/**
 * Debug endpoint to check what status values are allowed in appointments
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        // Get distinct status values from existing appointments
        const { data: appointments, error } = await supabaseAdmin
            .from('appointments')
            .select('status')
            .limit(100)

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 })
        }

        // Count occurrences of each status
        const statusCounts = appointments.reduce((acc, apt) => {
            const status = apt.status || 'NULL'
            acc[status] = (acc[status] || 0) + 1
            return acc
        }, {} as Record<string, number>)

        return NextResponse.json({
            success: true,
            distinct_statuses: Object.keys(statusCounts),
            status_counts: statusCounts,
            sample_appointments: appointments.slice(0, 10),
            note: 'These are the status values currently in your appointments table'
        })

    } catch (error: any) {
        console.error('❌ Error checking appointment statuses:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
