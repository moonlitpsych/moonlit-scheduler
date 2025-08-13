// src/app/api/patient-booking/create-appointment/route.ts
import type { Database } from '@/types/database'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Use service key if present (RLS-neutral server-side insert), else anon
const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    (process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!.trim()
)

export async function POST(req: NextRequest) {
    try {
        const payload = await req.json()

        // Minimal required fields for MVP (keep exact original)
        const required = ['provider_id', 'service_instance_id', 'start_time', 'patient_info', 'insurance_info']
        for (const key of required) {
            if (!payload[key]) {
                return NextResponse.json({ success: false, error: `${key} is required` }, { status: 400 })
            }
        }

        // Optional fields (keep your original names)
        const {
            provider_id,
            rendering_provider_id, // for supervision cases
            service_instance_id,
            payer_id,
            start_time,            // ISO string
            timezone = 'America/Denver',
            patient_info,
            insurance_info,
            roi_contacts,
            booking_source = 'scheduler'
        } = payload

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
                appointment_type: 'telehealth', // original behavior
                booking_source,
                patient_info,        // JSONB
                insurance_info,      // JSONB
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

        // TODO (future): decrement availability cache or create a slim “hold” row

        return NextResponse.json({ success: true, appointment_id: data!.id })
    } catch (err: any) {
        console.error('❌ create-appointment exception:', err)
        return NextResponse.json({ success: false, error: err?.message || 'Unknown error' }, { status: 500 })
    }
}
