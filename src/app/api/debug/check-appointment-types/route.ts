/**
 * Debug endpoint to check what appointment_type values exist in the database
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        // Get distinct appointment_type values from existing appointments
        const { data: appointments, error } = await supabaseAdmin
            .from('appointments')
            .select('appointment_type')
            .limit(100)

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 })
        }

        // Count occurrences of each type
        const typeCounts = appointments.reduce((acc, apt) => {
            const type = apt.appointment_type || 'NULL'
            acc[type] = (acc[type] || 0) + 1
            return acc
        }, {} as Record<string, number>)

        return NextResponse.json({
            success: true,
            distinct_types: Object.keys(typeCounts),
            type_counts: typeCounts,
            sample_appointments: appointments.slice(0, 10),
            note: 'These are the appointment_type values currently in your database'
        })

    } catch (error: any) {
        console.error('❌ Error checking appointment types:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
