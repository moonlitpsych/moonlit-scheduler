// Test endpoint to examine partner data for calendar export testing

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        console.log('🧪 Testing partner data for calendar export...')

        // Check partner users
        const { data: partnerUsers, error: userError } = await supabaseAdmin
            .from('partner_users')
            .select('*')
            .limit(5)

        if (userError) {
            console.error('❌ Error fetching partner users:', userError)
        }

        // Check organizations
        const { data: organizations, error: orgError } = await supabaseAdmin
            .from('organizations')
            .select('*')
            .limit(5)

        if (orgError) {
            console.error('❌ Error fetching organizations:', orgError)
        }

        // Check appointments
        const { data: appointments, error: aptError } = await supabaseAdmin
            .from('appointments')
            .select(`
                id,
                start_time,
                end_time,
                appointment_type,
                status,
                patient_info,
                providers (
                    id,
                    first_name,
                    last_name,
                    title
                )
            `)
            .limit(10)

        if (aptError) {
            console.error('❌ Error fetching appointments:', aptError)
        }

        return NextResponse.json({
            success: true,
            data: {
                partner_users: {
                    count: partnerUsers?.length || 0,
                    sample: partnerUsers?.slice(0, 2) || [],
                    error: userError?.message || null
                },
                organizations: {
                    count: organizations?.length || 0, 
                    sample: organizations?.slice(0, 2) || [],
                    error: orgError?.message || null
                },
                appointments: {
                    count: appointments?.length || 0,
                    sample: appointments?.slice(0, 3) || [],
                    error: aptError?.message || null
                }
            }
        })

    } catch (error: any) {
        console.error('❌ Test partner data error:', error)
        return NextResponse.json(
            { success: false, error: 'Test failed', details: error.message },
            { status: 500 }
        )
    }
}