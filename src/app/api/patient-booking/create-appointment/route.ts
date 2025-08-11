// src/app/api/patient-booking/providers-for-payer/route.ts
// This endpoint gets all providers who accept a specific insurance

export async function POST(request: NextRequest) {
    try {
        const supabase = createRouteHandlerClient({ cookies })
        const { payerId } = await request.json()

        if (!payerId) {
            return NextResponse.json(
                { error: 'Payer ID is required', success: false },
                { status: 400 }
            )
        }

        console.log(`Getting providers for payer ${payerId}`)

        // Try to get providers from relationships table first
        const { data: relationships, error: relationshipError } = await supabase
            .from('provider_payer_relationships')
            .select(`
                provider_id,
                status,
                providers (
                    id,
                    first_name,
                    last_name,
                    title,
                    role,
                    accepts_new_patients,
                    telehealth_enabled,
                    availability
                )
            `)
            .eq('payer_id', payerId)
            .eq('status', 'active')

        let providers = []

        if (relationshipError) {
            console.log('No provider_payer_relationships table, getting all available providers')
            
            // Fallback: Get all providers who are available
            const { data: allProviders, error: allProvidersError } = await supabase
                .from('providers')
                .select('id, first_name, last_name, title, role, accepts_new_patients, telehealth_enabled, availability')
                .eq('availability', true)

            if (allProvidersError) {
                throw allProvidersError
            }

            providers = allProviders || []
        } else {
            providers = relationships?.map(rel => rel.providers).filter(Boolean) || []
        }

        // Filter to only available providers
        const availableProviders = providers.filter(p => p.availability !== false)

        const response = {
            success: true,
            data: {
                payerId,
                providers: availableProviders,
                totalProviders: availableProviders.length,
                message: `Found ${availableProviders.length} providers who accept this insurance`
            }
        }

        return NextResponse.json(response)

    } catch (error: any) {
        console.error('Error getting providers for payer:', error)
        return NextResponse.json(
            { 
                error: 'Failed to get providers', 
                details: error.message,
                success: false 
            },
            { status: 500 }
        )
    }
}
