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
        console.log('🔍 Testing all status codes with new logic...')
        
        // Get one example of each status code
        const { data: payerData, error } = await supabaseAdmin
            .from('payers')
            .select('id, name, status_code, effective_date, payer_type')
            .limit(20)

        if (error) {
            console.error('❌ Error fetching payer data:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const results = payerData?.map(payer => {
            const now = new Date()
            const statusCode = payer.status_code
            let acceptanceStatus: 'not-accepted' | 'future' | 'active' | 'waitlist' = 'not-accepted'
            let displayMessage = ''

            // Apply the same logic as PayerSearchView
            if (['denied', 'blocked', 'withdrawn', 'on_pause'].includes(statusCode || '')) {
                acceptanceStatus = 'not-accepted'
                displayMessage = 'We cannot accept this insurance'
            }
            else if (statusCode === 'approved') {
                if (payer.effective_date) {
                    const effectiveDate = new Date(payer.effective_date)
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
                    acceptanceStatus = 'waitlist'
                    displayMessage = 'We will be in network soon - timing uncertain'
                }
            }
            else if (['waiting_on_them', 'in_progress', 'not_started'].includes(statusCode || '')) {
                acceptanceStatus = 'waitlist'
                displayMessage = 'Credentialing in progress - join waitlist'
            }
            else {
                acceptanceStatus = 'not-accepted'
                displayMessage = 'We cannot accept this insurance'
            }

            return {
                name: payer.name,
                status_code: statusCode,
                effective_date: payer.effective_date,
                acceptance_status: acceptanceStatus,
                display_message: displayMessage
            }
        })

        // Group by acceptance status for summary
        const summary = {
            active: results?.filter(r => r.acceptance_status === 'active').length || 0,
            future: results?.filter(r => r.acceptance_status === 'future').length || 0,
            waitlist: results?.filter(r => r.acceptance_status === 'waitlist').length || 0,
            not_accepted: results?.filter(r => r.acceptance_status === 'not-accepted').length || 0
        }

        return NextResponse.json({
            summary,
            results: results?.slice(0, 10) || [], // Show first 10 examples
            total_tested: results?.length || 0
        })

    } catch (error: any) {
        console.error('💥 Debug API error:', error)
        return NextResponse.json({ 
            error: 'Internal server error',
            details: error.message 
        }, { status: 500 })
    }
}