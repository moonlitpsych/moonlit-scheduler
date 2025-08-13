// src/app/api/patient-booking/create-appointment/route.ts
import type { Database } from '@/types/database'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    (process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!.trim()
)

export async function POST(req: NextRequest) {
    try {
        const {
            provider_id,
            rendering_provider_id,
            service_instance_id,
            payer_id,
            start_time,            // ISO string, e.g. "2025-08-13T16:00:00.000Z"
            timezone = 'America/Denver',
            patient_info,          // JSON object
            insurance_info,        // JSON object
            roi_contacts,          // JSON array/object (optional)
            appointment_type = 'telehealth',
            booking_source = 'scheduler'
        } = await req.json()

        // Minimal required fields
        const required = { provider_id, service_instance_id, start_time, patient_info, insurance_info }
        for (const [k, v] of Object.entries(required)) {
            if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
                return NextResponse.json({ success: false, error: `${k} is required` }, { status: 400 })
            }
        }

        // Insert appointment
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
                patient_info,
                insurance_info,
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

        return NextResponse.json({ success: true, appointment_id: data!.id })
    } catch (err: any) {
        console.error('❌ create-appointment exception:', err)
        return NextResponse.json({ success: false, error: err?.message || 'Unknown error' }, { status: 500 })
    }
}
