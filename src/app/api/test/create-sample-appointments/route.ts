// Test endpoint to create sample appointments for calendar export testing

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        console.log('🧪 Creating sample appointments for calendar export testing...')

        // Get a few providers for sample appointments
        const { data: providers, error: providerError } = await supabaseAdmin
            .from('providers')
            .select('id, first_name, last_name, title')
            .eq('is_bookable', true)
            .limit(3)

        if (providerError || !providers || providers.length === 0) {
            console.error('❌ Error fetching providers:', providerError)
            return NextResponse.json({
                success: false,
                error: 'No providers available for sample appointments',
                details: providerError?.message
            }, { status: 400 })
        }

        // Get a service instance for appointments
        const { data: serviceInstances, error: serviceError } = await supabaseAdmin
            .from('service_instances')
            .select('id')
            .limit(1)

        if (serviceError || !serviceInstances || serviceInstances.length === 0) {
            console.error('❌ Error fetching service instances:', serviceError)
            return NextResponse.json({
                success: false,
                error: 'No service instances available',
                details: serviceError?.message
            }, { status: 400 })
        }

        // Generate sample appointments for the next few days
        const sampleAppointments = []
        const baseDate = new Date()
        baseDate.setHours(10, 0, 0, 0) // Start at 10 AM

        for (let i = 0; i < 5; i++) {
            const appointmentDate = new Date(baseDate)
            appointmentDate.setDate(appointmentDate.getDate() + i)
            
            const startTime = appointmentDate.toISOString()
            appointmentDate.setHours(appointmentDate.getHours() + 1) // 1-hour appointments
            const endTime = appointmentDate.toISOString()

            const provider = providers[i % providers.length]
            
            sampleAppointments.push({
                provider_id: provider.id,
                service_instance_id: serviceInstances[0].id,
                start_time: startTime,
                end_time: endTime,
                appointment_type: null, // Let's try null first to bypass constraint
                status: 'confirmed',
                patient_info: {
                    firstName: `TestPatient${i + 1}`,
                    lastName: 'LastName',
                    phone: '555-123-4567',
                    email: `testpatient${i + 1}@example.com`
                },
                insurance_info: {
                    payer: 'Test Insurance',
                    memberId: `TEST${i + 1}123`,
                    groupNumber: 'GRP001'
                },
                athena_appointment_id: `test-${Date.now()}-${i}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
        }

        console.log(`🎯 Creating ${sampleAppointments.length} sample appointments...`)

        // Insert sample appointments
        const { data: insertedAppointments, error: insertError } = await supabaseAdmin
            .from('appointments')
            .insert(sampleAppointments)
            .select('*')

        if (insertError) {
            console.error('❌ Error inserting sample appointments:', insertError)
            return NextResponse.json({
                success: false,
                error: 'Failed to create sample appointments',
                details: insertError.message
            }, { status: 500 })
        }

        console.log(`✅ Created ${insertedAppointments?.length || 0} sample appointments`)

        return NextResponse.json({
            success: true,
            message: `Created ${insertedAppointments?.length || 0} sample appointments`,
            data: {
                appointments: insertedAppointments,
                providers_used: providers
            }
        })

    } catch (error: any) {
        console.error('❌ Create sample appointments error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to create sample appointments', details: error.message },
            { status: 500 }
        )
    }
}