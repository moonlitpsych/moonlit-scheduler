import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
    try {
        console.log('🔧 Setting up Molina Utah supervision relationships...')
        
        const molinaPayerId = '8b48c3e2-f555-4d67-8122-c086466ba97d'
        const privratskyId = '504d53c6-54ef-40b0-81d4-80812c2c7bfd'
        
        // Get all bookable providers (the residents who should be supervised)
        const { data: bookableProviders, error: providersError } = await supabaseAdmin
            .from('providers')
            .select('id, first_name, last_name, is_bookable, is_active')
            .eq('is_active', true)
            .neq('is_bookable', false)  // Only bookable providers
            .neq('id', privratskyId)   // Exclude Dr. Privratsky himself

        if (providersError) {
            console.error('❌ Error fetching bookable providers:', providersError)
            return NextResponse.json({ error: providersError.message }, { status: 500 })
        }

        console.log(`👥 Found ${bookableProviders?.length || 0} bookable providers for supervision`)

        if (!bookableProviders || bookableProviders.length === 0) {
            return NextResponse.json({ 
                message: 'No bookable providers found to supervise',
                bookable_providers: bookableProviders
            })
        }

        // Create supervision relationships for each bookable provider
        const supervisionRelationships = bookableProviders.map(provider => ({
            rendering_provider_id: provider.id,      // Who provides the service (resident)
            billing_provider_id: privraetskyId,      // Who supervises/bills (Dr. Privratsky)  
            payer_id: molinaPayerId,                  // Molina Utah
            effective_date: '2025-09-04',            // Today
            status: 'active',
            relationship_type: 'supervision'
        }))

        console.log('📝 Creating supervision relationships:', supervisionRelationships.length)

        const { data: createdRelationships, error: insertError } = await supabaseAdmin
            .from('supervision_relationships')
            .insert(supervisionRelationships)
            .select()

        if (insertError) {
            console.error('❌ Error creating supervision relationships:', insertError)
            return NextResponse.json({ error: insertError.message }, { status: 500 })
        }

        console.log('✅ Successfully created supervision relationships:', createdRelationships?.length)

        // Verify the setup by checking providers-for-payer
        const providerCheckResponse = await fetch('http://localhost:3003/api/patient-booking/providers-for-payer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                payer_id: molinaPayerId, 
                language: 'English' 
            })
        })

        const providerCheckData = await providerCheckResponse.json()

        return NextResponse.json({
            success: true,
            message: 'Molina Utah supervision relationships created',
            supervision_relationships_created: createdRelationships?.length || 0,
            bookable_providers: bookableProviders?.map(p => `${p.first_name} ${p.last_name}`),
            created_relationships: createdRelationships,
            verification: {
                total_providers_now_available: providerCheckData?.data?.total_providers || 0,
                providers_list: providerCheckData?.data?.providers?.map((p: any) => 
                    `${p.first_name} ${p.last_name} (${p.relationship_type})`
                ) || []
            }
        })

    } catch (error: any) {
        console.error('💥 Error setting up supervision:', error)
        return NextResponse.json({ 
            error: 'Internal server error',
            details: error.message 
        }, { status: 500 })
    }
}

export async function GET() {
    try {
        console.log('🔍 Checking current Molina supervision setup...')
        
        const molinaPayerId = '8b48c3e2-f555-4d67-8122-c086466ba97d'
        
        // Check current supervision relationships for Molina
        const { data: currentRelationships, error } = await supabaseAdmin
            .from('supervision_relationships')
            .select('*')
            .eq('payer_id', molinaPayerId)
            .eq('status', 'active')

        if (error) {
            console.error('❌ Error checking supervision relationships:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Also check what providers-for-payer returns
        const providerCheckResponse = await fetch('http://localhost:3003/api/patient-booking/providers-for-payer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                payer_id: molinaPayerId, 
                language: 'English' 
            })
        })

        const providerCheckData = await providerCheckResponse.json()

        return NextResponse.json({
            current_supervision_relationships: currentRelationships?.length || 0,
            relationships: currentRelationships,
            providers_available_for_booking: providerCheckData?.data?.total_providers || 0,
            provider_details: providerCheckData?.data?.providers?.map((p: any) => ({
                name: `${p.first_name} ${p.last_name}`,
                is_bookable: p.is_bookable,
                relationship_type: p.relationship_type
            })) || []
        })

    } catch (error: any) {
        console.error('💥 Error checking supervision setup:', error)
        return NextResponse.json({ 
            error: 'Internal server error',
            details: error.message 
        }, { status: 500 })
    }
}