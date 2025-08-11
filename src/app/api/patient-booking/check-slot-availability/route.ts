// src/app/api/patient-booking/create-appointment/route.ts
// This endpoint creates appointments and blocks the time slots

export async function POST(request: NextRequest) {
    try {
        const appointmentData = await request.json()

        // Validate required fields
        const requiredFields = ['provider_id', 'patient_name', 'appointment_date', 'appointment_time']
        for (const field of requiredFields) {
            if (!appointmentData[field]) {
                return NextResponse.json(
                    { error: `${field} is required`, success: false },
                    { status: 400 }
                )
            }
        }

        console.log('Creating appointment:', appointmentData)

        const result = await patientBookingAvailabilityService.createAppointment({
            ...appointmentData,
            duration_minutes: appointmentData.duration_minutes || 60,
            appointment_type: appointmentData.appointment_type || 'initial_consultation'
        })

        if (result.error) {
            return NextResponse.json(
                { error: result.error, success: false },
                { status: 400 }
            )
        }

        const response = {
            success: true,
            data: {
                appointment: result.appointment,
                message: 'Appointment created successfully'
            }
        }

        return NextResponse.json(response)

    } catch (error: any) {
        console.error('Error creating appointment:', error)
        return NextResponse.json(
            { 
                error: 'Failed to create appointment', 
                details: error.message,
                success: false 
            },
            { status: 500 }
        )
    }
}
