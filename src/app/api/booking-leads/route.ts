import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { 
            email, 
            phone, 
            preferred_name, 
            requested_payer_id, 
            reason = 'out_of_network',
            status = 'pending'
        } = body

        // Validate required fields
        if (!email?.trim()) {
            return NextResponse.json(
                { success: false, error: 'Email is required' },
                { status: 400 }
            )
        }

        // Insert into booking_leads table
        const { data, error } = await supabase
            .from('booking_leads')
            .insert([{
                email: email.trim(),
                phone: phone?.trim() || null,
                preferred_name: preferred_name?.trim() || null,
                requested_payer_id,
                reason,
                status,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select()

        if (error) {
            console.error('Error inserting booking lead:', error)
            return NextResponse.json(
                { success: false, error: 'Failed to save contact information' },
                { status: 500 }
            )
        }

        console.log('✅ Booking lead created:', data[0]?.id)

        return NextResponse.json({
            success: true,
            data: data[0]
        })

    } catch (error) {
        console.error('Error in booking-leads API:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}