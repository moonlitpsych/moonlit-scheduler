#!/usr/bin/env node

/**
 * Athena Health FHIR API 403 Debug Script
 * 
 * This script tests various practice context headers and parameters
 * to resolve the 403 Forbidden errors when accessing FHIR resources.
 * 
 * Run: node athena_403_debug.js
 */

require('dotenv').config({ path: '.env.local' });

async function getAuthToken() {
    console.log('🔐 Getting OAuth token...');

    const response = await fetch(process.env.ATHENA_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(
                process.env.ATHENA_CLIENT_ID + ':' + process.env.ATHENA_CLIENT_SECRET
            ).toString('base64')
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            scope: 'system/Patient.r system/Practitioner.r system/Encounter.r system/Organization.r'
        })
    });

    if (!response.ok) {
        throw new Error(`OAuth failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    console.log('✅ OAuth token obtained successfully');
    console.log(`   Expires in: ${data.expires_in} seconds`);
    console.log(`   Scopes: ${data.scope}`);
    return data.access_token;
}

async function testFHIREndpoint(token, endpoint, testName, headers = {}, params = {}) {
    console.log(`\n🧪 Testing: ${testName}`);
    console.log(`   Endpoint: ${endpoint}`);

    // Build URL with query parameters
    const url = new URL(process.env.ATHENA_BASE_URL + endpoint);
    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
    });

    console.log(`   Full URL: ${url.toString()}`);
    console.log(`   Headers: ${JSON.stringify(headers, null, 2)}`);

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/fhir+json',
                'Content-Type': 'application/fhir+json',
                ...headers
            }
        });

        console.log(`   Status: ${response.status} ${response.statusText}`);

        if (response.ok) {
            const data = await response.json();
            console.log('✅ SUCCESS!');
            console.log(`   Resource count: ${data.total || data.entry?.length || 'N/A'}`);
            return { success: true, data };
        } else {
            const errorText = await response.text();
            console.log('❌ FAILED');
            console.log(`   Error: ${errorText}`);
            return { success: false, error: errorText, status: response.status };
        }
    } catch (error) {
        console.log('💥 EXCEPTION');
        console.log(`   Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function discoverPracticeInfo(token) {
    console.log('\n🔍 Discovering practice information...');

    // Test Organization resource to find practice details
    const orgResult = await testFHIREndpoint(
        token,
        '/fhir/r4/Organization',
        'Organization Discovery'
    );

    if (orgResult.success) {
        const organizations = orgResult.data.entry || [];
        console.log(`\n📋 Found ${organizations.length} organizations:`);

        organizations.forEach((org, index) => {
            const orgData = org.resource;
            console.log(`   ${index + 1}. ID: ${orgData.id}`);
            console.log(`      Name: ${orgData.name || 'No name'}`);
            console.log(`      Type: ${orgData.type?.[0]?.coding?.[0]?.display || 'Unknown'}`);

            // Look for practice identifiers
            if (orgData.identifier) {
                orgData.identifier.forEach(id => {
                    console.log(`      Identifier: ${id.system || 'no-system'} = ${id.value}`);
                });
            }
        });

        return organizations.map(org => org.resource.id);
    }

    return [];
}

async function testWithPracticeContext(token, practiceIds) {
    console.log('\n🏥 Testing with practice context...');

    const testCases = [
        // Method 1: ah-practice query parameter
        {
            name: 'Patient with ah-practice query param',
            endpoint: '/fhir/r4/Patient',
            params: { 'ah-practice': practiceIds[0] || 'demo' },
            headers: {}
        },

        // Method 2: Practice header
        {
            name: 'Patient with practice header',
            endpoint: '/fhir/r4/Patient',
            params: {},
            headers: { 'ah-practice': practiceIds[0] || 'demo' }
        },

        // Method 3: Multiple practice approaches
        {
            name: 'Patient with organization context',
            endpoint: '/fhir/r4/Patient',
            params: { 'organization': practiceIds[0] || 'demo' },
            headers: {}
        },

        // Method 4: Practice ID as path parameter (if supported)
        {
            name: 'Patient with practice in URL',
            endpoint: `/fhir/r4/Organization/${practiceIds[0] || 'demo'}/Patient`,
            params: {},
            headers: {}
        }
    ];

    for (const testCase of testCases) {
        await testFHIREndpoint(
            token,
            testCase.endpoint,
            testCase.name,
            testCase.headers,
            testCase.params
        );
    }
}

async function testAppointmentResources(token, practiceId) {
    console.log('\n📅 Testing appointment-related resources...');

    const appointmentTests = [
        {
            name: 'Appointment resource',
            endpoint: '/fhir/r4/Appointment',
            params: { 'ah-practice': practiceId || 'demo' }
        },
        {
            name: 'Schedule resource',
            endpoint: '/fhir/r4/Schedule',
            params: { 'ah-practice': practiceId || 'demo' }
        },
        {
            name: 'Slot resource',
            endpoint: '/fhir/r4/Slot',
            params: { 'ah-practice': practiceId || 'demo' }
        },
        {
            name: 'Practitioner resource',
            endpoint: '/fhir/r4/Practitioner',
            params: { 'ah-practice': practiceId || 'demo' }
        }
    ];

    for (const test of appointmentTests) {
        await testFHIREndpoint(
            token,
            test.endpoint,
            test.name,
            {},
            test.params
        );
    }
}

async function main() {
    console.log('🚀 Athena Health FHIR 403 Debug Script');
    console.log('=====================================\n');

    try {
        // Step 1: Get auth token
        const token = await getAuthToken();

        // Step 2: Test metadata (should work)
        await testFHIREndpoint(token, '/fhir/r4/metadata', 'Metadata Endpoint');

        // Step 3: Test basic resources without practice context (should fail)
        await testFHIREndpoint(token, '/fhir/r4/Patient', 'Patient (no practice context)');

        // Step 4: Discover practice information
        const practiceIds = await discoverPracticeInfo(token);

        // Step 5: Test with various practice context methods
        await testWithPracticeContext(token, practiceIds);

        // Step 6: If we found a working approach, test appointment resources
        if (practiceIds.length > 0) {
            await testAppointmentResources(token, practiceIds[0]);
        }

        console.log('\n🎯 Summary:');
        console.log('- If Organization discovery worked, use those practice IDs');
        console.log('- Most likely solution: Add ah-practice query parameter to all requests');
        console.log('- For sandbox, try practice IDs like "demo", "sandbox", or actual org IDs');
        console.log('- Once you find the right practice context, update your integration code');

    } catch (error) {
        console.error('💥 Script failed:', error);
    }
}

// Export functions for use in other scripts
module.exports = {
    getAuthToken,
    testFHIREndpoint,
    discoverPracticeInfo,
    testWithPracticeContext,
    testAppointmentResources
};

// Run if called directly
if (require.main === module) {
    main();
}