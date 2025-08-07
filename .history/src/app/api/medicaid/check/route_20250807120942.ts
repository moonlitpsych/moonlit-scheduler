// src/app/api/medicaid/check/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Supabase client (use service key for server-side operations)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// UHIN Configuration
const UHIN_CONFIG = {
    endpoint: 'https://ws.uhin.org/webservices/core/soaptype4.asmx',
    tradingPartner: 'HT009582-001',
    receiverID: 'HT000004-001',
    username: process.env.UHIN_USERNAME,
    password: process.env.UHIN_PASSWORD,
    providerNPI: process.env.PROVIDER_NPI || '1234567890',
    providerName: process.env.PROVIDER_NAME || 'MOONLIT_PLLC'
};

// Accepted Medicaid Plans Configuration
const ACCEPTED_MEDICAID_PLANS: Record<string, any> = {
    'UTAH MEDICAID FFS': { accepted: true, name: 'Fee-for-Service', code: 'FFS' },
    'FEE-FOR-SERVICE': { accepted: true, name: 'Fee-for-Service', code: 'FFS' },
    'UUHP': { accepted: true, name: 'UUHP', code: 'UUHP' },
    'OPTUM': { accepted: true, name: 'Optum', code: 'OPTUM' },
    'MOLINA': { accepted: true, name: 'Molina Healthcare', code: 'MOLINA' },
    'SELECTHEALTH': { accepted: false, name: 'SelectHealth', code: 'SELECTHEALTH' },
    'HEALTH CHOICE': { accepted: false, name: 'Health Choice', code: 'HEALTHCHOICE' }
};

// IMPORTANT: Export named function for POST method
export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Parse request body
        const body = await request.json();
        const { first, last, dob, ssn, medicaidId } = body;

        console.log(`🔍 Checking Medicaid eligibility for ${first} ${last}`);

        // Input validation
        if (!first || !last || !dob) {
            return NextResponse.json({
                enrolled: false,
                error: 'First name, last name, and date of birth are required',
                verified: false
            }, { status: 400 });
        }

        if (!ssn && !medicaidId) {
            return NextResponse.json({
                enrolled: false,
                error: 'Either SSN or Medicaid ID is required',
                verified: false
            }, { status: 400 });
        }

        // SIMULATION MODE (until UHIN credentials are ready)
        console.log('⚠️ Running in SIMULATION mode');

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Simulate different scenarios
        const scenarios = [
            { enrolled: true, plan: 'Fee-for-Service', planKey: 'FEE-FOR-SERVICE' },
            { enrolled: true, plan: 'SelectHealth', planKey: 'SELECTHEALTH' },
            { enrolled: true, plan: 'Molina Healthcare', planKey: 'MOLINA' },
            { enrolled: true, plan: 'Health Choice', planKey: 'HEALTH CHOICE' },
            { enrolled: true, plan: 'UUHP', planKey: 'UUHP' },
            { enrolled: false, plan: null, planKey: null }
        ];

        // Pick a random scenario
        const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

        let result;
        if (!scenario.enrolled) {
            result = {
                enrolled: false,
                verified: true,
                simulationMode: true,
                error: 'No active Medicaid coverage found',
                message: 'Patient does not have active Medicaid coverage'
            };
        } else {
            const planDetails = ACCEPTED_MEDICAID_PLANS[scenario.planKey!];
            result = {
                enrolled: true,
                verified: true,
                simulationMode: true,
                currentPlan: scenario.plan,
                planDetails: planDetails,
                isAccepted: planDetails.accepted,
                effectiveDate: new Date().toISOString().split('T')[0],
                message: planDetails.accepted
                    ? `Patient enrolled in ${scenario.plan} - We accept this plan!`
                    : `Patient enrolled in ${scenario.plan} - We do NOT accept this plan`
            };
        }

        // Log to database (optional - comment out if table doesn't exist yet)
        try {
            await supabase.from('eligibility_log').insert({
                patient_first_name: first,
                patient_last_name: last,
                patient_dob: dob,
                ssn_last_four: ssn?.slice(-4),
                medicaid_id: medicaidId,
                result: result,
                is_enrolled: result.enrolled,
                current_plan: result.currentPlan,
                is_plan_accepted: result.isAccepted,
                performed_at: new Date().toISOString(),
                processing_time_ms: Date.now() - startTime,
                sftp_filename: `sim_${Date.now()}.xml`
            });
        } catch (dbError) {
            console.log('Database logging skipped:', dbError);
            // Continue anyway - logging is optional
        }

        console.log(`✅ Simulation complete: ${result.enrolled ? 'ENROLLED' : 'NOT ENROLLED'}`);

        // Return successful response
        return NextResponse.json(result);

    } catch (error) {
        console.error('❌ Eligibility check failed:', error);

        return NextResponse.json({
            enrolled: false,
            error: 'Unable to verify eligibility',
            verified: false
        }, { status: 500 });
    }
}

// Also export OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}