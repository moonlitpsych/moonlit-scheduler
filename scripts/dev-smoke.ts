/**
 * Minimal smoke test for Intake-only booking flow
 * Run with: npx tsx scripts/dev-smoke.ts
 */

// Only run in development
if (process.env.NODE_ENV === 'production') {
    console.log('❌ Smoke tests disabled in production');
    process.exit(1);
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Real payer UUIDs from seeded data
const TEST_PAYERS = {
    molina: '8b48c3e2-f555-4d67-8122-c086466ba97d',
    um_ffs: 'a01d69d6-ae70-4917-afef-49b5ef7e5220'
};

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
    details?: any;
}

const results: TestResult[] = [];

async function testAvailability(payerName: string, payerId: string, date: string): Promise<TestResult> {
    const testName = `Availability for ${payerName} on ${date}`;

    try {
        const response = await fetch(`${BASE_URL}/api/patient-booking/merged-availability`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                payer_id: payerId,
                date
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                name: testName,
                passed: false,
                error: `HTTP ${response.status}: ${data.error || data.code}`,
                details: data.debug
            };
        }

        if (!data.success) {
            return {
                name: testName,
                passed: false,
                error: `API returned success=false: ${data.error}`,
                details: data
            };
        }

        if (!data.data?.serviceInstanceId) {
            return {
                name: testName,
                passed: false,
                error: 'No serviceInstanceId in response',
                details: data
            };
        }

        return {
            name: testName,
            passed: true,
            details: {
                serviceInstanceId: data.data.serviceInstanceId,
                durationMinutes: data.data.durationMinutes,
                slotsCount: data.data.slots?.length || 0
            }
        };
    } catch (error: any) {
        return {
            name: testName,
            passed: false,
            error: error.message
        };
    }
}

async function testBooking(payerName: string, payerId: string, date: string): Promise<TestResult> {
    const testName = `Booking for ${payerName} on ${date}`;

    try {
        // Step 1: Get availability
        const availResponse = await fetch(`${BASE_URL}/api/patient-booking/merged-availability`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payer_id: payerId, date })
        });

        const availData = await availResponse.json();
        if (!availData.success || !availData.data?.slots?.length) {
            return {
                name: testName,
                passed: false,
                error: 'No available slots found',
                details: availData
            };
        }

        // Get first available slot
        const slot = availData.data.slots[0];
        const startTime = new Date(`${slot.date}T${slot.time}:00.000-06:00`).toISOString();

        // Step 2: Book appointment (using test patient ID)
        const bookResponse = await fetch(`${BASE_URL}/api/patient-booking/book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patientId: 'test-patient-id-001', // Test patient
                providerId: slot.providerId,
                payerId,
                start: startTime,
                locationType: 'telehealth',
                notes: 'Smoke test booking'
            })
        });

        const bookData = await bookResponse.json();

        if (!bookResponse.ok) {
            return {
                name: testName,
                passed: false,
                error: `HTTP ${bookResponse.status}: ${bookData.error || bookData.code}`,
                details: bookData
            };
        }

        if (!bookData.success) {
            return {
                name: testName,
                passed: false,
                error: `Booking failed: ${bookData.error}`,
                details: bookData
            };
        }

        if (!bookData.data?.pqAppointmentId) {
            return {
                name: testName,
                passed: false,
                error: 'No pqAppointmentId in response',
                details: bookData
            };
        }

        return {
            name: testName,
            passed: true,
            details: {
                appointmentId: bookData.data.appointmentId,
                pqAppointmentId: bookData.data.pqAppointmentId,
                provider: bookData.data.provider.name,
                start: bookData.data.start
            }
        };
    } catch (error: any) {
        return {
            name: testName,
            passed: false,
            error: error.message
        };
    }
}

async function runTests() {
    console.log('\n🧪 Starting Intake-only smoke tests...\n');

    // Get tomorrow's date in YYYY-MM-DD format
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Test 1: UM FFS availability
    console.log('🔍 Test 1: UM FFS availability...');
    const test1 = await testAvailability('UM FFS', TEST_PAYERS.um_ffs, tomorrowStr);
    results.push(test1);
    console.log(test1.passed ? '✅ PASS' : '❌ FAIL', test1.passed ? test1.details : test1.error);

    // Test 2: Molina availability
    console.log('\n🔍 Test 2: Molina availability...');
    const test2 = await testAvailability('Molina', TEST_PAYERS.molina, tomorrowStr);
    results.push(test2);
    console.log(test2.passed ? '✅ PASS' : '❌ FAIL', test2.passed ? test2.details : test2.error);

    // Test 3: End-to-end booking (Molina)
    console.log('\n🔍 Test 3: End-to-end booking flow...');
    const test3 = await testBooking('Molina', TEST_PAYERS.molina, tomorrowStr);
    results.push(test3);
    console.log(test3.passed ? '✅ PASS' : '❌ FAIL', test3.passed ? test3.details : test3.error);

    // Print summary
    console.log('\n📊 Test Summary:\n');
    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    results.forEach((result, i) => {
        const status = result.passed ? '✅' : '❌';
        console.log(`${status} ${i + 1}. ${result.name}`);
        if (!result.passed && result.error) {
            console.log(`   Error: ${result.error}`);
        }
    });

    console.log(`\n${passed}/${total} tests passed\n`);

    if (passed === total) {
        console.log('🎉 All tests passed!');
        process.exit(0);
    } else {
        console.log('❌ Some tests failed');
        process.exit(1);
    }
}

// Run tests
runTests().catch((error) => {
    console.error('💥 Test runner crashed:', error);
    process.exit(1);
});
