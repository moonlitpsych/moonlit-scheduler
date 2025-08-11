// src/app/api/patient-booking/provider-availability/route.ts
// This endpoint implements User Story #22: Individual provider calendar view

export async function POST(request: NextRequest) {
    try {
        const { providerId, startDate, endDate, appointmentDuration = 60 } = await request.json()

        if (!providerId) {
            return NextResponse.json(
                { error: 'Provider ID is required', success: false },
                { status: 400 }
            )
        }

        console.log(`Getting availability for provider ${providerId}`)

        const availableSlots = await patientBookingAvailabilityService.getAvailabilityForProvider(
            providerId,
            new Date(startDate),
            new Date(endDate),
            appointmentDuration
        )

        const response = {
            success: true,
            data: {
                providerId,
                totalSlots: availableSlots.length,
                dateRange: { startDate, endDate },
                availableSlots,
                provider: availableSlots.length > 0 ? availableSlots[0].provider : null,
                message: `Found ${availableSlots.length} available appointment slots`
            }
        }

        return NextResponse.json(response)

    } catch (error: any) {
        console.error('Error getting provider availability:', error)
        return NextResponse.json(
            { 
                error: 'Failed to get provider availability', 
                details: error.message,
                success: false 
            },
            { status: 500 }
        )
    }
}