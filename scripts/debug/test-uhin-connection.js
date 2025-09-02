// test-uhin-connection.js
// Run this with: node test-uhin-connection.js
// This tests the UHIN API through your Next.js endpoint

const testPatient = {
    first: 'JOHN',
    last: 'DOE',
    dob: '1985-03-15',
    medicaidId: '123456789'
};

async function testUHINConnection() {
    console.log('🔍 Testing UHIN Connection through Next.js API...\n');
    console.log('Test Patient:', testPatient);
    console.log('');

    try {
        const response = await fetch('http://localhost:3000/api/medicaid/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testPatient)
        });

        console.log('📡 Response Status:', response.status, response.statusText);

        const result = await response.json();
        console.log('\n📋 Response Data:');
        console.log(JSON.stringify(result, null, 2));

        if (result.simulationMode) {
            console.log('\n⚠️  Running in SIMULATION mode - check if credentials are set correctly');
        } else if (result.verified) {
            console.log('\n✅ REAL UHIN connection successful!');
            console.log('Enrolled:', result.enrolled);
            console.log('Current Plan:', result.currentPlan);
            console.log('Plan Accepted:', result.isAccepted);
        } else {
            console.log('\n❌ Connection failed - check error message above');
        }

    } catch (error) {
        console.error('\n❌ Error calling API:', error.message);
        console.log('\nMake sure your Next.js dev server is running on http://localhost:3000');
    }
}

// Run the test
testUHINConnection();