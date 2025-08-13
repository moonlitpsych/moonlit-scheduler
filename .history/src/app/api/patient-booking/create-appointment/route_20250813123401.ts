// src/app/api/patient-booking/create-appointment/route.ts
import type { Database } from '@/types/database'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Service key if present (server-side insert), else anon for dev
const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    (process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!.trim()
)

export async function POST(req: NextRequest) {
    try {
        const payload = await req.json()

        const required = ['provider_id', 'service_instance_id', 'start_time', 'patient_info', 'insurance_info']
        for (const key of required) {
            if (!payload[key]) {
                return NextResponse.json({ success: false, error: `${key} is required` }, { status: 400 })
            }
        }

        const {
            provider_id,
            rendering_provider_id,    // for supervision cases
            service_instance_id,
            payer_id,
            start_time,               // ISO string
            timezone = 'America/Denver',
            patient_info,
            insurance_info,
            roi_contacts,
            booking_source = 'scheduler',
            appointment_type = 'telehealth', // aligns with your data model
        } = payload

        // Quick sanity checks
        const start = new Date(start_time)
        if (isNaN(+start)) {
            return NextResponse.json({ success: false, error: 'start_time must be a valid ISO date-time string' }, { status: 400 })
        }

        const now = new Date()
        if (+start < +now - 5 * 60 * 1000) {
            // allow small drift but avoid obviously past times
            return NextResponse.json({ success: false, error: 'start_time is in the past' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('appointments')
            .insert([{
                provider_id,
                rendering_provider_id: rendering_provider_id ?? null,
                service_instance_id,
                payer_id: payer_id ?? null,
                start_time,
                timezone,
                appointment_type,
                booking_source,
                patient_info,   // JSONB
                insurance_info, // JSONB
                roi_contacts: roi_contacts ?? null,
                status: 'scheduled',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select('id')
            .single()

        if (error) {
            console.error('❌ Insert appointment error:', error)
            return NextResponse.json({ success: false, error: 'Failed to create appointment' }, { status: 500 })
        }

        // TODO (optional): mark a hold or decrement cache capacity here

        return NextResponse.json({ success: true, appointment_id: data!.id })
    } catch (err: any) {
        console.error('❌ create-appointment exception:', err)
        return NextResponse.json({ success: false, error: err?.message || 'Unknown error' }, { status: 500 })
    }
}
