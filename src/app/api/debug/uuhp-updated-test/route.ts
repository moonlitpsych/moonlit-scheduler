import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

export async function GET() {
    try {
        console.log('🔍 Testing UUHP with new status_code logic...')
        
        // Search for University of Utah Health Plans
        const { data: uuhpData, error } = await supabaseAdmin
            .from('payers')
            .select('id, name, status_code, effective_date, payer_type, state')
            .ilike('name', '%University of Utah Health Plans%')
            .single()

        if (error) {
            console.error('❌ Error fetching UUHP data:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        console.log('✅ Found UUHP record:', uuhpData)

        // Apply the new logic
        const now = new Date()
        const statusCode = uuhpData.status_code
        let acceptanceStatus: 'not-accepted' | 'future' | 'active' | 'waitlist' = 'not-accepted'
        let displayMessage = ''

        // Handle denied/blocked/rejected statuses
        if (['denied', 'blocked', 'withdrawn', 'on_pause'].includes(statusCode || '')) {
            acceptanceStatus = 'not-accepted'
            displayMessage = 'We cannot accept this insurance'
        }
        // Handle approved status
        else if (statusCode === 'approved') {
            if (uuhpData.effective_date) {
                const effectiveDate = new Date(uuhpData.effective_date)
                if (effectiveDate <= now) {
                    acceptanceStatus = 'active'
                    displayMessage = 'We accept this insurance'
                } else {
                    const daysUntilActive = Math.ceil((effectiveDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                    if (daysUntilActive > 21) {
                        acceptanceStatus = 'waitlist'
                        displayMessage = `Available starting ${effectiveDate.toLocaleDateString()}`
                    } else {
                        acceptanceStatus = 'future'
                        displayMessage = `Available starting ${effectiveDate.toLocaleDateString()}`
                    }
                }
            } else {
                // Approved but no effective date - waitlist case
                acceptanceStatus = 'waitlist'
                displayMessage = 'We will be in network soon - timing uncertain'
            }
        }
        // Handle in-progress statuses (waiting_on_them, in_progress, not_started)
        else if (['waiting_on_them', 'in_progress', 'not_started'].includes(statusCode || '')) {
            acceptanceStatus = 'waitlist'
            displayMessage = 'Credentialing in progress - join waitlist'
        }
        // Unknown/null status - not accepted
        else {
            acceptanceStatus = 'not-accepted'
            displayMessage = 'We cannot accept this insurance'
        }

        return NextResponse.json({
            payer: uuhpData,
            logic_result: {
                status_code: statusCode,
                effective_date: uuhpData.effective_date,
                acceptance_status: acceptanceStatus,
                display_message: displayMessage,
                expected_flow: acceptanceStatus === 'waitlist' ? 'WaitlistConfirmationView' : 
                               acceptanceStatus === 'active' ? 'CalendarView' :
                               acceptanceStatus === 'future' ? 'InsuranceFutureView' :
                               'InsuranceNotAcceptedView'
            }
        })

    } catch (error: any) {
        console.error('💥 Debug API error:', error)
        return NextResponse.json({ 
            error: 'Internal server error',
            details: error.message 
        }, { status: 500 })
    }
}