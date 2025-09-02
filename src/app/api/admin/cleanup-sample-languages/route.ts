// src/app/api/admin/cleanup-sample-languages/route.ts
import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        console.log('🧹 Starting cleanup of sample language data...')
        console.log('🔍 Environment variables check:')
        console.log('- NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing')
        console.log('- NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing')
        console.log('- SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✅ Set' : '❌ Missing')
        console.log('✅ Supabase clients initialized')

        // Get all providers and reset their languages_spoken to null or empty array
        const { data: providers, error: fetchError } = await supabaseAdmin
            .from('providers')
            .select('id, first_name, last_name, languages_spoken')
            .not('languages_spoken', 'is', null)

        if (fetchError) {
            console.error('❌ Error fetching providers:', fetchError)
            return NextResponse.json(
                { success: false, error: 'Failed to fetch providers' },
                { status: 500 }
            )
        }

        console.log(`📋 Found ${providers?.length || 0} providers with language data to clean`)

        if (!providers || providers.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No sample language data found to clean up',
                cleaned_count: 0
            })
        }

        // Reset all providers' languages_spoken to null
        const results = []
        
        for (const provider of providers) {
            const { data, error } = await supabaseAdmin
                .from('providers')
                .update({ languages_spoken: null })
                .eq('id', provider.id)
                .select('first_name, last_name')
            
            if (error) {
                console.error(`❌ Error cleaning provider ${provider.id}:`, error)
                results.push({ 
                    id: provider.id, 
                    name: `${provider.first_name} ${provider.last_name}`,
                    success: false, 
                    error: error.message 
                })
            } else {
                console.log(`✅ Cleaned language data for ${provider.first_name} ${provider.last_name}`)
                results.push({ 
                    id: provider.id, 
                    name: `${provider.first_name} ${provider.last_name}`,
                    success: true 
                })
            }
        }

        const cleanedCount = results.filter(r => r.success).length
        console.log(`🧹 Cleanup complete: ${cleanedCount}/${providers.length} providers cleaned`)

        return NextResponse.json({
            success: true,
            message: `Successfully cleaned language data for ${cleanedCount} providers`,
            results,
            cleaned_count: cleanedCount,
            total_providers: providers.length
        })

    } catch (error) {
        console.error('❌ Unexpected error during cleanup:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error during cleanup' },
            { status: 500 }
        )
    }
}