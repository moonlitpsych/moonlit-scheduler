/**
 * Test new patient intake booking flow
 * Run with: npx tsx scripts/test-new-patient-booking.ts
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const TEST_PAYER_MOLINA = '8b48c3e2-f555-4d67-8122-c086466ba97d';

async function testNewPatientBooking() {
    console.log('\n🧪 Testing NEW PATIENT intake booking...\n');

    // Step 1: Get availability for Molina on Oct 15
    console.log('1️⃣ Fetching availability for Molina on 2025-10-15...');
    const availResponse = await fetch(`${BASE_URL}/api/patient-booking/merged-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            payer_id: TEST_PAYER_MOLINA,
            date: '2025-10-15'
        })
    });

    const availData = await availResponse.json();

    if (!availData.success || !availData.data?.slots?.length) {
        console.error('❌ No available slots found');
        console.error('Response:', JSON.stringify(availData, null, 2));
        process.exit(1);
    }

    console.log(`✅ Found ${availData.data.slots.length} available slots`);

    // Use first slot at 4:00 PM if available, otherwise first slot
    const slot4pm = availData.data.slots.find((s: any) => s.time === '16:00');
    const slot = slot4pm || availData.data.slots[0];

    console.log(`📅 Selected slot: ${slot.date} at ${slot.time} with ${slot.provider.first_name} ${slot.provider.last_name}`);

    // Step 2: Book appointment with NEW PATIENT INFO
    const startTime = new Date(`${slot.date}T${slot.time}:00.000-06:00`).toISOString();

    console.log('\n2️⃣ Booking appointment with NEW PATIENT INFO...');
    const bookRequest = {
        patientInfo: {
            firstName: 'Test',
            lastName: 'Patient',
            email: `test-${Date.now()}@example.com`,
            phone: '555-123-4567',
            dateOfBirth: '1990-01-15'
        },
        providerId: slot.providerId,
        payerId: TEST_PAYER_MOLINA,
        start: startTime,
        locationType: 'telehealth',
        notes: 'New patient intake test booking'
    };

    console.log('Request payload:', JSON.stringify(bookRequest, null, 2));

    const bookResponse = await fetch(`${BASE_URL}/api/patient-booking/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookRequest)
    });

    const bookData = await bookResponse.json();

    if (!bookResponse.ok) {
        console.error('❌ Booking failed!');
        console.error('Status:', bookResponse.status);
        console.error('Response:', JSON.stringify(bookData, null, 2));
        process.exit(1);
    }

    if (!bookData.success) {
        console.error('❌ Booking returned success=false');
        console.error('Response:', JSON.stringify(bookData, null, 2));
        process.exit(1);
    }

    console.log('\n✅ BOOKING SUCCESSFUL!\n');
    console.log('Appointment Details:');
    console.log('  - Appointment ID:', bookData.data.appointmentId);
    console.log('  - IntakeQ ID:', bookData.data.pqAppointmentId || 'Not yet synced');
    console.log('  - Provider:', bookData.data.provider.name);
    console.log('  - Start:', bookData.data.start);
    console.log('  - Duration:', bookData.data.duration, 'minutes');
    console.log('  - Service:', bookData.data.service.instanceId);

    console.log('\n🎉 Test passed! New patient was created and appointment booked.\n');
}

testNewPatientBooking().catch((error) => {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
});
