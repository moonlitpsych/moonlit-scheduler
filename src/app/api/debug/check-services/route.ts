/**
 * Debug endpoint to check services table
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        // Get all services
        const { data: services, error } = await supabaseAdmin
            .from('services')
            .select('*')
            .order('name')

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 })
        }

        // Filter for Intake and Follow-up services
        const intakeServices = services.filter(s => 
            s.name.toLowerCase().includes('intake') || 
            s.name.toLowerCase().includes('new patient')
        )
        
        const followupServices = services.filter(s => 
            s.name.toLowerCase().includes('follow')
        )

        return NextResponse.json({
            success: true,
            total_services: services.length,
            intake_services: intakeServices,
            followup_services: followupServices,
            all_services: services
        })

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
